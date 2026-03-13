const { applyMazeMove } = require('../games/maze-runner/MazeRunnerEngine');

module.exports = function registerMazeRunnerEvents(io, socket, roomManager) {
  socket.on('mr:move', ({ direction }) => {
    try {
      const room = roomManager.getRoomByPlayer(socket.id);
      if (!room || !room.gameState) return;
      if (room.gameType !== 'maze-runner') return;

      const gs = room.gameState;
      if (gs.phase === 'ended') return;

      const result = applyMazeMove(gs, socket.id, direction);
      if (!result.moved) return;

      // Emit updated state to all players in room
      io.to(room.code).emit('mr:stateUpdate', { state: gs });

      if (result.finished) {
        const player = gs.players[socket.id];
        io.to(room.code).emit('mr:playerFinished', {
          socketId: socket.id,
          name: player.name,
          finishOrder: gs.finishOrder.length,
        });

        // Check if all players have finished
        const allPlayers = Object.values(gs.players);
        const allFinished = allPlayers.every(p => p.finished);

        if (allFinished) {
          gs.phase = 'ended';
          const winner = gs.players[gs.winner];
          io.to(room.code).emit('mr:gameOver', {
            winner: winner ? { socketId: winner.socketId, name: winner.name } : null,
            finishOrder: gs.finishOrder.map(id => ({
              socketId: id,
              name: gs.players[id]?.name,
              finishTime: gs.players[id]?.finishTime,
            })),
          });
        } else {
          // End game when first player finishes (as specified: "first to finish wins")
          gs.phase = 'ended';
          io.to(room.code).emit('mr:gameOver', {
            winner: { socketId: player.socketId, name: player.name },
            finishOrder: gs.finishOrder.map(id => ({
              socketId: id,
              name: gs.players[id]?.name,
              finishTime: gs.players[id]?.finishTime,
            })),
          });
        }
      }
    } catch (err) {
      console.error('mr:move error:', err);
    }
  });
};
