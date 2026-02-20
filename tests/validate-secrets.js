#!/usr/bin/env node
// ============================================================
// tests/validate-secrets.js
//
// Run after deployment to verify all GitHub Secrets / .env
// values are correct. Makes READ-ONLY calls to Discord API.
//
// Usage:  npm run test:secrets
// ============================================================

import 'dotenv/config';

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', B = '\x1b[1m', X = '\x1b[0m';

const ok   = m => console.log(`  ${G}✅ ${m}${X}`);
const fail = m => { console.error(`  ${R}❌ ${m}${X}`); failures++; };
const warn = m => console.warn(`  ${Y}⚠️  ${m}${X}`);
const info = m => console.log(`  ${C}ℹ️  ${m}${X}`);

let failures = 0;

// ── Validators ────────────────────────────────────────────────

function checkPresent(key, desc) {
  const v = process.env[key]?.trim();
  if (v) { ok(`${key} is set`); return v; }
  fail(`${key} is MISSING — ${desc}`); return null;
}

function checkWebhookUrl(url) {
  return url && /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url.trim());
}

function checkSnowflake(id) {
  if (!id || !id.trim()) return null;   // not set = optional
  return /^\d{17,20}$/.test(id.trim()); // set but invalid = false
}

function checkTokenFormat(t) {
  return t && t.split('.').length >= 3 && t.length >= 50;
}

// ── Live API checks ───────────────────────────────────────────

async function checkBotToken(token) {
  if (!token) return;
  try {
    const res  = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bot ${token}` } });
    if (res.ok) {
      const d = await res.json();
      ok(`DISCORD_TOKEN VALID — bot: "${d.username}" (ID: ${d.id})`);
    } else if (res.status === 401) {
      fail(`DISCORD_TOKEN INVALID — rejected by Discord (HTTP 401). Regenerate in Developer Portal.`);
    } else {
      warn(`DISCORD_TOKEN check returned HTTP ${res.status} — verify manually`);
    }
  } catch (e) { fail(`DISCORD_TOKEN check failed: ${e.message}`); }
}

async function checkChannel(token, channelId) {
  if (!token || !channelId) return;
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, { headers: { Authorization: `Bot ${token}` } });
    if (res.ok) {
      const d = await res.json();
      ok(`LISTENING_CHANNEL_ID accessible — #${d.name} (guild: ${d.guild_id})`);
    } else if (res.status === 403) {
      fail(`LISTENING_CHANNEL_ID: bot lacks access to channel ${channelId} (HTTP 403)\n     → Bot needs: View Channel, Read Message History, Manage Messages`);
    } else if (res.status === 404) {
      fail(`LISTENING_CHANNEL_ID: channel ${channelId} not found (HTTP 404)\n     → Wrong ID? Enable Developer Mode and re-copy.`);
    } else {
      warn(`LISTENING_CHANNEL_ID returned HTTP ${res.status}`);
    }
  } catch (e) { fail(`LISTENING_CHANNEL_ID check failed: ${e.message}`); }
}

async function checkWebhook(name, url) {
  if (!url) return;
  const m = url.match(/webhooks\/(\d+)\/([\w-]+)/);
  if (!m) return;
  try {
    const res = await fetch(`https://discord.com/api/v10/webhooks/${m[1]}/${m[2]}`, { method: 'GET' });
    if (res.ok) {
      const d = await res.json();
      ok(`${name} webhook LIVE — channel: ${d.channel_id}, name: "${d.name}"`);
    } else if (res.status === 401 || res.status === 403) {
      fail(`${name} webhook token INVALID or deleted (HTTP ${res.status})\n     → Recreate webhook in the channel settings.`);
    } else if (res.status === 404) {
      fail(`${name} webhook NOT FOUND (HTTP 404)\n     → Webhook was deleted. Create a new one and update the secret.`);
    } else {
      warn(`${name} webhook returned HTTP ${res.status}`);
    }
  } catch (e) { fail(`${name} webhook check failed: ${e.message}`); }
}

