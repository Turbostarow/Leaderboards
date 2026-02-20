// ============================================================
// src/sync.js — Main orchestrator
// Flow: login → fetch msgs → parse → upsert/delete → delete source msg → render → push
// State stored as pinned msgs in #lb-update (never in public channels)
// ============================================================

import 'dotenv/config';
import {
  loginBot, destroyBot, fetchMessages, deleteMessage,
  fetchStateMessage, createStateMessage, updateStateMessage,
  postWebhookMessage, editWebhookMessage,
  sleep,
} from './discord.js';
import { parseMessage, parseAnyMessage }                         from './parser.js';
import { decodeState, encodeState, upsertPlayer, deletePlayer }  from './storage.js';
import { renderLeaderboard, sortMarvelRivals, sortOverwatch, sortDeadlock } from './renderer.js';

// ── Config ────────────────────────────────────────────────────

function requireEnv(key) {
  const v = process.env[key];
  if (!v) { console.error(`[sync] Missing required env var: ${key}`); process.exit(1); }
  return v;
}

const LISTENING_CHANNEL = requireEnv('LISTENING_CHANNEL_ID');
const API_DELAY         = parseInt(process.env.API_DELAY_MS ?? '1000', 10);

const GAMES = {
  MARVEL_RIVALS: {
    webhookUrl: requireEnv('MARVEL_RIVALS_WEBHOOK_URL'),
    messageId:  process.env.MARVEL_RIVALS_MESSAGE_ID || null,
    sortFn:     sortMarvelRivals,
  },
  OVERWATCH: {
    webhookUrl: requireEnv('OVERWATCH_WEBHOOK_URL'),
    messageId:  process.env.OVERWATCH_MESSAGE_ID || null,
    sortFn:     sortOverwatch,
  },
  DEADLOCK: {
    webhookUrl: requireEnv('DEADLOCK_WEBHOOK_URL'),
    messageId:  process.env.DEADLOCK_MESSAGE_ID || null,
    sortFn:     sortDeadlock,
  },
};

const MSG_ID_KEYS = {
  MARVEL_RIVALS: 'MARVEL_RIVALS_MESSAGE_ID',
  OVERWATCH:     'OVERWATCH_MESSAGE_ID',
  DEADLOCK:      'DEADLOCK_MESSAGE_ID',
};

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  console.log('═══════════════════════════════════════');
  console.log('  Discord Leaderboard Sync — Starting  ');
  console.log(`  ${new Date().toUTCString()}`);
  console.log('═══════════════════════════════════════');

  try {
    await loginBot(requireEnv('DISCORD_TOKEN'));

    // 1. Fetch messages
    const messages = await fetchMessages(LISTENING_CHANNEL);
    if (messages.length === 0) {
      console.log('[sync] No messages found — nothing to do.');
      return;
    }

    // 2. Parse & group — each msg carries its Discord author ID so deletes are auditable
    const byGame = {
      MARVEL_RIVALS: { updates: [], deletes: [] },
      OVERWATCH:     { updates: [], deletes: [] },
      DEADLOCK:      { updates: [], deletes: [] },
    };
    let skipped = 0;

    for (const msg of messages) {
      // Pass the author's Discord ID so delete commands know who issued them
      const parsed = parseAnyMessage(msg.content, msg.author?.id ?? null);

      if (!parsed) {
        skipped++;
        const preview   = msg.content.slice(0, 100).replace(/\n/g, '↵');
        const hasPrefix = /^LB_(UPDATE|DELETE)_(MR|OW|DL):/i.test(msg.content.trim());
        if (hasPrefix) {
          console.warn(`[sync] ⚠️  PARSE FAILED (has prefix but validation failed):`);
          console.warn(`         "${preview}"`);
        } else {
          console.log(`[sync] Skipping non-LB message: "${preview}"`);
        }
        continue;
      }

      if (parsed.type === 'DELETE') {
        byGame[parsed.game].deletes.push({ msg, data: parsed });
      } else {
        byGame[parsed.game].updates.push({ msg, data: parsed });
      }
    }

    const totalUpdates = Object.values(byGame).reduce((n, g) => n + g.updates.length, 0);
    const totalDeletes = Object.values(byGame).reduce((n, g) => n + g.deletes.length, 0);
    console.log(
      `[sync] Grouped — ` +
      `MR: ${byGame.MARVEL_RIVALS.updates.length}u/${byGame.MARVEL_RIVALS.deletes.length}d, ` +
      `OW: ${byGame.OVERWATCH.updates.length}u/${byGame.OVERWATCH.deletes.length}d, ` +
      `DL: ${byGame.DEADLOCK.updates.length}u/${byGame.DEADLOCK.deletes.length}d, ` +
      `Skipped: ${skipped}`
    );

    // 3. Process each game
    const results = {};
    for (const [game, { updates, deletes }] of Object.entries(byGame)) {
      if (updates.length === 0 && deletes.length === 0) {
        console.log(`[sync] ${game}: no updates or deletes.`);
        continue;
      }
      results[game] = await processGame(game, updates, deletes);
      await sleep(API_DELAY);
    }

    // 4. Summary
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════');
    console.log(`  Sync complete in ${elapsed}s`);
    for (const [game, r] of Object.entries(results)) {
      console.log(
        `  ${game}: +${r.inserted} inserted, ~${r.updated} updated, ` +
        `-${r.deleted} removed, ${r.sourceDeleted} msgs deleted, ${r.errors} errors`
      );
    }
    console.log('═══════════════════════════════════════');

  } finally {
    await destroyBot();
  }
}

