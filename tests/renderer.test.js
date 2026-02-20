// ============================================================
// tests/renderer.test.js — 23 cases
// ============================================================

import { relativeTime, rankEmoji, renderLeaderboard } from '../src/renderer.js';
import { runSuite, assertEqual, assert } from './helpers.js';

export async function runRendererTests() {
  return runSuite('Renderer', [

    // ── relativeTime ──────────────────────────────────────────
    { name: 'just now  (< 10s)',  fn: () => assertEqual(relativeTime(new Date(Date.now()-5000)),      'just now',      'just now') },
    { name: '30 seconds ago',     fn: () => assertEqual(relativeTime(new Date(Date.now()-30000)),     '30 seconds ago','30s') },
    { name: '1 minute ago',       fn: () => assertEqual(relativeTime(new Date(Date.now()-65000)),     '1 minute ago',  '1m') },
    { name: '3 minutes ago',      fn: () => assertEqual(relativeTime(new Date(Date.now()-180000)),    '3 minutes ago', '3m') },
    { name: '2 hours ago',        fn: () => assertEqual(relativeTime(new Date(Date.now()-7200000)),   '2 hours ago',   '2h') },
    { name: '3 days ago',         fn: () => assertEqual(relativeTime(new Date(Date.now()-3*864e5)),   '3 days ago',    '3d') },
    { name: '2 weeks ago',        fn: () => assertEqual(relativeTime(new Date(Date.now()-14*864e5)),  '2 weeks ago',   '2w') },
    { name: '1 month ago',        fn: () => assertEqual(relativeTime(new Date(Date.now()-45*864e5)),  '1 month ago',   '1mo') },
    { name: '1 year ago',         fn: () => assertEqual(relativeTime(new Date(Date.now()-400*864e5)), '1 year ago',    '1y') },
    { name: 'future → just now',  fn: () => assertEqual(relativeTime(new Date(Date.now()+9999)),      'just now',      'future') },

    // ── rankEmoji ─────────────────────────────────────────────
    { name: 'emoji: diamond',       fn: () => assertEqual(rankEmoji('Diamond'),       '💎',  'diamond') },
    { name: 'emoji: case insensitive', fn: () => assertEqual(rankEmoji('GRANDMASTER'),'👑',  'gm') },
    { name: 'emoji: Top 500',       fn: () => assertEqual(rankEmoji('Top 500'),       '⭐',  'top500') },
    { name: 'emoji: One Above All', fn: () => assertEqual(rankEmoji('One Above All'), '🌟',  'oaa') },
    { name: 'emoji: Eternus (DL)',  fn: () => assertEqual(rankEmoji('Eternus'),       '♾️',  'eternus') },
    { name: 'emoji: unknown → ❓',  fn: () => assertEqual(rankEmoji('Fake'),          '❓',  'unknown') },

    // ── renderLeaderboard ─────────────────────────────────────
    { name: 'MR: empty board shows placeholder', fn: () => {
      assert(renderLeaderboard([], 'MARVEL_RIVALS').includes('No players yet'), 'placeholder');
    }},

    { name: 'MR: row shows name/role/rank/peak/time', fn: () => {
      const out = renderLeaderboard([{
        playerName: 'Turbostar', role: 'Duelist',
        rankCurrent: 'Diamond', tierCurrent: 2,
        rankPeak: 'Grandmaster', tierPeak: 1,
        date: new Date(Date.now()-7200000),
      }], 'MARVEL_RIVALS');
      assert(out.includes('@Turbostar'), 'name');
      assert(out.includes('Duelist'),   'role');
      assert(out.includes('💎'),        'emoji');
      assert(out.includes('Diamond 2'), 'rank');
      assert(out.includes('Grandmaster 1'), 'peak');
      assert(out.includes('hours ago'), 'time');
    }},

    { name: 'OW: row shows SR values', fn: () => {
      const out = renderLeaderboard([{
        playerName: 'Alpha', role: 'Tank',
        rankCurrent: 'Diamond', tierCurrent: 3, currentValue: 3200,
        rankPeak: 'Master', tierPeak: 2, peakValue: 3400, date: new Date(),
      }], 'OVERWATCH');
      assert(out.includes('3200 SR'), 'current SR');
      assert(out.includes('3400 SR'), 'peak SR');
    }},

    { name: 'OW: Top 500 shows # prefix', fn: () => {
      const out = renderLeaderboard([{
        playerName: 'Pro', role: 'DPS',
        rankCurrent: 'Top 500', tierCurrent: 47, currentValue: 4800,
        rankPeak: 'Top 500', tierPeak: 12, peakValue: 4900, date: new Date(),
      }], 'OVERWATCH');
      assert(out.includes('#47'), 'current #');
      assert(out.includes('#12'), 'peak #');
    }},

    { name: 'DL: row shows pts, NO peak section', fn: () => {
      const out = renderLeaderboard([{
        playerName: 'Player2', hero: 'Haze',
        rankCurrent: 'Archon', tierCurrent: 4, currentValue: 1200, date: new Date(),
      }], 'DEADLOCK');
      assert(out.includes('Haze'), 'hero');
      assert(out.includes('1200 pts'), 'pts');
      assert(!out.includes('Peak:'), 'no peak in DL');
    }},

    { name: 'Top 3 get medals 🥇🥈🥉', fn: () => {
      const players = ['A','B','C','D'].map((n, i) => ({
        playerName: n, role: 'DPS',
        rankCurrent: 'Diamond', tierCurrent: i+1,
        rankPeak: 'Diamond', tierPeak: i+1, date: new Date(),
      }));
      const out = renderLeaderboard(players, 'MARVEL_RIVALS');
      assert(out.includes('🥇'), '1st'); assert(out.includes('🥈'), '2nd'); assert(out.includes('🥉'), '3rd');
    }},

    { name: 'includes "Last updated:" timestamp', fn: () => {
      assert(renderLeaderboard([], 'DEADLOCK').includes('Last updated:'), 'timestamp');
    }},

  ]);
}
