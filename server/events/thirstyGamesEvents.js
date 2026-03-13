const {
  applyMove,
  getStormLayer,
  getMovesAllowed,
  getMiniGameType,
  serializePos,
  WEDGES,
} = require('../games/thirsty-games/ThirstyGamesEngine');

const {
  initDeathState,
  initMazeState,
  initTriviaState,
  initKnowXState,
  initTruthsLiesState,
  initMemoryState,
  scoreMemorySubmission,
  scoreTriviaAnswers,
  scoreKnowX,
  applyMazeMove,
} = require('../games/thirsty-games/MiniGameEngine');

const autoSubmitTimers = new Map();
const triviaTimers = new Map();
const memoryTimers = new Map();

function clearAutoSubmit(roomCode) {
  if (autoSubmitTimers.has(roomCode)) {
    clearTimeout(autoSubmitTimers.get(roomCode));
    autoSubmitTimers.delete(roomCode);
  }
}

function startAutoSubmit(io, roomCode, roomManager, delay = 60000) {
  clearAutoSubmit(roomCode);
  const timer = setTimeout(() => {
    const room = roomManager.getRoom(roomCode);
    if (!room || !room.gameState) return;
    const gs = room.gameState;
    const alivePlayers = Object.values(gs.players).filter(p => p.isAlive);
    for (const p of alivePlayers) {
      if (!p.movesSubmitted) {
        p.submittedMoves = Array(gs.movesThisTurn).fill('CENTER');
        p.movesSubmitted = true;
      }
    }
    resolveTurn(io, room, roomManager);
  }, delay);
  autoSubmitTimers.set(roomCode, timer);
}

function clearTriviaTimer(roomCode) {
  if (triviaTimers.has(roomCode)) {
    clearTimeout(triviaTimers.get(roomCode));
    triviaTimers.delete(roomCode);
  }
}

function clearMemoryTimers(roomCode) {
  const timers = memoryTimers.get(roomCode);
  if (timers) {
    if (timers.show) clearTimeout(timers.show);
    if (timers.recall) clearTimeout(timers.recall);
    memoryTimers.delete(roomCode);
  }
}

function initMiniGameState(type, competitors, allPlayers) {
  switch (type) {
    case 'death': return initDeathState(competitors);
    case 'maze': return initMazeState(competitors);
    case 'trivia': return initTriviaState(competitors);
    case 'know-x': return initKnowXState(competitors, allPlayers);
    case 'truths-lies': return initTruthsLiesState(competitors);
    case 'memory': return initMemoryState(competitors);
    default: return initDeathState(competitors);
  }
}

function detectCollisions(players) {
  const posMap = {};
  for (const p of Object.values(players)) {
    if (!p.isAlive) continue;
    const key = serializePos(p.position);
    if (!posMap[key]) posMap[key] = [];
    posMap[key].push(p);
  }
  const collisions = [];
  for (const [posKey, group] of Object.entries(posMap)) {
    if (group.length >= 2) {
      collisions.push({ posKey, players: group.map(p => ({ socketId: p.socketId, name: p.name })) });
    }
  }
  return collisions;
}

function afterStorm(io, room, roomManager, collisions) {
  const gs = room.gameState;

  if (collisions.length > 0) {
    gs.pendingCollisions = collisions;
    gs.phase = 'minigame';
    const collision = collisions[0];
    const posKey = collision.posKey;
    let miniGameType = 'death';
    const sample = Object.values(gs.players).find(p => p.isAlive && serializePos(p.position) === posKey);
    if (sample) miniGameType = getMiniGameType(sample.position);

    // 3+ players at same spot or center → always death
    const actualType = (collision.players.length > 2 || posKey === 'center') ? 'death' : miniGameType;
    gs.miniGameState = initMiniGameState(actualType, collision.players, Object.values(gs.players));

    // Start memory timers if needed
    if (actualType === 'memory') {
      startMemoryTimers(io, room, roomManager);
    }
    // Start trivia question timer
    if (actualType === 'trivia') {
      gs.miniGameState.questionStartTime = Date.now();
      startTriviaTimer(io, room, roomManager);
    }

    io.to(room.code).emit('tg:miniGameStart', { collision, miniGameType: actualType, miniGameState: gs.miniGameState });
  } else {
    const alive = Object.values(gs.players).filter(p => p.isAlive);
    if (alive.length <= 1) {
      const winner = alive[0] || null;
      gs.winner = winner ? winner.socketId : null;
      gs.phase = 'ended';
      io.to(room.code).emit('tg:gameOver', { winner: winner ? { socketId: winner.socketId, name: winner.name } : null });
    } else {
      advanceTurn(io, room, roomManager);
    }
  }
}

