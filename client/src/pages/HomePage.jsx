import { useState } from 'react';
import socket from '../socket.js';

export default function HomePage({ onEnterLobby }) {
  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState(null); // null | 'create' | 'join'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function connect() {
    if (!socket.connected) {
      socket.connect();
    }
  }

  function handleCreate() {
    const name = playerName.trim();
    if (!name) { setError('Please enter your name'); return; }

    setError('');
    setLoading(true);
    connect();

    socket.once('lobby:created', ({ roomCode }) => {
      setLoading(false);
      onEnterLobby({
        roomCode,
        playerName: name,
        socketId: socket.id,
        isHost: true,
        players: [{ socketId: socket.id, name, isHost: true }],
      });
    });

    socket.once('lobby:error', ({ message }) => {
      setLoading(false);
      setError(message);
    });

    socket.emit('lobby:create', { playerName: name });
  }

  function handleJoin() {
    const name = playerName.trim();
    const code = joinCode.trim().toUpperCase();
    if (!name) { setError('Please enter your name'); return; }
    if (!code || code.length !== 4) { setError('Enter a valid 4-character room code'); return; }

    setError('');
    setLoading(true);
    connect();

    socket.once('lobby:joined', ({ room }) => {
      setLoading(false);
      onEnterLobby({
        roomCode: room.code,
        playerName: name,
        socketId: socket.id,
        isHost: false,
        players: room.players,
      });
    });

    socket.once('lobby:error', ({ message }) => {
      setLoading(false);
      setError(message);
    });

    socket.emit('lobby:join', { roomCode: code, playerName: name });
  }

  return (
    <div className="page-container">
      <div className="page-content">
        <div className="home-logo">
          <h1>Board Game Arena</h1>
          <p>Multiplayer games for 2-6 players</p>
        </div>

        <div className="card">
          <div className="home-section">
            <h3>Your Name</h3>
            <input
              type="text"
              placeholder="Enter your name..."
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={20}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (mode === 'create') handleCreate();
                  else if (mode === 'join') handleJoin();
                }
              }}
            />
          </div>

          <div className="home-section">
            <h3>Play</h3>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button
                className={`btn-secondary ${mode === 'create' ? 'game-option-btn selected' : ''}`}
                style={{ flex: 1, padding: '0.75rem' }}
                onClick={() => setMode('create')}
              >
                Create Room
              </button>
              <button
                className={`btn-secondary ${mode === 'join' ? 'game-option-btn selected' : ''}`}
                style={{ flex: 1, padding: '0.75rem' }}
                onClick={() => setMode('join')}
              >
                Join Room
              </button>
            </div>

            {mode === 'join' && (
              <div style={{ marginBottom: '0.75rem' }}>
                <input
                  type="text"
                  placeholder="Room code (e.g. AB3K)"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700 }}
                />
              </div>
            )}

            {mode && (
              <button
                className="btn-primary btn-lg"
                style={{ width: '100%' }}
                disabled={loading}
                onClick={mode === 'create' ? handleCreate : handleJoin}
              >
                {loading ? 'Connecting...' : mode === 'create' ? 'Create Room' : 'Join Room'}
              </button>
            )}

            {error && <p className="error-msg">{error}</p>}
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '1.5rem' }}>
          Games: The Thirsty Games • Maze Runner
        </p>
      </div>
    </div>
  );
}