// ── Per-game processing ───────────────────────────────────────

async function processGame(game, updates, deletes) {
  const cfg   = GAMES[game];
  const stats = { inserted: 0, updated: 0, deleted: 0, sourceDeleted: 0, errors: 0 };

  console.log(`\n[sync] ── ${game} (${updates.length} update(s), ${deletes.length} delete(s)) ──`);

  // Load state from pinned message in #lb-update
  let stateMsg = null;
  try {
    stateMsg = await fetchStateMessage(LISTENING_CHANNEL, game);
  } catch (err) {
    console.warn(`[sync] ${game}: could not fetch pinned state: ${err.message}`);
  }

  const state = decodeState(stateMsg?.content ?? null);
  console.log(`[sync] ${game}: ${state.players.length} existing player(s) in state`);

  // Process updates first
  for (const { msg, data } of updates) {
    try {
      const before = state.players.length;
      const changed = upsertPlayer(state.players, data);
      if (changed) {
        state.players.length > before ? stats.inserted++ : stats.updated++;
      }

      await sleep(API_DELAY);
      if (await deleteMessage(msg)) {
        console.log(`[sync] ✓ Deleted update source message ${msg.id}`);
        stats.sourceDeleted++;
      } else {
        console.error(`[sync] ✗ Could not delete ${msg.id}`); stats.errors++;
      }
    } catch (err) {
      console.error(`[sync] ${game}: error on update ${msg.id}:`, err.message); stats.errors++;
    }
  }

  // Process deletes
  for (const { msg, data } of deletes) {
    try {
      const issuerTag = data.issuerId ? `<@${data.issuerId}>` : 'unknown staff';
      const removed   = deletePlayer(state.players, data);

      if (removed) {
        const removedTag = removed.discordId ? `<@${removed.discordId}>` : removed.playerName;
        console.log(`[sync] ${game}: removed ${removedTag} from leaderboard (issued by ${issuerTag})`);
        stats.deleted++;
      } else {
        console.warn(
          `[sync] ${game}: DELETE target not found — ` +
          `playerName:"${data.playerName}" discordId:"${data.discordId}" (issued by ${issuerTag})`
        );
      }

      await sleep(API_DELAY);
      if (await deleteMessage(msg)) {
        console.log(`[sync] ✓ Deleted delete-command source message ${msg.id}`);
        stats.sourceDeleted++;
      } else {
        console.error(`[sync] ✗ Could not delete ${msg.id}`); stats.errors++;
      }
    } catch (err) {
      console.error(`[sync] ${game}: error on delete command ${msg.id}:`, err.message); stats.errors++;
    }
  }

  // Sort + render
  const sorted   = cfg.sortFn(state.players);
  const rendered = renderLeaderboard(sorted, game);

  // Update public webhook leaderboard message
  try {
    if (cfg.messageId) {
      await editWebhookMessage(cfg.webhookUrl, cfg.messageId, rendered);
      console.log(`[sync] ${game}: leaderboard message updated`);
    } else {
      const newId = await postWebhookMessage(cfg.webhookUrl, rendered);
      cfg.messageId = newId;
      console.log(`\n[sync] ════════════════════════════════════`);
      console.log(`[sync] ⚠️  NEW MESSAGE ID — add to .env and GitHub Secrets:`);
      console.log(`[sync]    ${MSG_ID_KEYS[game]}=${newId}`);
      console.log(`[sync] ════════════════════════════════════\n`);
    }
  } catch (err) {
    console.error(`[sync] ${game}: failed to update leaderboard:`, err.message); stats.errors++;
  }

  // Save updated state as pinned message in #lb-update
  try {
    const newContent = encodeState(game, { players: state.players });
    if (stateMsg) {
      await updateStateMessage(LISTENING_CHANNEL, stateMsg.id, newContent);
    } else {
      await createStateMessage(LISTENING_CHANNEL, newContent);
      console.log(`[sync] ${game}: created pinned state message in #lb-update`);
    }
  } catch (err) {
    console.error(`[sync] ${game}: failed to save state:`, err.message); stats.errors++;
  }

  console.log(
    `[sync] ${game}: done — +${stats.inserted} ins, ~${stats.updated} upd, ` +
    `-${stats.deleted} del, ${stats.sourceDeleted} msgs cleaned, ${stats.errors} errors`
  );
  return stats;
}

// ── Run ───────────────────────────────────────────────────────

main().catch(err => {
  console.error('[sync] Fatal error:', err);
  process.exit(1);
});
