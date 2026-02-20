// ============================================================
// tests/storage.test.js — 12 cases
// ============================================================

import { encodeState, decodeState, stateMarker, upsertPlayer } from '../src/storage.js';
import { runSuite, assertEqual, assert } from './helpers.js';

export async function runStorageTests() {
  return runSuite('Storage', [

    { name: 'stateMarker: correct prefix format', fn: () => {
      assertEqual(stateMarker('MARVEL_RIVALS'), 'LB_STATE:MARVEL_RIVALS:', 'MR marker');
      assertEqual(stateMarker('OVERWATCH'),     'LB_STATE:OVERWATCH:',     'OW marker');
      assertEqual(stateMarker('DEADLOCK'),      'LB_STATE:DEADLOCK:',      'DL marker');
    }},

    { name: 'encodeState: output starts with marker + valid JSON', fn: () => {
      const out = encodeState('OVERWATCH', { players: [{ playerName: 'Alpha' }] });
      assert(out.startsWith('LB_STATE:OVERWATCH:'), 'marker prefix');
      assert(out.includes('Alpha'), 'player name in JSON');
      // verify it is valid JSON after the marker
      const json = out.slice('LB_STATE:OVERWATCH:'.length);
      assert(() => { JSON.parse(json); return true; }, 'valid JSON');
    }},

    { name: 'decodeState: correct round-trip', fn: () => {
      const state = { players: [{ playerName: 'X', rankCurrent: 'Diamond', date: new Date().toISOString() }] };
      const decoded = decodeState(encodeState('DEADLOCK', state));
      assertEqual(decoded.players.length, 1, 'player count');
      assertEqual(decoded.players[0].playerName, 'X', 'name');
      assertEqual(decoded.players[0].rankCurrent, 'Diamond', 'rank');
    }},

    { name: 'decodeState: null input → empty state', fn: () => {
      assertEqual(decodeState(null).players, [], 'null');
    }},

    { name: 'decodeState: no marker → empty state', fn: () => {
      assertEqual(decodeState('random text without marker').players, [], 'no marker');
    }},

    { name: 'decodeState: restores date strings to Date objects', fn: () => {
      const iso = '2026-01-15T10:00:00.000Z';
      const decoded = decodeState(encodeState('MARVEL_RIVALS', { players: [{ playerName: 'Y', date: iso }] }));
      assert(decoded.players[0].date instanceof Date, 'is Date');
      assertEqual(decoded.players[0].date.toISOString(), iso, 'ISO preserved');
    }},

    { name: 'decodeState: corrupted JSON → empty state (no crash)', fn: () => {
      assertEqual(decodeState('LB_STATE:DEADLOCK:{broken!!!').players, [], 'graceful fallback');
    }},

    { name: 'encodeState → decodeState: multi-player round-trip', fn: () => {
      const state = { players: [
        { playerName: 'A', rankCurrent: 'Diamond', date: new Date().toISOString() },
        { playerName: 'B', rankCurrent: 'Grandmaster', date: new Date().toISOString() },
      ]};
      const decoded = decodeState(encodeState('MARVEL_RIVALS', state));
      assertEqual(decoded.players.length, 2, 'count');
      assertEqual(decoded.players[0].playerName, 'A', 'player A');
      assertEqual(decoded.players[1].rankCurrent, 'Grandmaster', 'player B rank');
    }},

    { name: 'upsertPlayer: inserts new player', fn: () => {
      const players = [];
      const ok = upsertPlayer(players, { playerName: 'New', rankCurrent: 'Gold', date: new Date() });
      assert(ok, 'returns true');
      assertEqual(players.length, 1, '1 player');
      assertEqual(players[0].playerName, 'New', 'name');
    }},

    { name: 'upsertPlayer: updates existing with newer date', fn: () => {
      const players = [{ playerName: 'Turbo', rankCurrent: 'Diamond', date: new Date(Date.now()-864e5).toISOString() }];
      const ok = upsertPlayer(players, { playerName: 'Turbo', rankCurrent: 'Grandmaster', date: new Date() });
      assert(ok, 'returns true');
      assertEqual(players.length, 1, 'no duplicate');
      assertEqual(players[0].rankCurrent, 'Grandmaster', 'rank updated');
    }},

    { name: 'upsertPlayer: rejects stale update (older date)', fn: () => {
      const players = [{ playerName: 'Alpha', rankCurrent: 'Master', date: new Date().toISOString() }];
      const ok = upsertPlayer(players, { playerName: 'Alpha', rankCurrent: 'Bronze', date: new Date(0) });
      assert(!ok, 'returns false');
      assertEqual(players[0].rankCurrent, 'Master', 'rank unchanged');
    }},

    { name: 'upsertPlayer: case-insensitive name matching (no duplicates)', fn: () => {
      const players = [{ playerName: 'turbo', rankCurrent: 'Diamond', date: new Date().toISOString() }];
      upsertPlayer(players, { playerName: 'TURBO', rankCurrent: 'Grandmaster', date: new Date(Date.now()+1000) });
      assertEqual(players.length, 1, 'no duplicate from case difference');
    }},

  ]);
}