function resolveTurn(io, room, roomManager) {
  clearAutoSubmit(room.code);
  const gs = room.gameState;
  gs.phase = 'resolve';

  const stormSick = [];
  const stormLayer = getStormLayer(gs.turnNumber);
  gs.stormLayer = stormLayer;

  // Apply moves
  for (const p of Object.values(gs.players)) {
    if (!p.isAlive || !p.submittedMoves) continue;
    let pos = p.position;
    for (const move of p.submittedMoves) {
      pos = applyMove(pos, move, p.preferredWedge);
    }
    p.position = pos;
    p.movesSubmitted = false;
    p.submittedMoves = null;

    // Check storm — mark sick, do NOT kill
    if (stormLayer !== null && pos.type === 'wedge' && pos.layer >= stormLayer) {
      stormSick.push({ socketId: p.socketId, name: p.name, position: pos });
    }
  }

  const collisions = detectCollisions(gs.players);

  io.to(room.code).emit('tg:turnResolved', {
    newState: gs,
    stormSick,
    collisions,
  });

  if (stormSick.length > 0) {
    gs.phase = 'storm-ack';
    gs.pendingCollisionsAfterStorm = collisions;
    io.to(room.hostSocketId).emit('tg:stormSick', { affected: stormSick });
  } else {
    afterStorm(io, room, roomManager, collisions);
  }
}

function advanceTurn(io, room, roomManager) {
  const gs = room.gameState;
  gs.turnNumber += 1;
  gs.movesThisTurn = getMovesAllowed(gs.turnNumber);
  gs.phase = 'submit';
  gs.pendingCollisions = [];
  io.to(room.code).emit('tg:turnStart', {
    turnNumber: gs.turnNumber,
    movesAllowed: gs.movesThisTurn,
    stormLayer: gs.stormLayer,
    newState: gs,
  });
  startAutoSubmit(io, room.code, roomManager);
}

function handleNextCollisionOrAdvance(io, room, roomManager) {
  const gs = room.gameState;
  gs.pendingCollisions.shift();
  if (gs.pendingCollisions.length > 0) {
    const collision = gs.pendingCollisions[0];
    const posKey = collision.posKey;
    const sample = Object.values(gs.players).find(p => p.isAlive && serializePos(p.position) === posKey);
    let miniGameType = sample ? getMiniGameType(sample.position) : 'death';

    // 3+ players at same spot or center → always death
    const actualType = (collision.players.length > 2 || posKey === 'center') ? 'death' : miniGameType;
    gs.miniGameState = initMiniGameState(actualType, collision.players, Object.values(gs.players));
    gs.phase = 'minigame';

    // Start timers as needed
    if (actualType === 'memory') {
      startMemoryTimers(io, room, roomManager);
    }
    if (actualType === 'trivia') {
      gs.miniGameState.questionStartTime = Date.now();
      startTriviaTimer(io, room, roomManager);
    }

    io.to(room.code).emit('tg:miniGameStart', { collision, miniGameType: actualType, miniGameState: gs.miniGameState });
  } else {
    const alive = Object.values(gs.players).filter(p => p.isAlive);
    if (alive.length <= 1) {
      const winner = alive[0] || null;
      gs.winner = winner ? winner.socketId : null;
      gs.phase = 'ended';
      io.to(room.code).emit('tg:gameOver', { winner: winner ? { socketId: winner.socketId, name: winner.name } : null });
    } else {
      advanceTurn(io, room, roomManager);
    }
  }
}

// ── Trivia timer helpers ──────────────────────────────────────────────────────

function startTriviaTimer(io, room, roomManager) {
  clearTriviaTimer(room.code);
  const timer = setTimeout(() => {
    const r = roomManager.getRoom(room.code);
    if (!r || !r.gameState) return;
    const gs = r.gameState;
    const mgs = gs.miniGameState;
    if (!mgs || mgs.type !== 'trivia' || mgs.phase !== 'question') return;

    const qi = mgs.currentQ;
    // Auto-fill missing answers for current question
    for (const c of mgs.competitors) {
      if (!mgs.answers[c.socketId][qi]) {
        mgs.answers[c.socketId][qi] = { answer: -1, timeMs: 12000 };
      }
    }
    advanceTriviaQuestion(io, r, roomManager);
  }, 12000);
  triviaTimers.set(room.code, timer);
}

