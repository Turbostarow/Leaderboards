// ============================================================
// src/parser.js — Parse rank update messages for all 3 games
// ============================================================

// ── Rank lists (ascending — higher index = better rank) ──────

export const MR_RANKS = [
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond',
  'Grandmaster', 'Celestial', 'Eternity', 'One Above All',
];

export const OW_RANKS = [
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond',
  'Master', 'Grandmaster', 'Champion', 'Top 500',
];

export const DL_RANKS = [
  'Initiate', 'Seeker', 'Alchemist', 'Arcanist',
  'Ritualist', 'Emissary', 'Archon', 'Oracle',
  'Phantom', 'Ascendant', 'Eternus',
];

function buildAlt(ranks) {
  return [...ranks].reverse().map(r => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
}
const mrRankAlt = buildAlt(MR_RANKS);
const owRankAlt = buildAlt(OW_RANKS);
const dlRankAlt = buildAlt(DL_RANKS);

// ── Helpers ───────────────────────────────────────────────────

function sanitise(s) {
  return String(s).replace(/[<>"';()]/g, '').trim();
}

function normaliseRank(raw, list) {
  const lower = raw.toLowerCase().trim();
  return list.find(r => r.toLowerCase() === lower) || null;
}

export function rankIndex(name, list) {
  return list.findIndex(r => r.toLowerCase() === name.toLowerCase());
}

// ── Discord formatting helpers ────────────────────────────────

/**
 * Extract the first Discord user ID from a raw message string.
 * Handles <@123456> and <@!123456> (nickname mentions).
 * Returns the ID string or null.
 */
function extractDiscordId(s) {
  const m = s.match(/<@!?(\d{17,20})>/);
  return m ? m[1] : null;
}

/**
 * Strip Discord mentions and custom emoji markup for clean regex parsing.
 *   <@123456>    → removed (ID already captured)
 *   <:name:123>  → 'name' (emoji name kept, e.g. :strategist: → strategist)
 *   multi-spaces → single space
 */
function cleanBody(s) {
  return s
    .replace(/<@!?\d+>/g, '')
    .replace(/<:([\w]+):\d+>/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Extract playerName, role, and rest from the cleaned body.
 *
 * Two supported formats:
 *   Plain:   @PlayerName role <ranks and date>
 *   Mention: (mention stripped)  role <ranks and date>   ← name comes from discordId
 *
 * When discordId is present, the mention was stripped so the body
 * starts directly with the role. We use discordId as the storage key.
 */
function extractNameRoleRest(body, discordId, game) {
  if (discordId) {
    // Mention format — body is "role Rank tier ..."
    const m = body.match(/^(\S+)\s+(.+)$/);
    if (!m) {
      console.warn(`[parser] ${game}: could not extract role/rest after mention. Body: "${body.slice(0, 100)}"`);
      return null;
    }
    return {
      // Use discordId as the dedup key so mention and plain-name updates merge correctly
      playerName: discordId,
      role: sanitise(m[1]),
      rest: m[2],
    };
  } else {
    // Plain format — body is "@?PlayerName role Rank tier ..."
    const m = body.match(/^@?(.+?)\s+(\S+)\s+(.+)$/);
    if (!m) {
      console.warn(`[parser] ${game}: could not extract name/role/rest. Body: "${body.slice(0, 100)}"`);
      return null;
    }
    return {
      playerName: sanitise(m[1]),
      role: sanitise(m[2]),
      rest: m[3],
    };
  }
}

// ── Date parsing ──────────────────────────────────────────────

export function parseDate(raw) {
  if (!raw || typeof raw !== 'string') return new Date();
  const s = raw.trim().toLowerCase();

  if (s === 'now' || s === 'just now') return new Date();
  if (s === 'today') { const d = new Date(); d.setHours(0,0,0,0); return d; }
  if (s === 'yesterday') { const d = new Date(); d.setDate(d.getDate()-1); d.setHours(0,0,0,0); return d; }

  // "X unit(s) ago"
  const rel = s.match(/^(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/);
  if (rel) {
    const n  = parseInt(rel[1], 10);
    const ms = { second:1e3, minute:6e4, hour:36e5, day:864e5, week:7*864e5, month:30*864e5, year:365*864e5 }[rel[2]];
    return new Date(Date.now() - n * ms);
  }

  // Discord timestamp <t:UNIX:R>
  const dt = raw.trim().match(/^<t:(\d+)(?::[A-Za-z])?>/);
  if (dt) return new Date(parseInt(dt[1], 10) * 1000);

  // "Feb 14 2026"
  const nat = raw.trim().match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/);
  if (nat) { const d = new Date(`${nat[1]} ${nat[2]}, ${nat[3]}`); if (!isNaN(d)) return d; }

  // ISO / standard
  const iso = new Date(raw.trim());
  if (!isNaN(iso)) return iso;

  console.warn(`[parser] Could not parse date: "${raw}" — using now`);
  return new Date();
}

// ── Marvel Rivals ─────────────────────────────────────────────
// Plain:   LB_UPDATE_MR: @PlayerName role Rank tier PeakRank peakTier date
// Mention: LB_UPDATE_MR: <@discordId> role Rank tier PeakRank peakTier date

export function parseMarvelRivals(content) {
  const raw       = content.replace(/^\s*LB_UPDATE_MR:\s*/i, '').trim();
  const discordId = extractDiscordId(raw);
  const body      = cleanBody(raw);

  const extracted = extractNameRoleRest(body, discordId, 'MR');
  if (!extracted) return null;
  const { playerName, role, rest } = extracted;

  const pat = new RegExp(`^(${mrRankAlt})\\s+(\\d+)\\s+(${mrRankAlt})\\s+(\\d+)\\s+(.+)$`, 'i');
  const m = rest.match(pat);
  if (!m) {
    console.warn(`[parser] MR: rank pattern failed on: "${rest.slice(0, 100)}"`);
    console.warn(`[parser] MR: valid ranks: ${MR_RANKS.join(', ')}`);
    console.warn(`[parser] MR: expected: Rank tier PeakRank peakTier date`);
    return null;
  }

  const [, rCur, tCurRaw, rPeak, tPeakRaw, dateRaw] = m;
  const rankCurrent = normaliseRank(rCur, MR_RANKS);
  const rankPeak    = normaliseRank(rPeak, MR_RANKS);
  if (!rankCurrent || !rankPeak) { console.warn(`[parser] MR: unknown rank — current:"${rCur}" peak:"${rPeak}"`); return null; }

  const tierCurrent = parseInt(tCurRaw, 10);
  const tierPeak    = parseInt(tPeakRaw, 10);
  if (tierCurrent < 1 || tierCurrent > 3) { console.warn(`[parser] MR: tierCurrent ${tierCurrent} out of range 1-3`); return null; }
  if (tierPeak    < 1 || tierPeak    > 3) { console.warn(`[parser] MR: tierPeak ${tierPeak} out of range 1-3`);    return null; }

  return { game:'MARVEL_RIVALS', playerName, discordId, role, rankCurrent, tierCurrent, rankPeak, tierPeak, date:parseDate(dateRaw), dateRaw:dateRaw.trim() };
}

// ── Overwatch ─────────────────────────────────────────────────
// Plain:   LB_UPDATE_OW: @PlayerName role Rank tier SR PeakRank peakTier peakSR date
// Mention: LB_UPDATE_OW: <@discordId> role Rank tier SR PeakRank peakTier peakSR date

export function parseOverwatch(content) {
  const raw       = content.replace(/^\s*LB_UPDATE_OW:\s*/i, '').trim();
  const discordId = extractDiscordId(raw);
  const body      = cleanBody(raw);

  const extracted = extractNameRoleRest(body, discordId, 'OW');
  if (!extracted) return null;
  const { playerName, role, rest } = extracted;

  const pat = new RegExp(`^(${owRankAlt})\\s+(\\d+)\\s+(\\d+)\\s+(${owRankAlt})\\s+(\\d+)\\s+(\\d+)\\s+(.+)$`, 'i');
  const m = rest.match(pat);
  if (!m) {
    console.warn(`[parser] OW: rank pattern failed on: "${rest.slice(0, 100)}"`);
    console.warn(`[parser] OW: valid ranks: ${OW_RANKS.join(', ')}`);
    console.warn(`[parser] OW: expected: Rank tier SR PeakRank peakTier peakSR date`);
    return null;
  }

  const [, rCur, tCurRaw, valRaw, rPeak, tPeakRaw, peakValRaw, dateRaw] = m;
  const rankCurrent = normaliseRank(rCur, OW_RANKS);
  const rankPeak    = normaliseRank(rPeak, OW_RANKS);
  if (!rankCurrent || !rankPeak) { console.warn(`[parser] OW: unknown rank — current:"${rCur}" peak:"${rPeak}"`); return null; }

  const tierCurrent  = parseInt(tCurRaw, 10);
  const tierPeak     = parseInt(tPeakRaw, 10);
  const currentValue = parseInt(valRaw, 10);
  const peakValue    = parseInt(peakValRaw, 10);

  const isTop500C = rankCurrent === 'Top 500';
  const isTop500P = rankPeak    === 'Top 500';
  if (!isTop500C && (tierCurrent < 1 || tierCurrent > 5)) { console.warn(`[parser] OW: tierCurrent ${tierCurrent} invalid for ${rankCurrent} (1-5)`); return null; }
  if (!isTop500P && (tierPeak   < 1 || tierPeak    > 5)) { console.warn(`[parser] OW: tierPeak ${tierPeak} invalid for ${rankPeak} (1-5)`);        return null; }

  return { game:'OVERWATCH', playerName, discordId, role, rankCurrent, tierCurrent, currentValue, rankPeak, tierPeak, peakValue, date:parseDate(dateRaw), dateRaw:dateRaw.trim() };
}

// ── Deadlock ──────────────────────────────────────────────────
// Plain:   LB_UPDATE_DL: @PlayerName hero Rank tier value date
// Mention: LB_UPDATE_DL: <@discordId> hero Rank tier value date

export function parseDeadlock(content) {
  const raw       = content.replace(/^\s*LB_UPDATE_DL:\s*/i, '').trim();
  const discordId = extractDiscordId(raw);
  const body      = cleanBody(raw);

  const extracted = extractNameRoleRest(body, discordId, 'DL');
  if (!extracted) return null;
  // For DL, "role" field is the hero name
  const { playerName, role: hero, rest } = extracted;

  const pat = new RegExp(`^(${dlRankAlt})\\s+(\\d+)\\s+(\\d+)\\s+(.+)$`, 'i');
  const m = rest.match(pat);
  if (!m) {
    console.warn(`[parser] DL: rank pattern failed on: "${rest.slice(0, 100)}"`);
    console.warn(`[parser] DL: valid ranks: ${DL_RANKS.join(', ')}`);
    console.warn(`[parser] DL: expected: Rank tier value date`);
    return null;
  }

  const [, rCur, tCurRaw, valRaw, dateRaw] = m;
  const rankCurrent = normaliseRank(rCur, DL_RANKS);
  if (!rankCurrent) { console.warn(`[parser] DL: unknown rank: "${rCur}"`); return null; }

  const tierCurrent  = parseInt(tCurRaw, 10);
  const currentValue = parseInt(valRaw, 10);
  if (tierCurrent < 1 || tierCurrent > 6) { console.warn(`[parser] DL: tier ${tierCurrent} out of range 1-6`); return null; }

  return { game:'DEADLOCK', playerName, discordId, hero, rankCurrent, tierCurrent, currentValue, date:parseDate(dateRaw), dateRaw:dateRaw.trim() };
}

// ── Unified entry point ───────────────────────────────────────

export function parseMessage(content) {
  if (typeof content !== 'string') return null;
  const t = content.trim();
  if (/^LB_UPDATE_MR:/i.test(t)) return parseMarvelRivals(t);
  if (/^LB_UPDATE_OW:/i.test(t)) return parseOverwatch(t);
  if (/^LB_UPDATE_DL:/i.test(t)) return parseDeadlock(t);
  return null;
}
