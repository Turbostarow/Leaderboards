// ============================================================
// src/renderer.js — Discord embed builder + sorting
//
// Public leaderboard messages are Discord EMBEDS (not plain text):
//   • Colored left sidebar (per game)
//   • Code block table — perfect column alignment
//   • All-caps game title as embed author
//   • Dynamic relative timestamps, updated every sync
//
// ============================================================

import { MR_RANKS, OW_RANKS, DL_RANKS, rankIndex } from './parser.js';

// ── Embed sidebar colors ──────────────────────────────────────
const COLORS = {
  MARVEL_RIVALS: 0xF5C400,  // yellow
  OVERWATCH:     0xD62828,  // red
  DEADLOCK:      0x7B4F2E,  // brown
};

const TITLES = {
  MARVEL_RIVALS: 'MARVEL RIVALS LEADERBOARD',
  OVERWATCH:     'OVERWATCH LEADERBOARD',
  DEADLOCK:      'DEADLOCK LEADERBOARD',
};

// ── Relative timestamps ───────────────────────────────────────

export function relativeTime(date) {
  const d  = date instanceof Date ? date : new Date(date);
  const ms = Date.now() - d.getTime();
  if (ms < 0) return 'just now';
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s  / 60);
  const h  = Math.floor(m  / 60);
  const dy = Math.floor(h  / 24);
  const w  = Math.floor(dy / 7);
  const mo = Math.floor(dy / 30);
  const y  = Math.floor(dy / 365);
  if (s  < 10)  return 'just now';
  if (s  < 60)  return `${s}s ago`;
  if (m  < 60)  return `${m}m ago`;
  if (h  < 24)  return `${h}h ago`;
  if (dy < 7)   return `${dy}d ago`;
  if (w  < 5)   return `${w}w ago`;
  if (mo < 12)  return `${mo}mo ago`;
  return `${y}y ago`;
}

// ── Rank emojis (kept for potential future use / tests) ───────
export function rankEmoji(name) {
  const MAP = {
    'bronze':'🟫','silver':'⚪','gold':'🟡','platinum':'🔵','diamond':'💎',
    'master':'🎖️','grandmaster':'👑','champion':'🏆','top 500':'⭐',
    'celestial':'✨','eternity':'♾️','one above all':'🌟',
    'initiate':'🔰','seeker':'🔍','alchemist':'⚗️','arcanist':'🔮',
    'ritualist':'📿','emissary':'💼','archon':'👤','oracle':'🧙',
    'phantom':'👻','ascendant':'🎖️','eternus':'♾️',
  };
  return MAP[name.toLowerCase()] ?? '❓';
}

// ── Sorting ───────────────────────────────────────────────────

export function sortMarvelRivals(players) {
  return [...players].sort((a, b) => {
    const rd = rankIndex(b.rankCurrent, MR_RANKS) - rankIndex(a.rankCurrent, MR_RANKS);
    if (rd !== 0) return rd;
    const td = a.tierCurrent - b.tierCurrent;
    if (td !== 0) return td;
    const pd = rankIndex(b.rankPeak, MR_RANKS) - rankIndex(a.rankPeak, MR_RANKS);
    if (pd !== 0) return pd;
    const ptd = a.tierPeak - b.tierPeak;
    if (ptd !== 0) return ptd;
    return new Date(b.date) - new Date(a.date);
  });
}

export function sortOverwatch(players) {
  return [...players].sort((a, b) => {
    const rd = rankIndex(b.rankCurrent, OW_RANKS) - rankIndex(a.rankCurrent, OW_RANKS);
    if (rd !== 0) return rd;
    const td = a.tierCurrent - b.tierCurrent;
    if (td !== 0) return td;
    const pd = rankIndex(b.rankPeak, OW_RANKS) - rankIndex(a.rankPeak, OW_RANKS);
    if (pd !== 0) return pd;
    const ptd = a.tierPeak - b.tierPeak;
    if (ptd !== 0) return ptd;
    return new Date(b.date) - new Date(a.date);
  });
}

export function sortDeadlock(players) {
  return [...players].sort((a, b) => {
    const rd = rankIndex(b.rankCurrent, DL_RANKS) - rankIndex(a.rankCurrent, DL_RANKS);
    if (rd !== 0) return rd;
    const td = b.tierCurrent - a.tierCurrent;
    if (td !== 0) return td;
    const vd = a.currentValue - b.currentValue;
    if (vd !== 0) return vd;
    return new Date(b.date) - new Date(a.date);
  });
}

// ── Column helpers ────────────────────────────────────────────

