// ============================================================
// src/discord.js — Discord API wrapper
// ============================================================

import { Client, GatewayIntentBits, Partials } from 'discord.js';

const DEFAULT_DELAY = parseInt(process.env.API_DELAY_MS ?? '1000', 10);
const FETCH_LIMIT   = Math.min(parseInt(process.env.FETCH_LIMIT ?? '50', 10), 100);

let client = null;

// ── Bot lifecycle ─────────────────────────────────────────────

export async function loginBot(token) {
  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  await new Promise((resolve, reject) => {
    client.once('clientReady', resolve);
    client.once('error', reject);
    client.login(token).catch(reject);
  });

  console.log(`[discord] Logged in as ${client.user.tag} (ID: ${client.user.id})`);
  return client;
}

export async function destroyBot() {
  if (client) { await client.destroy(); client = null; }
}

// ── Message fetching ──────────────────────────────────────────

export async function fetchMessages(channelId) {
  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error(`Channel ${channelId} not found`);
  const col = await channel.messages.fetch({ limit: FETCH_LIMIT });
  const msgs = [...col.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  console.log(`[discord] Fetched ${msgs.length} message(s) from #${channel.name}`);
  return msgs;
}

// ── Message deletion ──────────────────────────────────────────

export async function deleteMessage(msg, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await msg.delete();
      return true;
    } catch (err) {
      if (err.status === 429) {
        const wait = (err.retryAfter ?? 2) * 1000;
        console.warn(`[discord] Rate limited on delete, retry in ${wait}ms (${attempt}/${retries})`);
        await sleep(wait);
      } else if (err.code === 10008) {
        console.warn(`[discord] Message ${msg.id} already deleted`);
        return true;
      } else {
        console.error(`[discord] Delete failed for ${msg.id} (attempt ${attempt}):`, err.message);
        if (attempt === retries) return false;
        await sleep(DEFAULT_DELAY * attempt);
      }
    }
  }
  return false;
}

// ── Pinned state messages (private #lb-update channel) ────────

/**
 * Find the pinned state message for a game.
 * Returns { id, content } or null.
 */
export async function fetchStateMessage(channelId, game) {
  const channel = await client.channels.fetch(channelId);
  const pinned  = await channel.messages.fetchPinned();
  const marker  = `LB_STATE:${game}:`;
  const found   = [...pinned.values()].find(m => m.content.startsWith(marker));
  if (!found) {
    console.log(`[discord] No pinned state found for ${game} — will create one`);
    return null;
  }
  console.log(`[discord] Found pinned state for ${game} (msg ID: ${found.id})`);
  return { id: found.id, content: found.content };
}

/**
 * Create a new pinned state message in the listening channel.
 */
export async function createStateMessage(channelId, content) {
  const channel = await client.channels.fetch(channelId);
  const msg     = await channel.send(content);
  try {
    await msg.pin();
    console.log(`[discord] Pinned new state message: ${msg.id}`);
  } catch (err) {
    console.error(`[discord] Failed to pin state message — bot needs Manage Messages in #lb-update:`, err.message);
  }
  return msg;
}

/**
 * Edit an existing pinned state message.
 */
export async function updateStateMessage(channelId, messageId, content) {
  const channel = await client.channels.fetch(channelId);
  const msg     = await channel.messages.fetch(messageId);
  await msg.edit(content);
  console.log(`[discord] Updated pinned state message: ${messageId}`);
}

// ── Webhook operations ────────────────────────────────────────

export async function fetchWebhookMessage(webhookUrl, messageId) {
  if (!messageId) return null;
  const { id, token } = parseWebhook(webhookUrl);
  const res = await fetchWithBackoff(`https://discord.com/api/v10/webhooks/${id}/${token}/messages/${messageId}`, { method: 'GET' });
  if (res.status === 404) return null;
  if (!res.ok) { console.error(`[discord] fetchWebhookMessage: HTTP ${res.status}`); return null; }
  const data = await res.json();
  return data.content ?? '';
}

export async function postWebhookMessage(webhookUrl, content) {
  const { id, token } = parseWebhook(webhookUrl);
  const res = await fetchWithBackoff(
    `https://discord.com/api/v10/webhooks/${id}/${token}?wait=true`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: cap(content) }) }
  );
  if (!res.ok) throw new Error(`postWebhookMessage: HTTP ${res.status} — ${await res.text()}`);
  const data = await res.json();
  console.log(`[discord] Posted new webhook message: ${data.id}`);
  return data.id;
}

export async function editWebhookMessage(webhookUrl, messageId, content) {
  const { id, token } = parseWebhook(webhookUrl);
  const res = await fetchWithBackoff(
    `https://discord.com/api/v10/webhooks/${id}/${token}/messages/${messageId}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: cap(content) }) }
  );
  if (!res.ok) throw new Error(`editWebhookMessage: HTTP ${res.status} — ${await res.text()}`);
  console.log(`[discord] Edited webhook message: ${messageId}`);
  return true;
}

// ── Helpers ───────────────────────────────────────────────────

function parseWebhook(url) {
  const m = url.match(/webhooks\/(\d+)\/([A-Za-z0-9_\-.]+)/);
  if (!m) throw new Error(`Invalid webhook URL: ${url}`);
  return { id: m[1], token: m[2] };
}

function cap(s) {
  if (s.length <= 2000) return s;
  return s.slice(0, 1985) + '\n…*(truncated)*';
}

export function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchWithBackoff(url, options, retries = 4) {
  for (let i = 1; i <= retries; i++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;
    const body = await res.json().catch(() => ({}));
    const wait = (body.retry_after ?? 2) * 1000;
    console.warn(`[discord] Rate limited — waiting ${wait}ms (attempt ${i}/${retries})`);
    await sleep(wait);
  }
  throw new Error(`Max retries exceeded for ${url}`);
}
