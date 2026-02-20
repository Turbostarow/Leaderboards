// ============================================================
// src/sync.js — Main orchestrator
// Flow: login → fetch msgs → parse → upsert → delete → render → push
// State stored as pinned msgs in #lb-update (never in public channels)
// ============================================================

import 'dotenv/config';
import {
  loginBot, destroyBot, fetchMessages, deleteMessage,
  fetchStateMessage, createStateMessage, updateStateMessage,
  postWebhookMessage, editWebhookMessage,
  sleep,
} from './discord.js';
import { parseMessage }                              from './parser.js';
import { decodeState, encodeState, upsertPlayer }    from './storage.js';
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

    // ── 1. Fetch messages from listening channel ──────────────
    const messages = await fetchMessages(LISTENING_CHANNEL);
    if (messages.length === 0) {
      console.log('[sync] No messages found — nothing to do.');
      return;
    }

    // ── 2. Parse & group by game ──────────────────────────────
    const byGame   = { MARVEL_RIVALS: [], OVERWATCH: [], DEADLOCK: [] };
    let   skipped  = 0;

    for (const msg of messages) {
      const parsed = parseMessage(msg.content);
      if (parsed) {
        byGame[parsed.game].push({ msg, data: parsed });
      } else {
        skipped++;
        const preview  = msg.content.slice(0, 100).replace(/\n/g, '↵');
        const hasPrefix = /^LB_UPDATE_(MR|OW|DL):/i.test(msg.content.trim());
        if (hasPrefix) {
          console.warn(`[sync] ⚠️  PARSE FAILED (has prefix but validation failed):`);
          console.warn(`         "${preview}"`);
        } else {
          console.log(`[sync] Skipping non-LB message: "${preview}"`);
        }
      }
    }

    console.log(
      `[sync] Grouped — MR: ${byGame.MARVEL_RIVALS.length}, ` +
      `OW: ${byGame.OVERWATCH.length}, DL: ${byGame.DEADLOCK.length}, ` +
      `Skipped: ${skipped}`
    );

    // ── 3. Process each game ──────────────────────────────────
    const results = {};
    for (const [game, updates] of Object.entries(byGame)) {
      if (updates.length === 0) { console.log(`[sync] ${game}: no updates.`); continue; }
      results[game] = await processGame(game, updates);
      await sleep(API_DELAY);
    }

    // ── 4. Summary ────────────────────────────────────────────
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════');
    console.log(`  Sync complete in ${elapsed}s`);
    for (const [game, r] of Object.entries(results)) {
      console.log(`  ${game}: ${r.processed} processed, ${r.deleted} deleted, ${r.errors} errors`);
    }
    console.log('═══════════════════════════════════════');

  } finally {
    await destroyBot();
  }
}

// ── Per-game processing ───────────────────────────────────────

async function processGame(game, updates) {
  const cfg   = GAMES[game];
  const stats = { processed: 0, deleted: 0, errors: 0 };

  console.log(`\n[sync] ── ${game} (${updates.length} update(s)) ──`);

  // Load state from pinned message in #lb-update
  let stateMsg = null;
  try {
    stateMsg = await fetchStateMessage(LISTENING_CHANNEL, game);
  } catch (err) {
    console.warn(`[sync] ${game}: could not fetch pinned state: ${err.message}`);
  }

  const state = decodeState(stateMsg?.content ?? null);
  console.log(`[sync] ${game}: ${state.players.length} existing player(s) in state`);

  // Apply updates + delete source messages
  for (const { msg, data } of updates) {
    try {
      const changed = upsertPlayer(state.players, data);
      if (changed) stats.processed++;

      await sleep(API_DELAY);
      const deleted = await deleteMessage(msg);
      if (deleted) {
        console.log(`[sync] ✓ Deleted source message ${msg.id}`);
        stats.deleted++;
      } else {
        console.error(`[sync] ✗ Could not delete ${msg.id}`);
        stats.errors++;
      }
    } catch (err) {
      console.error(`[sync] ${game}: error on message ${msg.id}:`, err.message);
      stats.errors++;
    }
  }

  // Sort + render (clean display — no JSON, no state bleed)
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
    console.error(`[sync] ${game}: failed to update leaderboard message:`, err.message);
    stats.errors++;
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
    console.error(`[sync] ${game}: failed to save state:`, err.message);
    stats.errors++;
  }

  console.log(`[sync] ${game}: done — processed:${stats.processed} deleted:${stats.deleted} errors:${stats.errors}`);
  return stats;
}

// ── Run ───────────────────────────────────────────────────────

main().catch(err => {
  console.error('[sync] Fatal error:', err);
  process.exit(1);
});
