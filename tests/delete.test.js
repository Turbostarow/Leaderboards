// ============================================================
// tests/delete.test.js — 16 cases covering LB_DELETE commands
// ============================================================

import { parseDeleteCommand, parseAnyMessage } from '../src/parser.js';
import { deletePlayer }                         from '../src/storage.js';
import { runSuite, assertEqual, assertNull, assertNotNull, assert } from './helpers.js';

export async function runDeleteTests() {
  return runSuite('Delete', [

    // ── parseDeleteCommand ─────────────────────────────────────

    { name: 'MR delete by plain @name', fn: () => {
      const r = parseDeleteCommand('LB_DELETE_MR: @Turbostar');
      assertNotNull(r, 'result');
      assertEqual(r.type,        'DELETE',        'type');
      assertEqual(r.game,        'MARVEL_RIVALS', 'game');
      assertEqual(r.playerName,  'Turbostar',     'playerName');
      assertEqual(r.discordId,   null,            'no discordId');
    }},

    { name: 'OW delete by plain @name', fn: () => {
      const r = parseDeleteCommand('LB_DELETE_OW: @Alpha');
      assertNotNull(r, 'result');
      assertEqual(r.game, 'OVERWATCH', 'game');
      assertEqual(r.playerName, 'Alpha', 'playerName');
    }},

    { name: 'DL delete by plain @name', fn: () => {
      const r = parseDeleteCommand('LB_DELETE_DL: @Player2');
      assertNotNull(r, 'result');
      assertEqual(r.game, 'DEADLOCK', 'game');
      assertEqual(r.playerName, 'Player2', 'playerName');
    }},

    { name: 'Delete by Discord mention <@id>', fn: () => {
      const r = parseDeleteCommand('LB_DELETE_MR: <@244419214738194432>');
      assertNotNull(r, 'result');
      assertEqual(r.discordId,  '244419214738194432', 'discordId captured');
      assertEqual(r.playerName, '244419214738194432', 'playerName = discordId for dedup');
    }},

    { name: 'Delete by nickname mention <@!id>', fn: () => {
      const r = parseDeleteCommand('LB_DELETE_OW: <@!244419214738194432>', '999888777');
      assertNotNull(r, 'result');
      assertEqual(r.discordId, '244419214738194432', 'id from nickname mention');
      assertEqual(r.issuerId,  '999888777',          'issuerId set');
    }},

    { name: 'issuerId passed through from caller', fn: () => {
      const r = parseDeleteCommand('LB_DELETE_DL: @Wave', '111222333');
      assertNotNull(r, 'result');
      assertEqual(r.issuerId, '111222333', 'issuerId');
    }},

    { name: 'Case-insensitive prefix lb_delete_mr:', fn: () => {
      assertNotNull(parseDeleteCommand('lb_delete_mr: @Test'), 'lowercase ok');
    }},

    { name: 'Unknown prefix → null', fn: () => {
      assertNull(parseDeleteCommand('LB_DELETE_UNKNOWN: @Test'), 'unknown game');
    }},

    { name: 'Empty target → null', fn: () => {
      assertNull(parseDeleteCommand('LB_DELETE_MR:'), 'no target');
    }},

    { name: 'parseAnyMessage routes update commands normally', fn: () => {
      const r = parseAnyMessage('LB_UPDATE_MR: @Turbo Strategist Diamond 2 Grandmaster 1 today');
      assertNotNull(r, 'result');
      assert(r.type !== 'DELETE', 'not a delete');
      assertEqual(r.game, 'MARVEL_RIVALS', 'game');
    }},

    { name: 'parseAnyMessage routes delete commands', fn: () => {
      const r = parseAnyMessage('LB_DELETE_OW: @Alpha', '555666777');
      assertNotNull(r, 'result');
      assertEqual(r.type,     'DELETE',     'type');
      assertEqual(r.issuerId, '555666777',  'issuerId from caller');
    }},

    // ── deletePlayer (storage) ────────────────────────────────

    { name: 'deletePlayer: removes by plain playerName', fn: () => {
      const players = [
        { playerName: 'Alpha',    discordId: null,                  rankCurrent: 'Diamond' },
        { playerName: 'Turbostar', discordId: null,                 rankCurrent: 'Master'  },
      ];
      const removed = deletePlayer(players, { playerName: 'Alpha', discordId: null });
      assertNotNull(removed, 'removed');
      assertEqual(removed.playerName, 'Alpha', 'correct player removed');
      assertEqual(players.length, 1, 'one player remains');
      assertEqual(players[0].playerName, 'Turbostar', 'correct one remains');
    }},

    { name: 'deletePlayer: removes by discordId (priority over name)', fn: () => {
      const players = [
        { playerName: '244419214738194432', discordId: '244419214738194432', rankCurrent: 'Diamond' },
        { playerName: 'Wave',               discordId: null,                  rankCurrent: 'Gold'    },
      ];
      const removed = deletePlayer(players, { playerName: '244419214738194432', discordId: '244419214738194432' });
      assertNotNull(removed, 'removed');
      assertEqual(removed.discordId, '244419214738194432', 'correct player');
      assertEqual(players.length, 1, 'one remains');
    }},

    { name: 'deletePlayer: case-insensitive name match', fn: () => {
      const players = [{ playerName: 'turbostar', discordId: null, rankCurrent: 'Diamond' }];
      const removed = deletePlayer(players, { playerName: 'TURBOSTAR', discordId: null });
      assertNotNull(removed, 'removed despite case diff');
      assertEqual(players.length, 0, 'empty after remove');
    }},

    { name: 'deletePlayer: returns null when player not found', fn: () => {
      const players = [{ playerName: 'Alpha', discordId: null, rankCurrent: 'Diamond' }];
      const removed = deletePlayer(players, { playerName: 'Nobody', discordId: null });
      assertNull(removed, 'null for missing player');
      assertEqual(players.length, 1, 'player list unchanged');
    }},

    { name: 'deletePlayer: does not affect other players in list', fn: () => {
      const players = [
        { playerName: 'A', discordId: null, rankCurrent: 'Bronze'    },
        { playerName: 'B', discordId: null, rankCurrent: 'Diamond'   },
        { playerName: 'C', discordId: null, rankCurrent: 'Celestial' },
      ];
      deletePlayer(players, { playerName: 'B', discordId: null });
      assertEqual(players.length, 2, 'two remain');
      assertEqual(players[0].playerName, 'A', 'A intact');
      assertEqual(players[1].playerName, 'C', 'C intact');
    }},

  ]);
}
