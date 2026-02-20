// ============================================================
// tests/parser.test.js — 25 cases
// ============================================================

import { parseMessage, parseDate } from '../src/parser.js';
import { runSuite, assertEqual, assertNull, assertNotNull, assert } from './helpers.js';

export async function runParserTests() {
  return runSuite('Parser', [

    // ── Marvel Rivals ─────────────────────────────────────────

    { name: 'MR: basic parse — all fields present', fn: () => {
      const r = parseMessage('LB_UPDATE_MR: @Turbostar Strategist Diamond 2 Grandmaster 1 yesterday');
      assertNotNull(r, 'result');
      assertEqual(r.game, 'MARVEL_RIVALS', 'game');
      assertEqual(r.playerName, 'Turbostar', 'playerName');
      assertEqual(r.role, 'Strategist', 'role');
      assertEqual(r.rankCurrent, 'Diamond', 'rankCurrent');
      assertEqual(r.tierCurrent, 2, 'tierCurrent');
      assertEqual(r.rankPeak, 'Grandmaster', 'rankPeak');
      assertEqual(r.tierPeak, 1, 'tierPeak');
      assertNotNull(r.date, 'date');
    }},

    { name: 'MR: case-insensitive prefix', fn: () => {
      assertNotNull(parseMessage('lb_update_mr: @Alice Duelist Gold 3 Platinum 2 today'), 'lowercase prefix');
    }},

    { name: 'MR: multi-word rank "One Above All"', fn: () => {
      const r = parseMessage('LB_UPDATE_MR: @God Duelist One Above All 1 One Above All 1 today');
      assertNotNull(r, 'result');
      assertEqual(r.rankCurrent, 'One Above All', 'current');
      assertEqual(r.rankPeak,    'One Above All', 'peak');
    }},

    { name: 'MR: Eternity rank', fn: () => {
      const r = parseMessage('LB_UPDATE_MR: @Z Strategist Eternity 1 Eternity 1 today');
      assertNotNull(r, 'result');
      assertEqual(r.rankCurrent, 'Eternity', 'rank');
    }},

    { name: 'MR: Celestial rank', fn: () => {
      const r = parseMessage('LB_UPDATE_MR: @X Vanguard Celestial 3 Celestial 1 today');
      assertNotNull(r, 'result');
      assertEqual(r.rankCurrent, 'Celestial', 'rank');
    }},

    { name: 'MR: bare Discord mention <@id> without plain name → null', fn: () => {
      // A raw <@id> mention with no plain @name — stripping it leaves no valid player name
      // Staff should use plain @Name not Discord mentions in update messages
      assertNull(parseMessage('LB_UPDATE_MR: <@244419214738194432> Strategist Diamond 2 Grandmaster 1 today'),
        'bare mention without plain name should fail');
    }},

    { name: 'MR: tier > 3 rejected', fn: () => {
      assertNull(parseMessage('LB_UPDATE_MR: @Bad Duelist Diamond 5 Grandmaster 1 today'), 'tier 5 invalid');
    }},

    { name: 'MR: unknown rank rejected', fn: () => {
      assertNull(parseMessage('LB_UPDATE_MR: @Bad Duelist FakeRank 1 Grandmaster 1 today'), 'fake rank invalid');
    }},

    { name: 'MR: missing date → null', fn: () => {
      assertNull(parseMessage('LB_UPDATE_MR: @Bad Duelist Diamond 1 Grandmaster 1'), 'no date');
    }},

    // ── Overwatch ─────────────────────────────────────────────

    { name: 'OW: basic parse — all fields', fn: () => {
      const r = parseMessage('LB_UPDATE_OW: @Alpha Tank Diamond 3 3200 Master 2 3400 2 days ago');
      assertNotNull(r, 'result');
      assertEqual(r.game, 'OVERWATCH', 'game');
      assertEqual(r.rankCurrent, 'Diamond', 'rankCurrent');
      assertEqual(r.tierCurrent, 3, 'tierCurrent');
      assertEqual(r.currentValue, 3200, 'currentValue');
      assertEqual(r.rankPeak, 'Master', 'rankPeak');
      assertEqual(r.peakValue, 3400, 'peakValue');
    }},

    { name: 'OW: Top 500 tier is rank number', fn: () => {
      const r = parseMessage('LB_UPDATE_OW: @Pro DPS Top 500 47 4800 Top 500 12 4900 today');
      assertNotNull(r, 'result');
      assertEqual(r.rankCurrent, 'Top 500', 'rank');
      assertEqual(r.tierCurrent, 47, 'tier = rank number');
    }},

    { name: 'OW: Champion rank', fn: () => {
      const r = parseMessage('LB_UPDATE_OW: @C Support Champion 1 4100 Champion 1 4200 today');
      assertNotNull(r, 'result');
      assertEqual(r.rankCurrent, 'Champion', 'rank');
    }},

    { name: 'OW: tier > 5 rejected for non-Top500', fn: () => {
      assertNull(parseMessage('LB_UPDATE_OW: @Bad DPS Diamond 6 3100 Master 1 3400 today'), 'tier 6 invalid');
    }},

    // ── Deadlock ──────────────────────────────────────────────

    { name: 'DL: basic parse — all fields', fn: () => {
      const r = parseMessage('LB_UPDATE_DL: @Player2 Haze Archon 4 1200 Feb 14 2026');
      assertNotNull(r, 'result');
      assertEqual(r.game, 'DEADLOCK', 'game');
      assertEqual(r.hero, 'Haze', 'hero');
      assertEqual(r.rankCurrent, 'Archon', 'rank');
      assertEqual(r.tierCurrent, 4, 'tier');
      assertEqual(r.currentValue, 1200, 'value');
    }},

    { name: 'DL: tier 6 valid (Deadlock max)', fn: () => {
      assertNotNull(parseMessage('LB_UPDATE_DL: @X Dynamo Eternus 6 9999 today'), 'tier 6 ok');
    }},

    { name: 'DL: tier 7 rejected', fn: () => {
      assertNull(parseMessage('LB_UPDATE_DL: @X Haze Archon 7 1200 today'), 'tier 7 invalid');
    }},

    { name: 'DL: Phantom rank', fn: () => {
      const r = parseMessage('LB_UPDATE_DL: @Ghost Geist Phantom 3 5000 yesterday');
      assertNotNull(r, 'result');
      assertEqual(r.rankCurrent, 'Phantom', 'rank');
    }},

    { name: 'DL: natural date "Feb 14 2026"', fn: () => {
      const r = parseMessage('LB_UPDATE_DL: @X Haze Archon 4 1200 Feb 14 2026');
      assertNotNull(r, 'result');
      assertEqual(r.date.getFullYear(), 2026, 'year');
      assertEqual(r.date.getMonth(), 1, 'month (Feb=1)');
      assertEqual(r.date.getDate(), 14, 'day');
    }},

    // ── Misc / edge cases ─────────────────────────────────────

    { name: 'Unknown prefix → null', fn: () => {
      assertNull(parseMessage('LB_UPDATE_UNKNOWN: @X Tank Diamond 1 today'), 'unknown prefix');
    }},

    { name: 'Empty string → null', fn: () => {
      assertNull(parseMessage(''), 'empty string');
    }},

    { name: 'Sanitisation: removes < > from player name', fn: () => {
      const r = parseMessage('LB_UPDATE_MR: @<evil>Player Duelist Diamond 1 Grandmaster 1 today');
      assertNotNull(r, 'parsed');
      assert(!r.playerName.includes('<'), 'no <');
      assert(!r.playerName.includes('>'), 'no >');
    }},

    // ── parseDate ─────────────────────────────────────────────

    { name: 'parseDate: "just now"', fn: () => {
      assert(Date.now() - parseDate('just now').getTime() < 1000, 'just now < 1s ago');
    }},
    { name: 'parseDate: "1 week ago"', fn: () => {
      const diff = (Date.now() - parseDate('1 week ago').getTime()) / 864e5;
      assert(diff > 6.9 && diff < 7.1, `~7 days, got ${diff}`);
    }},
    { name: 'parseDate: ISO string', fn: () => {
      const iso = '2026-01-15T10:00:00Z';
      assertEqual(parseDate(iso).toISOString(), new Date(iso).toISOString(), 'ISO round-trip');
    }},
    { name: 'parseDate: Discord <t:UNIX:R> timestamp', fn: () => {
      const unix = Math.floor(Date.now() / 1000) - 120;
      const d = parseDate(`<t:${unix}:R>`);
      const diff = (Date.now() - d.getTime()) / 1000;
      assert(diff > 115 && diff < 125, `~120s ago, got ${diff}`);
    }},

  ]);
}