function advanceTriviaQuestion(io, room, roomManager) {
  const gs = room.gameState;
  const mgs = gs.miniGameState;
  if (!mgs || mgs.type !== 'trivia') return;

  clearTriviaTimer(room.code);

  const qi = mgs.currentQ;
  const question = mgs.questions[qi];

  // Emit result for this question
  const answerMap = {};
  for (const c of mgs.competitors) {
    answerMap[c.socketId] = mgs.answers[c.socketId][qi];
  }
  io.to(room.code).emit('tg:triviaQuestionResult', {
    questionIndex: qi,
    answers: answerMap,
    correct: question.answer,
  });

  if (qi + 1 >= mgs.questions.length) {
    // All done — score and finish
    mgs.phase = 'done';
    const scores = {};
    for (const c of mgs.competitors) {
      scores[c.socketId] = scoreTriviaAnswers(mgs.questions, mgs.answers[c.socketId]);
    }

    const [id1, id2] = mgs.competitors.map(c => c.socketId);
    const s1 = scores[id1];
    const s2 = scores[id2];
    let winnerId, loserId;
    if (s1.correct > s2.correct) {
      winnerId = id1; loserId = id2;
    } else if (s2.correct > s1.correct) {
      winnerId = id2; loserId = id1;
    } else {
      // Tiebreak: less time wins
      winnerId = s1.totalTime <= s2.totalTime ? id1 : id2;
      loserId = winnerId === id1 ? id2 : id1;
    }

    io.to(room.code).emit('tg:triviaOver', { scores, winnerId, loserId });

    const loser = gs.players[loserId];
    if (loser) {
      loser.isAlive = false;
      io.to(room.code).emit('tg:playerEliminated', { playerId: loserId, name: loser.name });
    }
    const winner = gs.players[winnerId];
    if (winner) winner.battleWins = (winner.battleWins || 0) + 1;

    setTimeout(() => handleNextCollisionOrAdvance(io, room, roomManager), 2000);
  } else {
    // Next question
    mgs.currentQ = qi + 1;
    mgs.phase = 'question';
    mgs.questionStartTime = Date.now();
    io.to(room.code).emit('tg:triviaNextQuestion', { questionIndex: mgs.currentQ, questionStartTime: mgs.questionStartTime });
    startTriviaTimer(io, room, roomManager);
  }
}

// ── Memory timer helpers ──────────────────────────────────────────────────────

function startMemoryTimers(io, room, roomManager) {
  clearMemoryTimers(room.code);
  const showTimer = setTimeout(() => {
    const r = roomManager.getRoom(room.code);
    if (!r || !r.gameState) return;
    const gs = r.gameState;
    const mgs = gs.miniGameState;
    if (!mgs || mgs.type !== 'memory') return;
    mgs.showingGrid = false;
    mgs.submitStart = Date.now();
    mgs.phase = 'recall';
    io.to(r.code).emit('tg:memoryHide', {});

    const recallTimer = setTimeout(() => {
      const r2 = roomManager.getRoom(room.code);
      if (!r2 || !r2.gameState) return;
      const gs2 = r2.gameState;
      const mgs2 = gs2.miniGameState;
      if (!mgs2 || mgs2.type !== 'memory' || mgs2.phase !== 'recall') return;

      // Auto-submit random grids for anyone who hasn't submitted
      for (const c of mgs2.competitors) {
        if (!mgs2.submissions[c.socketId]) {
          const randomGrid = [];
          const COLORS = ['white', 'black', 'magenta', 'baby-blue'];
          for (let row = 0; row < 5; row++) {
            randomGrid[row] = [];
            for (let col = 0; col < 5; col++) {
              randomGrid[row][col] = COLORS[Math.floor(Math.random() * COLORS.length)];
            }
          }
          mgs2.submissions[c.socketId] = randomGrid;
          mgs2.submitTimes[c.socketId] = 60000;
        }
      }
      finishMemoryGame(io, r2, roomManager);
    }, 60000);

    const existing = memoryTimers.get(room.code) || {};
    memoryTimers.set(room.code, { ...existing, recall: recallTimer });
  }, 15000);

  memoryTimers.set(room.code, { show: showTimer, recall: null });
}

