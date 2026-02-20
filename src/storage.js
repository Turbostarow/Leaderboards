// ============================================================
// src/storage.js — State storage via pinned messages
//
// State lives in pinned messages inside the PRIVATE #lb-update
// channel — never visible in any public leaderboard channel.
//
// Each game has exactly one pinned state message:
//   LB_STATE:MARVEL_RIVALS:{"players":[...]}
//   LB_STATE:OVERWATCH:{"players":[...]}
//   LB_STATE:DEADLOCK:{"players":[...]}
// ============================================================

export function stateMarker(game) {
  return `LB_STATE:${game}:`;
}

export function encodeState(game, state) {
  return `${stateMarker(game)}${JSON.stringify(state)}`;
}

export function decodeState(content) {
  if (!content || typeof content !== 'string') return { players: [] };

  // Format: LB_STATE:GAME:{json} — skip past second colon
  const first  = content.indexOf(':');
  if (first  === -1) return { players: [] };
  const second = content.indexOf(':', first + 1);
  if (second === -1) return { players: [] };

  try {
    const parsed = JSON.parse(content.slice(second + 1));
    if (Array.isArray(parsed.players)) {
      parsed.players = parsed.players.map(p => ({
        ...p,
        date: p.date ? new Date(p.date) : new Date(),
      }));
    }
    return parsed;
  } catch (err) {
    console.error('[storage] Failed to parse state JSON:', err.message);
    return { players: [] };
  }
}

/**
 * Insert or update a player in the players array.
 * Stale updates (older than existing record) are silently skipped.
 * @returns {boolean} true if the record was changed
 */
export function upsertPlayer(players, data) {
  const idx = players.findIndex(
    p => p.playerName.toLowerCase() === data.playerName.toLowerCase()
  );

  if (idx === -1) {
    players.push(serialise(data));
    console.log(`[storage] Inserted new player: ${data.playerName}`);
    return true;
  }

  const existingDate = new Date(players[idx].date ?? 0);
  const incomingDate = data.date instanceof Date ? data.date : new Date(data.date);

  if (incomingDate < existingDate) {
    console.warn(
      `[storage] Skipping stale update for ${data.playerName}: ` +
      `incoming ${incomingDate.toISOString()} < existing ${existingDate.toISOString()}`
    );
    return false;
  }

  players[idx] = serialise(data);
  console.log(`[storage] Updated player: ${data.playerName}`);
  return true;
}

function serialise(data) {
  return {
    ...data,
    date: data.date instanceof Date ? data.date.toISOString() : new Date().toISOString(),
  };
}
