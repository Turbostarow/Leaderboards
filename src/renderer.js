// ============================================================
// src/renderer.js — Leaderboard display + sorting
// ============================================================

import { MR_RANKS, OW_RANKS, DL_RANKS, rankIndex } from './parser.js';

// ── Rank emojis ───────────────────────────────────────────────

const RANK_EMOJIS = {
  'bronze':        '🟫',
  'silver':        '⚪',
  'gold':          '🟡',
  'platinum':      '🔵',
  'diamond':       '💎',
  'master':        '🎖️',
  'grandmaster':   '👑',
  'champion':      '🏆',
  'top 500':       '⭐',
  'celestial':     '✨',
  'eternity':      '♾️',
  'one above all': '🌟',
  'initiate':      '🔰',
  'seeker':        '🔍',
  'alchemist':     '⚗️',
  'arcanist':      '🔮',
  'ritualist':     '📿',
  'emissary':      '💼',
  'archon':        '👤',
  'oracle':        '🧙',
  'phantom':       '👻',
  'ascendant':     '🎖️',
  'eternus':       '♾️',
};

export function rankEmoji(name) {
  return RANK_EMOJIS[name.toLowerCase()] ?? '❓';
}

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
  if (s  < 60)  return `${s} seconds ago`;
  if (m  < 60)  return `${m} minute${m  === 1 ? '' : 's'} ago`;
  if (h  < 24)  return `${h} hour${h    === 1 ? '' : 's'} ago`;
  if (dy < 7)   return `${dy} day${dy   === 1 ? '' : 's'} ago`;
  if (w  < 5)   return `${w} week${w    === 1 ? '' : 's'} ago`;
  if (mo < 12)  return `${mo} month${mo === 1 ? '' : 's'} ago`;
  return `${y} year${y === 1 ? '' : 's'} ago`;
}

// ── Player mention ────────────────────────────────────────────

/**
 * Returns a Discord ping (<@ID>) if a discordId is stored,
 * otherwise falls back to plain bold @Name.
 */
function mention(p) {
  return p.discordId ? `<@${p.discordId}>` : `**@${p.playerName}**`;
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
    const td = b.tierCurrent - a.tierCurrent;   // higher tier = better in DL
    if (td !== 0) return td;
    const vd = a.currentValue - b.currentValue; // lower value = better
    if (vd !== 0) return vd;
    return new Date(b.date) - new Date(a.date);
  });
}

// ── Render ────────────────────────────────────────────────────

const HEADERS = {
  MARVEL_RIVALS: '## 🦸 Marvel Rivals Leaderboard',
  OVERWATCH:     '## 🔫 Overwatch Leaderboard',
  DEADLOCK:      '## 🔒 Deadlock Leaderboard',
};

export function renderLeaderboard(players, game) {
  const header = HEADERS[game] ?? `## ${game} Leaderboard`;
  const ts     = new Date().toUTCString();

  if (!players || players.length === 0) {
    return `${header}\n\n*No players yet — post an update in #lb-update to get started!*\n\n-# Last updated: ${ts}`;
  }

  const lines = players.map((p, i) => renderRow(p, game, i + 1));
  return `${header}\n\n${lines.join('\n')}\n\n-# Last updated: ${ts}`;
}

function renderRow(p, game, pos) {
  const medal = pos <= 3 ? ['🥇', '🥈', '🥉'][pos - 1] : `\`${String(pos).padStart(2)}\``;
  const time  = relativeTime(p.date);
  const tag   = mention(p);  // <@ID> if available, else **@Name**

  if (game === 'MARVEL_RIVALS') {
    return (
      `${medal} ${tag} • ${p.role} • ` +
      `${rankEmoji(p.rankCurrent)} ${p.rankCurrent} ${p.tierCurrent} • ` +
      `Peak: ${rankEmoji(p.rankPeak)} ${p.rankPeak} ${p.tierPeak} • ` +
      `*${time}*`
    );
  }

  if (game === 'OVERWATCH') {
    const curTier  = p.rankCurrent === 'Top 500' ? `#${p.tierCurrent}` : `${p.tierCurrent}`;
    const peakTier = p.rankPeak    === 'Top 500' ? `#${p.tierPeak}`    : `${p.tierPeak}`;
    return (
      `${medal} ${tag} • ${p.role} • ` +
      `${rankEmoji(p.rankCurrent)} ${p.rankCurrent} ${curTier} (${p.currentValue} SR) • ` +
      `Peak: ${rankEmoji(p.rankPeak)} ${p.rankPeak} ${peakTier} (${p.peakValue} SR) • ` +
      `*${time}*`
    );
  }

  if (game === 'DEADLOCK') {
    return (
      `${medal} ${tag} • ${p.hero} • ` +
      `${rankEmoji(p.rankCurrent)} ${p.rankCurrent} ${p.tierCurrent} (${p.currentValue} pts) • ` +
      `*${time}*`
    );
  }

  return `${medal} ${tag} • *${time}*`;
}