function finishMemoryGame(io, room, roomManager) {
  clearMemoryTimers(room.code);
  const gs = room.gameState;
  const mgs = gs.miniGameState;
  if (!mgs || mgs.type !== 'memory') return;

  mgs.phase = 'done';
  const scores = {};
  for (const c of mgs.competitors) {
    const sub = mgs.submissions[c.socketId] || [];
    const pct = scoreMemorySubmission(mgs.grid, sub);
    scores[c.socketId] = { pct, timeMs: mgs.submitTimes[c.socketId] || 60000 };
  }

  const [id1, id2] = mgs.competitors.map(c => c.socketId);
  const s1 = scores[id1];
  const s2 = scores[id2];
  let winnerId, loserId;
  if (s1.pct > s2.pct) {
    winnerId = id1; loserId = id2;
  } else if (s2.pct > s1.pct) {
    winnerId = id2; loserId = id1;
  } else {
    winnerId = s1.timeMs <= s2.timeMs ? id1 : id2;
    loserId = winnerId === id1 ? id2 : id1;
  }

  io.to(room.code).emit('tg:memoryOver', { scores, grid: mgs.grid, winnerId, loserId });

  const loser = gs.players[loserId];
  if (loser) {
    loser.isAlive = false;
    io.to(room.code).emit('tg:playerEliminated', { playerId: loserId, name: loser.name });
  }
  const winner = gs.players[winnerId];
  if (winner) winner.battleWins = (winner.battleWins || 0) + 1;

  setTimeout(() => handleNextCollisionOrAdvance(io, room, roomManager), 2000);
}

// ── Main registration ─────────────────────────────────────────────────────────

