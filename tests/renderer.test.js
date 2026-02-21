// ============================================================
// tests/renderer.test.js — 26 cases (embed format)
// ============================================================

import { relativeTime, rankEmoji, renderLeaderboard } from '../src/renderer.js';
import { runSuite, assertEqual, assert } from './helpers.js';

// ── Sample player factories ───────────────────────────────────
const mrPlayer = (name, rC, tC, rP, tP, id=null, msAgo=0) => ({
  playerName: id ?? name, displayName: name, discordId: id,
  role: 'Strategist', rankCurrent: rC, tierCurrent: tC,
  rankPeak: rP, tierPeak: tP, date: new Date(Date.now() - msAgo),
});

const owPlayer = (name, rC, tC, val, rP, tP, pVal, id=null) => ({
  playerName: id ?? name, displayName: name, discordId: id,
  role: 'Tank', rankCurrent: rC, tierCurrent: tC, currentValue: val,
  rankPeak: rP, tierPeak: tP, peakValue: pVal, date: new Date(),
});

const dlPlayer = (name, rC, tC, val, id=null) => ({
  playerName: id ?? name, displayName: name, discordId: id,
  hero: 'Haze', rankCurrent: rC, tierCurrent: tC, currentValue: val, date: new Date(),
});

export async function runRendererTests() {
  return runSuite('Renderer', [

    // ── relativeTime ──────────────────────────────────────────
    { name: 'just now  (< 10s)',  fn: () => assertEqual(relativeTime(new Date(Date.now()-5000)),      'just now', 'just now') },
    { name: '30 seconds ago',     fn: () => assertEqual(relativeTime(new Date(Date.now()-30000)),     '30s ago',  '30s') },
    { name: '1 minute ago',       fn: () => assertEqual(relativeTime(new Date(Date.now()-65000)),     '1m ago',   '1m') },
    { name: '3 minutes ago',      fn: () => assertEqual(relativeTime(new Date(Date.now()-180000)),    '3m ago',   '3m') },
    { name: '2 hours ago',        fn: () => assertEqual(relativeTime(new Date(Date.now()-7200000)),   '2h ago',   '2h') },
    { name: '3 days ago',         fn: () => assertEqual(relativeTime(new Date(Date.now()-3*864e5)),   '3d ago',   '3d') },
    { name: '2 weeks ago',        fn: () => assertEqual(relativeTime(new Date(Date.now()-14*864e5)),  '2w ago',   '2w') },
    { name: '1 month ago',        fn: () => assertEqual(relativeTime(new Date(Date.now()-45*864e5)),  '1mo ago',  '1mo') },
    { name: '1 year ago',         fn: () => assertEqual(relativeTime(new Date(Date.now()-400*864e5)), '1y ago',   '1y') },
    { name: 'future → just now',  fn: () => assertEqual(relativeTime(new Date(Date.now()+9999)),      'just now', 'future') },

    // ── rankEmoji ─────────────────────────────────────────────
    { name: 'emoji: diamond',       fn: () => assertEqual(rankEmoji('Diamond'),       '💎',  'diamond') },
    { name: 'emoji: One Above All', fn: () => assertEqual(rankEmoji('One Above All'), '🌟',  'oaa') },
    { name: 'emoji: unknown → ❓',  fn: () => assertEqual(rankEmoji('Fake'),          '❓',  'unknown') },

    // ── Embed structure ───────────────────────────────────────

    { name: 'Returns embed payload object (not string)', fn: () => {
      const out = renderLeaderboard([], 'MARVEL_RIVALS');
      assert(typeof out === 'object' && Array.isArray(out.embeds), 'is embed object');
    }},

    { name: 'MR embed: correct yellow color', fn: () => {
      const out = renderLeaderboard([], 'MARVEL_RIVALS');
      assertEqual(out.embeds[0].color, 0xF5C400, 'yellow');
    }},

    { name: 'OW embed: correct red color', fn: () => {
      assertEqual(renderLeaderboard([], 'OVERWATCH').embeds[0].color, 0xD62828, 'red');
    }},

    { name: 'DL embed: correct brown color', fn: () => {
      assertEqual(renderLeaderboard([], 'DEADLOCK').embeds[0].color, 0x7B4F2E, 'brown');
    }},

    { name: 'All caps title as embed author', fn: () => {
      const out = renderLeaderboard([], 'MARVEL_RIVALS');
      assertEqual(out.embeds[0].author.name, 'MARVEL RIVALS LEADERBOARD', 'all caps');
    }},

    { name: 'Empty board shows placeholder text', fn: () => {
      assert(renderLeaderboard([], 'DEADLOCK').embeds[0].description.includes('No players yet'), 'placeholder');
    }},

    // ── Table content ─────────────────────────────────────────

    { name: 'MR table has code block + all column headers', fn: () => {
      const desc = renderLeaderboard([mrPlayer('Turbostar','Diamond',2,'Grandmaster',1)], 'MARVEL_RIVALS').embeds[0].description;
      assert(desc.includes('```'),        'code block');
      assert(desc.includes('POS'),        'POS header');
      assert(desc.includes('PLAYER'),     'PLAYER header');
      assert(desc.includes('ROLE'),       'ROLE header');
      assert(desc.includes('RANK'),       'RANK header');
      assert(desc.includes('PEAK'),       'PEAK header');
      assert(desc.includes('UPDATED'),    'UPDATED header');
      assert(desc.includes('─'),          'divider');
    }},

    { name: 'MR table: player data correctly rendered in row', fn: () => {
      const desc = renderLeaderboard([mrPlayer('Turbostar','Diamond',2,'Grandmaster',1)], 'MARVEL_RIVALS').embeds[0].description;
      assert(desc.includes('Turbostar'),   'player name');
      assert(desc.includes('Strategist'),  'role');
      assert(desc.includes('Diamond 2'),   'rank');
      assert(desc.includes('Grandmaster'), 'peak');
    }},

    { name: 'OW table includes SR values in RANK and PEAK columns', fn: () => {
      const desc = renderLeaderboard([owPlayer('Alpha','Diamond',3,3200,'Master',2,3400)], 'OVERWATCH').embeds[0].description;
      assert(desc.includes('3200'), 'current SR');
      assert(desc.includes('3400'), 'peak SR');
    }},

    { name: 'OW Top 500 shows # prefix for tier', fn: () => {
      const desc = renderLeaderboard([owPlayer('Pro','Top 500',47,4800,'Top 500',12,4900)], 'OVERWATCH').embeds[0].description;
      assert(desc.includes('#47'), '#47');
      assert(desc.includes('#12'), '#12');
    }},

    { name: 'DL table has no PEAK column', fn: () => {
      const desc = renderLeaderboard([dlPlayer('Player2','Archon',4,1200)], 'DEADLOCK').embeds[0].description;
      assert(!desc.includes('PEAK'), 'no PEAK header in DL');
    }},

    { name: 'DL table includes pts value', fn: () => {
      const desc = renderLeaderboard([dlPlayer('Player2','Archon',4,1200)], 'DEADLOCK').embeds[0].description;
      assert(desc.includes('1200'), 'pts value');
    }},

    // ── Discord pings ─────────────────────────────────────────




    // ── Footer / timestamp ────────────────────────────────────

    { name: 'Embed has footer with "Last updated" text', fn: () => {
      const embed = renderLeaderboard([], 'OVERWATCH').embeds[0];
      assert(embed.footer.text.includes('Last updated'), 'footer text');
    }},

    { name: 'Embed has ISO timestamp field', fn: () => {
      const embed = renderLeaderboard([], 'DEADLOCK').embeds[0];
      assert(typeof embed.timestamp === 'string', 'timestamp exists');
      assert(!isNaN(new Date(embed.timestamp)), 'valid ISO date');
    }},

  ]);
}
