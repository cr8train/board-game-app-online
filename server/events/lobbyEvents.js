const { initThirstyGamesState } = require('../games/thirsty-games/ThirstyGamesEngine');
const { initMazeRunnerState } = require('../games/maze-runner/MazeRunnerEngine');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = function registerLobbyEvents(io, socket, roomManager) {
  socket.on('lobby:create', ({ playerName }) => {
    try {
      const roomCode = roomManager.createRoom(socket.id, playerName);
      const room = roomManager.getRoom(roomCode);
      const player = room.players.get(socket.id);
      socket.join(roomCode);
      socket.emit('lobby:created', { roomCode });
      io.to(roomCode).emit('lobby:playerJoined', { player: { socketId: player.socketId, name: player.name, isHost: player.isHost } });
    } catch (err) {
      socket.emit('lobby:error', { message: err.message });
    }
  });

  socket.on('lobby:join', ({ roomCode, playerName }) => {
    try {
      const result = roomManager.joinRoom(roomCode, socket.id, playerName);
      if (!result) {
        socket.emit('lobby:error', { message: 'Room not found' });
        return;
      }
      const { room, player } = result;
      socket.join(room.code);
      const publicRoom = roomManager.getPublicRoom(room.code);
      socket.emit('lobby:joined', { room: publicRoom });
      // Broadcast to others in room (excluding the joiner)
      socket.to(room.code).emit('lobby:playerJoined', { player: { socketId: player.socketId, name: player.name, isHost: player.isHost } });
    } catch (err) {
      socket.emit('lobby:error', { message: err.message });
    }
  });

  socket.on('lobby:selectGame', ({ gameType }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      room.gameType = gameType;
      io.to(room.code).emit('lobby:gameSelected', { gameType });
    } catch (err) {
      socket.emit('lobby:error', { message: err.message });
    }
  });

  socket.on('lobby:startGame', () => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;
      if (!room.gameType) {
        socket.emit('lobby:error', { message: 'No game selected' });
        return;
      }
      const players = Array.from(room.players.values());
      if (players.length < 1) {
        socket.emit('lobby:error', { message: 'Need at least 1 player' });
        return;
      }

      const shuffled = shuffle(players);
      const assignments = shuffled.map((p, i) => ({
        socketId: p.socketId,
        name: p.name,
        district: i + 1,
      }));

      room.phase = 'spinning';

      io.to(room.code).emit('lobby:startSpin', {
        assignments,
        spinDurationMs: 3000,
      });
    } catch (err) {
      socket.emit('lobby:error', { message: err.message });
    }
  });

  socket.on('lobby:spinComplete', () => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room) return;
      if (room.hostSocketId !== socket.id) return;

      room.phase = 'playing';

      let initialState;
      if (room.gameType === 'thirsty-games') {
        // Build assignments from players
        const players = Array.from(room.players.values());
        const shuffled = shuffle(players);
        const assignments = shuffled.map((p, i) => ({
          socketId: p.socketId,
          name: p.name,
          district: i + 1,
        }));
        initialState = initThirstyGamesState(assignments);
      } else if (room.gameType === 'maze-runner') {
        const players = Array.from(room.players.values());
        initialState = initMazeRunnerState(players);
      }

      room.gameState = initialState;

      io.to(room.code).emit('game:started', {
        gameType: room.gameType,
        initialState,
      });
    } catch (err) {
      console.error('lobby:spinComplete error:', err);
      socket.emit('lobby:error', { message: err.message });
    }
  });
};