module.exports = function registerThirstyGamesEvents(io, socket, roomManager) {
  socket.on('tg:submitMoves', ({ moves, preferredWedge }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      if (gs.phase !== 'submit') return;

      const player = gs.players[socket.id];
      if (!player || !player.isAlive || player.movesSubmitted) return;

      if (preferredWedge && WEDGES.includes(preferredWedge)) {
        player.preferredWedge = preferredWedge;
      }

      const validMoves = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'CENTER'];
      const sanitized = moves.filter(m => validMoves.includes(m)).slice(0, gs.movesThisTurn);
      while (sanitized.length < gs.movesThisTurn) sanitized.push('CENTER');
      player.submittedMoves = sanitized;
      player.movesSubmitted = true;

      io.to(room.code).emit('tg:playerSubmitted', { socketId: socket.id });

      const alivePlayers = Object.values(gs.players).filter(p => p.isAlive);
      const allSubmitted = alivePlayers.every(p => p.movesSubmitted);
      if (allSubmitted) {
        resolveTurn(io, room, roomManager);
      }
    } catch (err) {
      console.error('tg:submitMoves error:', err);
    }
  });

  socket.on('tg:acknowledgeStorm', () => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      if (room.hostSocketId !== socket.id) return;
      const gs = room.gameState;
      if (gs.phase !== 'storm-ack') return;

      const collisions = gs.pendingCollisionsAfterStorm || [];
      gs.pendingCollisionsAfterStorm = [];
      afterStorm(io, room, roomManager, collisions);
    } catch (err) {
      console.error('tg:acknowledgeStorm error:', err);
    }
  });

  // Fallback host override (kept for backwards compat)
  socket.on('tg:miniGameChoice', ({ loserId }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      if (room.hostSocketId !== socket.id) return;
      const gs = room.gameState;

      const loser = gs.players[loserId];
      if (loser) {
        loser.isAlive = false;
        io.to(room.code).emit('tg:playerEliminated', { playerId: loserId, name: loser.name });
      }

      handleNextCollisionOrAdvance(io, room, roomManager);
    } catch (err) {
      console.error('tg:miniGameChoice error:', err);
    }
  });

  const rpsState = {};

  socket.on('tg:rpsChoice', ({ choice }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      if (gs.phase !== 'minigame') return;

      const collision = gs.pendingCollisions[0];
      if (!collision) return;

      const collidingIds = collision.players.map(p => p.socketId);
      if (!collidingIds.includes(socket.id)) return;

      if (!rpsState[room.code]) rpsState[room.code] = {};
      rpsState[room.code][socket.id] = choice;

      const choices = rpsState[room.code];
      const bothSubmitted = collidingIds.every(id => choices[id]);

      if (bothSubmitted) {
        const [id1, id2] = collidingIds;
        const c1 = choices[id1];
        const c2 = choices[id2];

        let winnerId, loserId;
        const beats = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

        if (c1 === c2) {
          if (Math.random() < 0.5) { winnerId = id1; loserId = id2; }
          else { winnerId = id2; loserId = id1; }
        } else if (beats[c1] === c2) {
          winnerId = id1; loserId = id2;
        } else {
          winnerId = id2; loserId = id1;
        }

        delete rpsState[room.code];

        io.to(room.code).emit('tg:rpsResult', {
          choices: { [id1]: c1, [id2]: c2 },
          winnerId,
          loserId,
          playerNames: { [id1]: gs.players[id1]?.name, [id2]: gs.players[id2]?.name },
        });

        const loser = gs.players[loserId];
        if (loser) {
          loser.isAlive = false;
          io.to(room.code).emit('tg:playerEliminated', { playerId: loserId, name: loser.name });
        }
        const winner = gs.players[winnerId];
        if (winner) winner.battleWins = (winner.battleWins || 0) + 1;

        setTimeout(() => {
          handleNextCollisionOrAdvance(io, room, roomManager);
        }, 2000);
      }
    } catch (err) {
      console.error('tg:rpsChoice error:', err);
    }
  });

  // ── Death game ──────────────────────────────────────────────────────────────

  socket.on('tg:deathSubmit', ({ number }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'death') return;

      const isCompetitor = mgs.competitors.find(c => c.socketId === socket.id);
      if (!isCompetitor) return;

      mgs.numbers[socket.id] = String(number).slice(0, 20);

      const allSubmitted = mgs.competitors.every(c => mgs.numbers[c.socketId] !== undefined);
      if (allSubmitted) {
        mgs.revealed = true;
        io.to(room.code).emit('tg:deathRevealed', {
          numbers: mgs.numbers,
          competitors: mgs.competitors,
        });
      }
    } catch (err) {
      console.error('tg:deathSubmit error:', err);
    }
  });

  socket.on('tg:deathDecision', ({ survivorIds }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      if (room.hostSocketId !== socket.id) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'death') return;

      const survivors = new Set(Array.isArray(survivorIds) ? survivorIds : []);

      for (const c of mgs.competitors) {
        if (!survivors.has(c.socketId)) {
          const loser = gs.players[c.socketId];
          if (loser) {
            loser.isAlive = false;
            io.to(room.code).emit('tg:playerEliminated', { playerId: c.socketId, name: loser.name });
          }
        } else {
          const winner = gs.players[c.socketId];
          if (winner) winner.battleWins = (winner.battleWins || 0) + 1;
        }
      }

      handleNextCollisionOrAdvance(io, room, roomManager);
    } catch (err) {
      console.error('tg:deathDecision error:', err);
    }
  });

  // ── Maze mini-game ──────────────────────────────────────────────────────────

  socket.on('tg:mazeMiniMove', ({ direction }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'maze') return;

      const isCompetitor = mgs.competitors.find(c => c.socketId === socket.id);
      if (!isCompetitor) return;

      const pos = mgs.positions[socket.id];
      if (!pos || pos.finished) return;

      // Build a fake maze state compatible with applyMazeMove
      const fakeMazeState = {
        maze: mgs.maze,
        players: {},
        phase: 'playing',
        winner: null,
        finishOrder: [],
      };
      for (const c of mgs.competitors) {
        fakeMazeState.players[c.socketId] = {
          socketId: c.socketId,
          name: c.name,
          x: mgs.positions[c.socketId].x,
          y: mgs.positions[c.socketId].y,
          finished: mgs.positions[c.socketId].finished,
          finishTime: mgs.positions[c.socketId].finishTime,
        };
      }

      const result = applyMazeMove(fakeMazeState, socket.id, direction);

      // Sync positions back
      for (const c of mgs.competitors) {
        const fp = fakeMazeState.players[c.socketId];
        mgs.positions[c.socketId].x = fp.x;
        mgs.positions[c.socketId].y = fp.y;
        mgs.positions[c.socketId].finished = fp.finished;
        mgs.positions[c.socketId].finishTime = fp.finishTime;
      }

      io.to(room.code).emit('tg:mazeMiniUpdate', {
        positions: mgs.positions,
        maze: mgs.maze,
      });

      if (result.finished) {
        // This player won
        const winnerId = socket.id;
        const loserEntry = mgs.competitors.find(c => c.socketId !== socket.id);
        const loserId = loserEntry ? loserEntry.socketId : null;
        mgs.winner = winnerId;

        io.to(room.code).emit('tg:mazeMiniOver', { winnerId, loserId });

        if (loserId) {
          const loser = gs.players[loserId];
          if (loser) {
            loser.isAlive = false;
            io.to(room.code).emit('tg:playerEliminated', { playerId: loserId, name: loser.name });
          }
        }
        const winner = gs.players[winnerId];
        if (winner) winner.battleWins = (winner.battleWins || 0) + 1;

        setTimeout(() => handleNextCollisionOrAdvance(io, room, roomManager), 2000);
      }
    } catch (err) {
      console.error('tg:mazeMiniMove error:', err);
    }
  });

  // ── Trivia ──────────────────────────────────────────────────────────────────

  socket.on('tg:triviaAnswer', ({ answer, timeMs }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'trivia' || mgs.phase !== 'question') return;

      const isCompetitor = mgs.competitors.find(c => c.socketId === socket.id);
      if (!isCompetitor) return;

      const qi = mgs.currentQ;
      // Don't overwrite existing answer
      if (mgs.answers[socket.id][qi]) return;
      mgs.answers[socket.id][qi] = { answer, timeMs: timeMs || 0 };

      // Check if all competitors answered
      const allAnswered = mgs.competitors.every(c => mgs.answers[c.socketId][qi]);
      if (allAnswered) {
        advanceTriviaQuestion(io, room, roomManager);
      }
    } catch (err) {
      console.error('tg:triviaAnswer error:', err);
    }
  });

  // ── Know-X ──────────────────────────────────────────────────────────────────

  socket.on('tg:knowXSubjectAnswers', ({ answers }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'know-x' || mgs.phase !== 'subject-answering') return;
      if (mgs.subject.socketId !== socket.id) return;

      mgs.subjectAnswers = (Array.isArray(answers) ? answers : []).slice(0, 5);
      while (mgs.subjectAnswers.length < 5) mgs.subjectAnswers.push('');
      mgs.guessStart = Date.now();
      mgs.phase = 'competitors-guessing';

      io.to(room.code).emit('tg:knowXReveal', {
        subject: mgs.subject,
        prompt: mgs.prompt,
        answers: mgs.subjectAnswers,
      });
    } catch (err) {
      console.error('tg:knowXSubjectAnswers error:', err);
    }
  });

  socket.on('tg:knowXGuess', ({ guesses, timeMs }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'know-x' || mgs.phase !== 'competitors-guessing') return;

      const isCompetitor = mgs.competitors.find(c => c.socketId === socket.id);
      if (!isCompetitor) return;
      if (mgs.guesses[socket.id]) return; // already submitted

      mgs.guesses[socket.id] = (Array.isArray(guesses) ? guesses : []).slice(0, 5);
      while (mgs.guesses[socket.id].length < 5) mgs.guesses[socket.id].push('');
      mgs.guessTimes[socket.id] = timeMs || 0;

      const allGuessed = mgs.competitors.every(c => mgs.guesses[c.socketId]);
      if (allGuessed) {
        mgs.phase = 'done';
        const scores = {};
        for (const c of mgs.competitors) {
          scores[c.socketId] = scoreKnowX(mgs.subjectAnswers, mgs.guesses[c.socketId]);
        }

        const [id1, id2] = mgs.competitors.map(c => c.socketId);
        let winnerId, loserId;
        if (scores[id1] > scores[id2]) {
          winnerId = id1; loserId = id2;
        } else if (scores[id2] > scores[id1]) {
          winnerId = id2; loserId = id1;
        } else {
          winnerId = mgs.guessTimes[id1] <= mgs.guessTimes[id2] ? id1 : id2;
          loserId = winnerId === id1 ? id2 : id1;
        }

        io.to(room.code).emit('tg:knowXOver', {
          scores,
          subjectAnswers: mgs.subjectAnswers,
          guesses: mgs.guesses,
          winnerId,
          loserId,
        });

        const loser = gs.players[loserId];
        if (loser) {
          loser.isAlive = false;
          io.to(room.code).emit('tg:playerEliminated', { playerId: loserId, name: loser.name });
        }
        const winner = gs.players[winnerId];
        if (winner) winner.battleWins = (winner.battleWins || 0) + 1;

        setTimeout(() => handleNextCollisionOrAdvance(io, room, roomManager), 2000);
      }
    } catch (err) {
      console.error('tg:knowXGuess error:', err);
    }
  });

  // ── Truths & Lies ───────────────────────────────────────────────────────────

  socket.on('tg:truthsLieSubmit', ({ statements, lieIndex }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'truths-lies' || mgs.phase !== 'writing') return;

      const isCompetitor = mgs.competitors.find(c => c.socketId === socket.id);
      if (!isCompetitor) return;
      if (mgs.statements[socket.id]) return;

      const stmts = (Array.isArray(statements) ? statements : []).slice(0, 3);
      while (stmts.length < 3) stmts.push('');
      mgs.statements[socket.id] = stmts.map((text, i) => ({ text, isLie: i === lieIndex }));

      if (!mgs.submitStart) mgs.submitStart = Date.now();
      mgs.submitTimes[socket.id] = Date.now() - mgs.submitStart;

      const allSubmitted = mgs.competitors.every(c => mgs.statements[c.socketId]);
      if (allSubmitted) {
        mgs.phase = 'voting-0';
        const comp0 = mgs.competitors[0];
        io.to(room.code).emit('tg:truthsLieVoting', {
          competitorSocketId: comp0.socketId,
          competitorName: comp0.name,
          statements: mgs.statements[comp0.socketId].map(s => s.text),
        });
      }
    } catch (err) {
      console.error('tg:truthsLieSubmit error:', err);
    }
  });

  socket.on('tg:truthsLieVote', ({ competitorSocketId, lieGuessIndex }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'truths-lies') return;
      if (mgs.phase !== 'voting-0' && mgs.phase !== 'voting-1') return;

      // Voter must not be the competitor being voted on
      if (socket.id === competitorSocketId) return;

      if (!mgs.votes[competitorSocketId]) mgs.votes[competitorSocketId] = {};
      mgs.votes[competitorSocketId][socket.id] = lieGuessIndex;

      // Non-competitor voters = all alive players who are NOT the current competitor being voted on
      const allPlayers = Object.values(gs.players).filter(p => p.isAlive);
      const votersForThis = allPlayers.filter(p => p.socketId !== competitorSocketId);
      const allVoted = votersForThis.every(p => mgs.votes[competitorSocketId]?.[p.socketId] !== undefined);

      if (allVoted) {
        const currentPhase = mgs.phase;
        if (currentPhase === 'voting-0' && mgs.competitors.length > 1) {
          // Move to voting-1
          mgs.phase = 'voting-1';
          const comp1 = mgs.competitors[1];
          io.to(room.code).emit('tg:truthsLieVoting', {
            competitorSocketId: comp1.socketId,
            competitorName: comp1.name,
            statements: mgs.statements[comp1.socketId].map(s => s.text),
          });
        } else {
          // Done voting — calculate results
          resolveTruthsLies(io, room, roomManager);
        }
      }
    } catch (err) {
      console.error('tg:truthsLieVote error:', err);
    }
  });

  socket.on('tg:juiciestVote', ({ votedForId }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'truths-lies') return;

      if (!mgs.juiciestVotes[votedForId]) mgs.juiciestVotes[votedForId] = 0;
      mgs.juiciestVotes[votedForId]++;

      // Check if all non-competitors voted
      const allPlayers = Object.values(gs.players).filter(p => p.isAlive);
      const nonCompetitors = allPlayers.filter(
        p => !mgs.competitors.find(c => c.socketId === p.socketId)
      );
      const totalVotes = Object.values(mgs.juiciestVotes).reduce((a, b) => a + b, 0);
      if (totalVotes >= nonCompetitors.length) {
        // Resolve with juiciest votes
        const [id1, id2] = mgs.competitors.map(c => c.socketId);
        const v1 = mgs.juiciestVotes[id1] || 0;
        const v2 = mgs.juiciestVotes[id2] || 0;
        let winnerId, loserId;
        if (v1 >= v2) {
          winnerId = id1; loserId = id2;
        } else {
          winnerId = id2; loserId = id1;
        }
        finalizeTruthsLies(io, room, roomManager, winnerId, loserId);
      }
    } catch (err) {
      console.error('tg:juiciestVote error:', err);
    }
  });

  // ── Memory ──────────────────────────────────────────────────────────────────

  socket.on('tg:memorySubmit', ({ grid, timeMs }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;
      const mgs = gs.miniGameState;
      if (!mgs || mgs.type !== 'memory' || mgs.phase !== 'recall') return;

      const isCompetitor = mgs.competitors.find(c => c.socketId === socket.id);
      if (!isCompetitor) return;
      if (mgs.submissions[socket.id]) return;

      mgs.submissions[socket.id] = grid;
      mgs.submitTimes[socket.id] = timeMs || 0;

      const allSubmitted = mgs.competitors.every(c => mgs.submissions[c.socketId]);
      if (allSubmitted) {
        finishMemoryGame(io, room, roomManager);
      }
    } catch (err) {
      console.error('tg:memorySubmit error:', err);
    }
  });

  // ── Revival ─────────────────────────────────────────────────────────────────

  socket.on('tg:revivalRequest', () => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      const gs = room.gameState;

      const player = gs.players[socket.id];
      if (!player || player.isAlive) return;
      if (gs.revivalRequests.includes(socket.id)) return;

      const aliveCount = Object.values(gs.players).filter(p => p.isAlive).length;
      if (aliveCount < 3) return;

      gs.revivalRequests.push(socket.id);
      const requests = gs.revivalRequests.map(id => ({
        socketId: id,
        name: gs.players[id]?.name,
      }));
      io.to(room.hostSocketId).emit('tg:revivalPrompt', { requests });
    } catch (err) {
      console.error('tg:revivalRequest error:', err);
    }
  });

  socket.on('tg:revivalDecision', ({ targetPlayerId, approved }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      if (room.hostSocketId !== socket.id) return;
      const gs = room.gameState;

      gs.revivalRequests = gs.revivalRequests.filter(id => id !== targetPlayerId);

      if (approved) {
        const player = gs.players[targetPlayerId];
        if (player) {
          player.isAlive = true;
          player.position = { type: 'center' };
        }
      }

      io.to(room.code).emit('tg:revivalResult', { playerId: targetPlayerId, approved });

      const requests = gs.revivalRequests.map(id => ({
        socketId: id,
        name: gs.players[id]?.name,
      }));
      io.to(room.hostSocketId).emit('tg:revivalPrompt', { requests });
    } catch (err) {
      console.error('tg:revivalDecision error:', err);
    }
  });
};