// Pad / truncate a string to exactly `len` chars
function col(s, len) {
  const str = String(s ?? '');
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

// Get the display name for the table (plain username or short ID)
function displayName(p) {
  if (p.displayName) return p.displayName;
  if (p.discordId)   return `id:${p.discordId.slice(-5)}`; // fallback: last 5 digits
  return p.playerName;
}

// ── Table builders ────────────────────────────────────────────

function buildMarvelRivalsTable(players) {
  // Columns:  POS(3) PLAYER(14) ROLE(11) RANK(14) PEAK(14) UPDATED(12)
  const H = `${col('POS',3)}  ${col('PLAYER',14)}  ${col('ROLE',11)}  ${col('RANK',14)}  ${col('PEAK',14)}  UPDATED`;
  const D = '─'.repeat(H.length);

  const rows = players.map((p, i) => {
    const pos     = col(i + 1, 3);
    const name    = col(displayName(p), 14);
    const role    = col(p.role, 11);
    const rank    = col(`${p.rankCurrent} ${p.tierCurrent}`, 14);
    const peak    = col(`${p.rankPeak} ${p.tierPeak}`, 14);
    const updated = relativeTime(p.date);
    return `${pos}  ${name}  ${role}  ${rank}  ${peak}  ${updated}`;
  });

  return { header: H, divider: D, rows };
}

function buildOverwatchTable(players) {
  // Columns: POS(3) PLAYER(14) ROLE(7) RANK+SR(16) PEAK+SR(16) UPDATED(12)
  const H = `${col('POS',3)}  ${col('PLAYER',14)}  ${col('ROLE',7)}  ${col('RANK (SR)',16)}  ${col('PEAK (SR)',16)}  UPDATED`;
  const D = '─'.repeat(H.length);

  const rows = players.map((p, i) => {
    const pos     = col(i + 1, 3);
    const name    = col(displayName(p), 14);
    const role    = col(p.role, 7);
    const curTier = p.rankCurrent === 'Top 500' ? `#${p.tierCurrent}` : p.tierCurrent;
    const pkTier  = p.rankPeak    === 'Top 500' ? `#${p.tierPeak}`    : p.tierPeak;
    const rank    = col(`${p.rankCurrent} ${curTier} ${p.currentValue}`, 16);
    const peak    = col(`${p.rankPeak} ${pkTier} ${p.peakValue}`, 16);
    const updated = relativeTime(p.date);
    return `${pos}  ${name}  ${role}  ${rank}  ${peak}  ${updated}`;
  });

  return { header: H, divider: D, rows };
}

function buildDeadlockTable(players) {
  // Columns: POS(3) PLAYER(14) HERO(10) RANK+PTS(16) UPDATED(12)
  const H = `${col('POS',3)}  ${col('PLAYER',14)}  ${col('HERO',10)}  ${col('RANK (PTS)',16)}  UPDATED`;
  const D = '─'.repeat(H.length);

  const rows = players.map((p, i) => {
    const pos     = col(i + 1, 3);
    const name    = col(displayName(p), 14);
    const hero    = col(p.hero, 10);
    const rank    = col(`${p.rankCurrent} ${p.tierCurrent} ${p.currentValue}`, 16);
    const updated = relativeTime(p.date);
    return `${pos}  ${name}  ${hero}  ${rank}  ${updated}`;
  });

  return { header: H, divider: D, rows };
}

const TABLE_BUILDERS = {
  MARVEL_RIVALS: buildMarvelRivalsTable,
  OVERWATCH:     buildOverwatchTable,
  DEADLOCK:      buildDeadlockTable,
};

// ── Main render — returns a Discord embed payload object ──────

export function renderLeaderboard(players, game) {
  const color = COLORS[game] ?? 0x2f3136;
  const title = TITLES[game] ?? game;

  // Empty state
  if (!players || players.length === 0) {
    return {
      embeds: [{
        color,
        author: { name: title },
        description: '*No players yet — post an update in #lb-update to get started!*',
        footer:    { text: `Last updated: ${new Date().toUTCString()}` },
        timestamp: new Date().toISOString(),
      }]
    };
  }

  // Build the table
  const builder = TABLE_BUILDERS[game];
  const { header, divider, rows } = builder(players);

  // Code block — perfect alignment
  const table = `\`\`\`\n${header}\n${divider}\n${rows.join('\n')}\n\`\`\``;

  const description = table;

  return {
    embeds: [{
      color,
      author:    { name: title },
      description,
      footer:    { text: `Last updated: ${new Date().toUTCString()}` },
      timestamp: new Date().toISOString(),
    }]
  };
}
