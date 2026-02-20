// ============================================================
// tests/sorting.test.js — 16 cases covering all tiebreakers
// ============================================================

import { sortMarvelRivals, sortOverwatch, sortDeadlock } from '../src/renderer.js';
import { runSuite, assertEqual } from './helpers.js';

const now    = new Date();
const older  = new Date(now - 864e5);
const newest = new Date(now.getTime() + 1000);

const mr = (name, rC, tC, rP, tP, date = now) =>
  ({ playerName: name, role: 'DPS', rankCurrent: rC, tierCurrent: tC, rankPeak: rP, tierPeak: tP, date });

const ow = (name, rC, tC, val, rP, tP, pVal, date = now) =>
  ({ playerName: name, role: 'DPS', rankCurrent: rC, tierCurrent: tC, currentValue: val, rankPeak: rP, tierPeak: tP, peakValue: pVal, date });

const dl = (name, rC, tC, val, date = now) =>
  ({ playerName: name, hero: 'Haze', rankCurrent: rC, tierCurrent: tC, currentValue: val, date });

export async function runSortingTests() {
  return runSuite('Sorting', [

    // ── Marvel Rivals ─────────────────────────────────────────

    { name: 'MR: higher rank wins (Grandmaster > Diamond)', fn: () => {
      const s = sortMarvelRivals([mr('B','Diamond',1,'Diamond',1), mr('A','Grandmaster',1,'Grandmaster',1)]);
      assertEqual(s[0].playerName, 'A', 'Grandmaster first');
    }},

    { name: 'MR: same rank — lower tier wins (tier 1 > tier 2)', fn: () => {
      const s = sortMarvelRivals([mr('B','Diamond',2,'Diamond',2), mr('A','Diamond',1,'Diamond',1)]);
      assertEqual(s[0].playerName, 'A', 'tier 1 first');
    }},

    { name: 'MR: same rank+tier — better peak wins', fn: () => {
      const s = sortMarvelRivals([mr('B','Diamond',1,'Diamond',1), mr('A','Diamond',1,'Grandmaster',1)]);
      assertEqual(s[0].playerName, 'A', 'better peak first');
    }},

    { name: 'MR: same rank+tier+peak — lower peak tier wins', fn: () => {
      const s = sortMarvelRivals([mr('B','Diamond',1,'Grandmaster',2), mr('A','Diamond',1,'Grandmaster',1)]);
      assertEqual(s[0].playerName, 'A', 'lower peak tier first');
    }},

    { name: 'MR: all same — most recent wins', fn: () => {
      const s = sortMarvelRivals([mr('B','Diamond',1,'Grandmaster',1,older), mr('A','Diamond',1,'Grandmaster',1,newest)]);
      assertEqual(s[0].playerName, 'A', 'more recent first');
    }},

    { name: 'MR: One Above All is highest rank', fn: () => {
      const s = sortMarvelRivals([mr('B','Eternity',1,'Eternity',1), mr('A','One Above All',1,'One Above All',1)]);
      assertEqual(s[0].playerName, 'A', 'OAA first');
    }},

    { name: 'MR: 5-player full sort', fn: () => {
      const s = sortMarvelRivals([
        mr('E', 'Bronze',   1, 'Bronze',    1),
        mr('C', 'Diamond',  2, 'Grandmaster',1),
        mr('A', 'Celestial',1, 'Eternity',   1),
        mr('D', 'Diamond',  1, 'Diamond',    1),
        mr('B', 'Celestial',2, 'Grandmaster',1),
      ]);
      assertEqual(s.map(p=>p.playerName), ['A','B','D','C','E'], 'order');
    }},

    // ── Overwatch ─────────────────────────────────────────────

    { name: 'OW: higher rank wins (Master > Diamond)', fn: () => {
      const s = sortOverwatch([ow('B','Diamond',1,3000,'Diamond',1,3000), ow('A','Master',1,3500,'Master',1,3500)]);
      assertEqual(s[0].playerName, 'A', 'Master first');
    }},

    { name: 'OW: Top 500 beats Champion', fn: () => {
      const s = sortOverwatch([ow('B','Champion',1,4200,'Champion',1,4200), ow('A','Top 500',100,4500,'Top 500',50,4600)]);
      assertEqual(s[0].playerName, 'A', 'Top 500 first');
    }},

    { name: 'OW: Top 500 — lower number wins (#50 > #200)', fn: () => {
      const s = sortOverwatch([ow('B','Top 500',200,4300,'Top 500',200,4300), ow('A','Top 500',50,4700,'Top 500',50,4700)]);
      assertEqual(s[0].playerName, 'A', '#50 first');
    }},

    { name: 'OW: same rank — tiebreak by peak rank', fn: () => {
      const s = sortOverwatch([ow('B','Diamond',1,3100,'Diamond',1,3100), ow('A','Diamond',1,3100,'Master',1,3500)]);
      assertEqual(s[0].playerName, 'A', 'better peak first');
    }},

    // ── Deadlock ──────────────────────────────────────────────

    { name: 'DL: higher rank wins (Oracle > Archon)', fn: () => {
      const s = sortDeadlock([dl('B','Archon',4,1200), dl('A','Oracle',1,5000)]);
      assertEqual(s[0].playerName, 'A', 'Oracle first');
    }},

    { name: 'DL: same rank — HIGHER tier wins (tier 6 > tier 5)', fn: () => {
      const s = sortDeadlock([dl('B','Archon',4,1200), dl('A','Archon',6,900)]);
      assertEqual(s[0].playerName, 'A', 'tier 6 first');
    }},

    { name: 'DL: same rank+tier — lower value wins', fn: () => {
      const s = sortDeadlock([dl('B','Archon',4,1500), dl('A','Archon',4,900)]);
      assertEqual(s[0].playerName, 'A', 'lower value first');
    }},

    { name: 'DL: all same — most recent wins', fn: () => {
      const s = sortDeadlock([dl('B','Archon',4,1200,older), dl('A','Archon',4,1200,newest)]);
      assertEqual(s[0].playerName, 'A', 'more recent first');
    }},

    { name: 'DL: Eternus is highest rank', fn: () => {
      const s = sortDeadlock([dl('B','Ascendant',6,100), dl('A','Eternus',1,9000)]);
      assertEqual(s[0].playerName, 'A', 'Eternus first');
    }},

  ]);
}