// ── Truths & Lies resolution helpers ─────────────────────────────────────────

function resolveTruthsLies(io, room, roomManager) {
  const gs = room.gameState;
  const mgs = gs.miniGameState;
  if (!mgs || mgs.type !== 'truths-lies') return;

  mgs.phase = 'done';

  // Count how many people guessed WRONG for each competitor (= fooled count)
  const fooledCounts = {};
  const allPlayers = Object.values(gs.players).filter(p => p.isAlive);

  for (const comp of mgs.competitors) {
    const stmts = mgs.statements[comp.socketId];
    const lieIndex = stmts ? stmts.findIndex(s => s.isLie) : -1;
    let fooled = 0;
    const voterIds = Object.keys(mgs.votes[comp.socketId] || {});
    for (const vid of voterIds) {
      if (mgs.votes[comp.socketId][vid] !== lieIndex) {
        fooled++;
      }
    }
    fooledCounts[comp.socketId] = fooled;
  }

  const [id1, id2] = mgs.competitors.map(c => c.socketId);
  const f1 = fooledCounts[id1] || 0;
  const f2 = fooledCounts[id2] || 0;

  if (f1 > f2) {
    finalizeTruthsLies(io, room, roomManager, id1, id2);
  } else if (f2 > f1) {
    finalizeTruthsLies(io, room, roomManager, id2, id1);
  } else {
    // Tiebreak 1: battle wins
    const bw1 = gs.players[id1]?.battleWins || 0;
    const bw2 = gs.players[id2]?.battleWins || 0;
    if (bw1 > bw2) {
      finalizeTruthsLies(io, room, roomManager, id1, id2);
    } else if (bw2 > bw1) {
      finalizeTruthsLies(io, room, roomManager, id2, id1);
    } else {
      // Tiebreak 2: juiciest vote
      const nonCompetitors = allPlayers.filter(
        p => !mgs.competitors.find(c => c.socketId === p.socketId)
      );
      if (nonCompetitors.length === 0) {
        // Tiebreak 3: less total submit time
        const t1 = mgs.submitTimes[id1] || 0;
        const t2 = mgs.submitTimes[id2] || 0;
        const winnerId = t1 <= t2 ? id1 : id2;
        const loserId = winnerId === id1 ? id2 : id1;
        finalizeTruthsLies(io, room, roomManager, winnerId, loserId);
      } else {
        // Request juiciest vote
        mgs.juiciestVotes = {};
        io.to(room.code).emit('tg:juiciestVoteRequest', {
          competitors: mgs.competitors,
        });
      }
    }
  }
}

function finalizeTruthsLies(io, room, roomManager, winnerId, loserId) {
  const gs = room.gameState;
  const mgs = gs.miniGameState;

  const results = {};
  for (const comp of mgs.competitors) {
    const stmts = mgs.statements[comp.socketId] || [];
    const lieIndex = stmts.findIndex(s => s.isLie);
    results[comp.socketId] = {
      statements: stmts,
      lieIndex,
      fooledCount: (() => {
        let fooled = 0;
        for (const vid of Object.keys(mgs.votes[comp.socketId] || {})) {
          if (mgs.votes[comp.socketId][vid] !== lieIndex) fooled++;
        }
        return fooled;
      })(),
    };
  }

  io.to(room.code).emit('tg:truthsLieOver', { results, winnerId, loserId });

  const loser = gs.players[loserId];
  if (loser) {
    loser.isAlive = false;
    io.to(room.code).emit('tg:playerEliminated', { playerId: loserId, name: loser.name });
  }
  const winner = gs.players[winnerId];
  if (winner) winner.battleWins = (winner.battleWins || 0) + 1;

  setTimeout(() => handleNextCollisionOrAdvance(io, room, roomManager), 2000);
}
