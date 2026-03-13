const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const RoomManager = require('./RoomManager');
const registerLobbyEvents = require('./events/lobbyEvents');
const registerThirstyGamesEvents = require('./events/thirstyGamesEvents');
const registerMazeRunnerEvents = require('./events/mazeRunnerEvents');

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

const roomManager = new RoomManager();

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  registerLobbyEvents(io, socket, roomManager);
  registerThirstyGamesEvents(io, socket, roomManager);
  registerMazeRunnerEvents(io, socket, roomManager);

  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);
    const result = roomManager.removePlayer(socket.id);
    if (result) {
      const { room, wasHost } = result;
      const publicRoom = roomManager.getPublicRoom(room.code);
      io.to(room.code).emit('lobby:playerLeft', {
        socketId: socket.id,
        wasHost,
        room: publicRoom,
      });
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: roomManager.rooms.size });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Board game server listening on port ${PORT}`);
});