async function checkMessageId(name, url, msgId) {
  if (!url || !msgId?.trim()) { info(`${name}_MESSAGE_ID not set — bot will CREATE a new message on first run`); return; }
  const m = url.match(/webhooks\/(\d+)\/([\w-]+)/);
  if (!m) return;
  try {
    const res = await fetch(`https://discord.com/api/v10/webhooks/${m[1]}/${m[2]}/messages/${msgId}`, { method: 'GET' });
    if (res.ok) {
      ok(`${name}_MESSAGE_ID ${msgId} VALID — message exists`);
    } else if (res.status === 404) {
      fail(`${name}_MESSAGE_ID ${msgId} NOT FOUND (HTTP 404)\n     → Message was deleted. Clear this secret so the bot creates a new one.`);
    } else {
      warn(`${name}_MESSAGE_ID check returned HTTP ${res.status}`);
    }
  } catch (e) { fail(`${name}_MESSAGE_ID check failed: ${e.message}`); }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const LINE = '═'.repeat(52);
  console.log(`\n${B}${LINE}${X}`);
  console.log(`${B}  🔍 Discord Leaderboard — Secrets Validator${X}`);
  console.log(`${B}${LINE}${X}\n`);

  // ── 1. Presence ───────────────────────────────────────────

  console.log(`${B}[1/4] Required variables present?${X}`);
  const token     = checkPresent('DISCORD_TOKEN',             'Bot token from Developer Portal');
  const chanId    = checkPresent('LISTENING_CHANNEL_ID',      'Private #lb-update channel ID');
  const mrUrl     = checkPresent('MARVEL_RIVALS_WEBHOOK_URL', 'Webhook URL for MR leaderboard channel');
  const owUrl     = checkPresent('OVERWATCH_WEBHOOK_URL',     'Webhook URL for OW leaderboard channel');
  const dlUrl     = checkPresent('DEADLOCK_WEBHOOK_URL',      'Webhook URL for DL leaderboard channel');

  const mrMsgId   = process.env.MARVEL_RIVALS_MESSAGE_ID ?? '';
  const owMsgId   = process.env.OVERWATCH_MESSAGE_ID ?? '';
  const dlMsgId   = process.env.DEADLOCK_MESSAGE_ID ?? '';

  // ── 2. Format ─────────────────────────────────────────────

  console.log(`\n${B}[2/4] Value format validation${X}`);

  if (checkTokenFormat(token)) ok('DISCORD_TOKEN format looks valid');
  else if (token) fail('DISCORD_TOKEN format suspicious (expected X.Y.Z, 50+ chars)');

  const chanValid = checkSnowflake(chanId);
  if (chanValid === true)  ok('LISTENING_CHANNEL_ID is a valid snowflake');
  else if (chanValid === false) fail('LISTENING_CHANNEL_ID is not a valid snowflake (17-20 digits)');

  if (checkWebhookUrl(mrUrl)) ok('MARVEL_RIVALS_WEBHOOK_URL format valid');
  else if (mrUrl) fail('MARVEL_RIVALS_WEBHOOK_URL invalid (expected: https://discord.com/api/webhooks/ID/TOKEN)');

  if (checkWebhookUrl(owUrl)) ok('OVERWATCH_WEBHOOK_URL format valid');
  else if (owUrl) fail('OVERWATCH_WEBHOOK_URL invalid');

  if (checkWebhookUrl(dlUrl)) ok('DEADLOCK_WEBHOOK_URL format valid');
  else if (dlUrl) fail('DEADLOCK_WEBHOOK_URL invalid');

  for (const [k, v] of [['MARVEL_RIVALS_MESSAGE_ID', mrMsgId], ['OVERWATCH_MESSAGE_ID', owMsgId], ['DEADLOCK_MESSAGE_ID', dlMsgId]]) {
    const s = checkSnowflake(v);
    if (s === true)  ok(`${k} is a valid snowflake`);
    else if (s === null) info(`${k} not set — bot will create on first run`);
    else fail(`${k} invalid format (expected 17-20 digit number)`);
  }

  // ── 3. Live API ───────────────────────────────────────────

  console.log(`\n${B}[3/4] Live Discord API checks (read-only)${X}`);
  await checkBotToken(token);
  await checkChannel(token, chanId);
  await checkWebhook('MARVEL_RIVALS', mrUrl);
  await checkWebhook('OVERWATCH',     owUrl);
  await checkWebhook('DEADLOCK',      dlUrl);

  // ── 4. Message IDs ────────────────────────────────────────

  console.log(`\n${B}[4/4] Webhook message ID checks${X}`);
  await checkMessageId('MARVEL_RIVALS', mrUrl, mrMsgId);
  await checkMessageId('OVERWATCH',     owUrl, owMsgId);
  await checkMessageId('DEADLOCK',      dlUrl, dlMsgId);

  // ── Result ────────────────────────────────────────────────

  console.log(`\n${B}${LINE}${X}`);
  if (failures === 0) {
    console.log(`${G}${B}  ✅ All checks passed! Bot is ready.${X}`);
  } else {
    console.log(`${R}${B}  ❌ ${failures} check(s) failed. See errors above.${X}`);
    console.log(`\n${B}  Quick fixes:${X}`);
    console.log(`  • Token 401        → Regenerate in Discord Developer Portal → Bot`);
    console.log(`  • Webhook 401/404  → Recreate in Channel Settings → Integrations → Webhooks`);
    console.log(`  • Channel 403      → Bot needs View Channel + Read History + Manage Messages`);
    console.log(`  • Channel 404      → Re-copy channel ID with Developer Mode enabled`);
    console.log(`  • Message ID 404   → Clear the *_MESSAGE_ID secret (bot will recreate)`);
  }
  console.log(`${B}${LINE}${X}\n`);

  process.exit(failures > 0 ? 1 : 0);
}

main().catch(e => { console.error('Validator error:', e); process.exit(1); });
