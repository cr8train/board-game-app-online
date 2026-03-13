import { useState, useEffect } from 'react';
import socket from '../socket.js';
import PlayerList from '../components/shared/PlayerList.jsx';

export default function LobbyPage({ roomInfo, onGameStarted, onLeave }) {
  const [players, setPlayers] = useState(roomInfo.players || []);
  const [selectedGame, setSelectedGame] = useState(null);
  const [error, setError] = useState('');
  const [spinData, setSpinData] = useState(null); // { assignments, spinDurationMs }
  const [spinning, setSpinning] = useState(false);

  const isHost = roomInfo.isHost;
  const mySocketId = socket.id;

  useEffect(() => {
    function onPlayerJoined({ player }) {
      setPlayers(prev => {
        if (prev.find(p => p.socketId === player.socketId)) return prev;
        return [...prev, player];
      });
    }

    function onPlayerLeft({ socketId, room }) {
      if (room) {
        setPlayers(room.players || []);
      } else {
        setPlayers(prev => prev.filter(p => p.socketId !== socketId));
      }
    }

    function onGameSelected({ gameType }) {
      setSelectedGame(gameType);
    }

    function onStartSpin({ assignments, spinDurationMs }) {
      setSpinData({ assignments, spinDurationMs });
      setSpinning(true);

      setTimeout(() => {
        setSpinning(false);
        // Only host emits spinComplete
        if (isHost) {
          socket.emit('lobby:spinComplete');
        }
      }, spinDurationMs || 3000);
    }

    function onGameStartedHandler({ gameType, initialState }) {
      onGameStarted({ gameType, initialState });
    }

    function onLobbyError({ message }) {
      setError(message);
    }

    socket.on('lobby:playerJoined', onPlayerJoined);
    socket.on('lobby:playerLeft', onPlayerLeft);
    socket.on('lobby:gameSelected', onGameSelected);
    socket.on('lobby:startSpin', onStartSpin);
    socket.on('game:started', onGameStartedHandler);
    socket.on('lobby:error', onLobbyError);

    return () => {
      socket.off('lobby:playerJoined', onPlayerJoined);
      socket.off('lobby:playerLeft', onPlayerLeft);
      socket.off('lobby:gameSelected', onGameSelected);
      socket.off('lobby:startSpin', onStartSpin);
      socket.off('game:started', onGameStartedHandler);
      socket.off('lobby:error', onLobbyError);
    };
  }, [isHost, roomInfo, onGameStarted]);

  function handleSelectGame(gameType) {
    if (!isHost) return;
    setSelectedGame(gameType);
    socket.emit('lobby:selectGame', { gameType });
  }

  function handleStartGame() {
    if (!isHost) return;
    if (!selectedGame) { setError('Select a game first'); return; }
    setError('');
    socket.emit('lobby:startGame');
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(roomInfo.roomCode).catch(() => {});
  }

  const myAssignment = spinData?.assignments?.find(a => a.socketId === mySocketId);

  return (
    <div className="lobby-layout">
      {/* Spin overlay */}
      {spinning && spinData && (
        <div className="overlay">
          <div className="overlay-box">
            <h2 className="glow-gold" style={{ marginBottom: '0.5rem' }}>
              District Assignments
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              The reaping has begun...
            </p>
            <div className="spin-assignments">
              {spinData.assignments.map(a => (
                <div
                  key={a.socketId}
                  className="spin-assignment-row"
                  style={a.socketId === mySocketId ? { borderColor: 'var(--accent-gold)' } : {}}
                >
                  <span className="player-name">{a.name}</span>
                  <span className="spin-district-badge">District {a.district}</span>
                  {a.socketId === mySocketId && (
                    <span className="badge badge-host" style={{ marginLeft: '0.5rem' }}>YOU</span>
                  )}
                </div>
              ))}
            </div>
            <p className="pulse" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Starting game...
            </p>
          </div>
        </div>
      )}

      <div className="lobby-header">
        <div>
          <p className="section-label">Room Code</p>
          <div className="lobby-code-display">
            <span className="lobby-code-big">{roomInfo.roomCode}</span>
            <button className="btn-secondary btn-sm" onClick={handleCopyCode}>Copy</button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Share this code with friends to join
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {isHost && (
            <button
              className="btn-primary btn-lg"
              disabled={!selectedGame || players.length < 1}
              onClick={handleStartGame}
            >
              Start Game
            </button>
          )}
          <button className="btn-secondary" onClick={onLeave}>Leave</button>
        </div>
      </div>

      <div className="lobby-body">
        {/* Players */}
        <div>
          <p className="section-label">Players ({players.length})</p>
          <PlayerList
            players={players}
            mySocketId={mySocketId}
            hostSocketId={players.find(p => p.isHost)?.socketId}
          />
          {players.length < 2 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
              Waiting for more players to join...
            </p>
          )}
        </div>

        {/* Game selection */}
        <div>
          <p className="section-label">Choose a Game</p>
          {!isHost && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Waiting for the host to select a game...
            </p>
          )}
          <div className="game-select-btns">
            <button
              className={`game-option-btn ${selectedGame === 'thirsty-games' ? 'selected' : ''}`}
              onClick={() => handleSelectGame('thirsty-games')}
              disabled={!isHost}
            >
              <h4>The Thirsty Games</h4>
              <p>Battle for survival on a hexagonal board. Avoid the storm, defeat rivals in mini-games.</p>
            </button>
            <button
              className={`game-option-btn ${selectedGame === 'maze-runner' ? 'selected' : ''}`}
              onClick={() => handleSelectGame('maze-runner')}
              disabled={!isHost}
            >
              <h4>Maze Runner</h4>
              <p>Race through a procedurally generated maze. First player to reach the exit wins!</p>
            </button>
          </div>

          {selectedGame && (
            <p className="success-msg" style={{ marginTop: '0.75rem' }}>
              Selected: <strong>{selectedGame === 'thirsty-games' ? 'The Thirsty Games' : 'Maze Runner'}</strong>
            </p>
          )}
          {error && <p className="error-msg">{error}</p>}
        </div>
      </div>
    </div>
  );
}
