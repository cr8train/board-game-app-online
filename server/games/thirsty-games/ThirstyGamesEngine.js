const WEDGES = ['A', 'B', 'C', 'D', 'E', 'F'];

function applyMove(pos, move, preferredWedge = 'A') {
  if (move === 'CENTER') return pos;
  if (pos.type === 'center') {
    if (move === 'UP') return { type: 'wedge', wedge: preferredWedge, layer: 1 };
    return pos;
  }
  const idx = WEDGES.indexOf(pos.wedge);
  if (move === 'UP') return pos.layer === 6 ? pos : { ...pos, layer: pos.layer + 1 };
  if (move === 'DOWN') return pos.layer === 1 ? { type: 'center' } : { ...pos, layer: pos.layer - 1 };
  if (move === 'RIGHT') return { ...pos, wedge: WEDGES[(idx + 1) % 6] };
  if (move === 'LEFT') return { ...pos, wedge: WEDGES[(idx + 5) % 6] };
  return pos;
}

function getStormLayer(turnNumber) {
  if (turnNumber < 5) return null;
  return Math.max(1, 6 - Math.floor((turnNumber - 5) / 2));
}

function getMovesAllowed(turnNumber) {
  if (turnNumber === 1) return 3;
  return turnNumber % 2 === 0 ? 2 : 1;
}

function getMiniGameType(pos) {
  if (pos.type === 'center') return 'death';
  const map = { A: 'death', B: 'maze', C: 'trivia', D: 'know-x', E: 'truths-lies', F: 'memory' };
  return map[pos.wedge] || 'death';
}

function serializePos(pos) {
  return pos.type === 'center' ? 'center' : `${pos.wedge}${pos.layer}`;
}

function initThirstyGamesState(assignments) {
  const players = {};
  for (const a of assignments) {
    players[a.socketId] = {
      socketId: a.socketId,
      name: a.name,
      position: { type: 'center' },
      district: a.district,
      isAlive: true,
      movesSubmitted: false,
      submittedMoves: null,
      preferredWedge: WEDGES[(a.district - 1) % 6],
      battleWins: 0,
    };
  }
  return {
    turnNumber: 1,
    movesThisTurn: 3,
    phase: 'submit',
    players,
    stormLayer: null,
    pendingCollisions: [],
    revivalRequests: [],
    winner: null,
  };
}

module.exports = {
  applyMove,
  getStormLayer,
  getMovesAllowed,
  getMiniGameType,
  serializePos,
  initThirstyGamesState,
  WEDGES,
};
