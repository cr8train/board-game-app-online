class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.playerToRoom = new Map();
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do {
      code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostSocketId, hostName) {
    const code = this.generateCode();
    const player = { socketId: hostSocketId, name: hostName, isHost: true };
    const room = {
      code,
      hostSocketId,
      gameType: null,
      players: new Map([[hostSocketId, player]]),
      gameState: null,
      phase: 'lobby',
    };
    this.rooms.set(code, room);
    this.playerToRoom.set(hostSocketId, code);
    return code;
  }

  joinRoom(code, socketId, name) {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    const player = { socketId, name, isHost: false };
    room.players.set(socketId, player);
    this.playerToRoom.set(socketId, code.toUpperCase());
    return { room, player };
  }

  getRoom(code) {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomByPlayer(socketId) {
    const code = this.playerToRoom.get(socketId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  removePlayer(socketId) {
    const code = this.playerToRoom.get(socketId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.get(socketId);
    if (!player) return null;

    const wasHost = player.isHost;
    room.players.delete(socketId);
    this.playerToRoom.delete(socketId);

    return { room, wasHost };
  }

  getPublicRoom(code) {
    const room = this.rooms.get(code.toUpperCase ? code.toUpperCase() : code);
    if (!room) return null;
    return {
      code: room.code,
      hostSocketId: room.hostSocketId,
      gameType: room.gameType,
      players: Array.from(room.players.values()).map(p => ({
        socketId: p.socketId,
        name: p.name,
        isHost: p.isHost,
      })),
      phase: room.phase,
    };
  }
}

module.exports = RoomManager;
