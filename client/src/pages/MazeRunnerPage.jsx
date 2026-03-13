import { useState, useEffect, useCallback } from 'react';
import socket from '../socket.js';
import MazeBoard from '../components/maze-runner/MazeBoard.jsx';
import MazeControls from '../components/maze-runner/MazeControls.jsx';
import PlayerList from '../components/shared/PlayerList.jsx';

const PLAYER_COLORS = ['#f0a500', '#00d4aa', '#7b2ff7', '#e63946', '#4cc9f0', '#ff6b35'];

export default function MazeRunnerPage({ initialState, roomInfo, onLeave }) {
  const [state, setState] = useState(initialState);
  const [gameOver, setGameOver] = useState(null);
  const [finishedPlayers, setFinishedPlayers] = useState([]);

  const mySocketId = socket.id;
  const myPlayer = state?.players?.[mySocketId];
  const isFinished = myPlayer?.finished ?? false;
  const phase = state?.phase;

  useEffect(() => {
    function onStateUpdate({ state: newState }) {
      setState(newState);
    }

    function onPlayerFinished({ socketId, name, finishOrder }) {
      setFinishedPlayers(prev => {
        if (prev.find(p => p.socketId === socketId)) return prev;
        return [...prev, { socketId, name, finishOrder }];
      });
    }

    function onGameOver({ winner, finishOrder }) {
      setGameOver({ winner, finishOrder });
      setState(prev => prev ? { ...prev, phase: 'ended' } : prev);
    }

    socket.on('mr:stateUpdate', onStateUpdate);
    socket.on('mr:playerFinished', onPlayerFinished);
    socket.on('mr:gameOver', onGameOver);

    return () => {
      socket.off('mr:stateUpdate', onStateUpdate);
      socket.off('mr:playerFinished', onPlayerFinished);
      socket.off('mr:gameOver', onGameOver);
    };
  }, []);

  const sendMove = useCallback((direction) => {
    if (isFinished || phase === 'ended') return;
    socket.emit('mr:move', { direction });
  }, [isFinished, phase]);

  useEffect(() => {
    function onKeyDown(e) {
      if (isFinished || phase === 'ended') return;
      const map = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        w: 'UP',
        s: 'DOWN',
        a: 'LEFT',
        d: 'RIGHT',
        W: 'UP',
        S: 'DOWN',
        A: 'LEFT',
        D: 'RIGHT',
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        sendMove(dir);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sendMove, isFinished, phase]);

  // Build color map for players
  const playerList = state ? Object.values(state.players) : [];
  const colorMap = {};
  playerList.forEach((p, i) => {
    colorMap[p.socketId] = PLAYER_COLORS[i % PLAYER_COLORS.length];
  });

  const lobbyPlayers = playerList.map(p => ({
    socketId: p.socketId,
    name: p.name,
    isHost: p.socketId === roomInfo.players?.find(rp => rp.isHost)?.socketId,
  }));

  return (
    <div className="game-layout">
      {/* Game over overlay */}
      {gameOver && (
        <div className="overlay">
          <div className="overlay-box">
            <h2 className="glow-gold" style={{ marginBottom: '0.75rem' }}>Race Complete!</h2>
            {gameOver.winner ? (
              <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                Winner: <strong style={{ color: 'var(--accent-gold)' }}>{gameOver.winner.name}</strong>
              </p>
            ) : (
              <p>No winner.</p>
            )}
            {gameOver.winner?.socketId === mySocketId && (
              <p style={{ color: 'var(--accent-teal)', margin: '0.5rem 0' }}>You escaped the maze first!</p>
            )}
            {gameOver.finishOrder && gameOver.finishOrder.length > 0 && (
              <>
                <p className="section-label" style={{ marginTop: '1rem' }}>Finish Order</p>
                <ol className="finish-order-list">
                  {gameOver.finishOrder.map((p, i) => (
                    <li key={p.socketId}>
                      <span className="finish-rank">#{i + 1}</span>
                      <span style={{ color: colorMap[p.socketId] || 'white' }}>{p.name}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            <button className="btn-primary btn-lg" style={{ marginTop: '1.5rem' }} onClick={onLeave}>
              Back to Home
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="game-header">
        <h3 style={{ color: 'var(--accent-teal)', flex: 1 }}>Maze Runner</h3>
        {isFinished && !gameOver && (
          <span className="badge badge-winner">You finished! Waiting for others...</span>
        )}
        {phase === 'ended' && !gameOver && (
          <span className="badge badge-winner">Race Over</span>
        )}
        <button className="btn-secondary btn-sm" onClick={onLeave}>Leave</button>
      </div>

      <div className="game-body">
        {/* Sidebar */}
        <div className="game-sidebar">
          <div>
            <p className="section-label">Players</p>
            <div className="player-list">
              {playerList.map(p => (
                <div key={p.socketId} className="player-list-item">
                  <div
                    className="player-avatar"
                    style={{ background: colorMap[p.socketId] || '#888', color: '#0f0f1a' }}
                  >
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="player-name">
                      {p.name}
                      {p.socketId === mySocketId && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.4rem' }}>(you)</span>
                      )}
                    </div>
                    {p.finished ? (
                      <div className="player-info" style={{ color: 'var(--accent-teal)' }}>Finished!</div>
                    ) : (
                      <div className="player-info">({p.x}, {p.y})</div>
                    )}
                  </div>
                  {p.finished && <span className="badge badge-winner">Done</span>}
                </div>
              ))}
            </div>
          </div>

          <hr className="divider" />

          {!isFinished && phase !== 'ended' && (
            <MazeControls
              onMove={sendMove}
              myPlayer={myPlayer}
            />
          )}

          {isFinished && (
            <div style={{ textAlign: 'center', padding: '0.5rem' }}>
              <p className="glow-teal" style={{ fontWeight: 700 }}>You escaped!</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                Waiting for other players...
              </p>
            </div>
          )}

          <div style={{ marginTop: 'auto', padding: '0.5rem 0' }}>
            <p className="section-label">How to play</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Use arrow keys or WASD to move. Reach the exit at the bottom-right corner first to win!
            </p>
          </div>
        </div>

        {/* Maze */}
        <div className="game-main">
          {state?.maze && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <MazeBoard
                maze={state.maze}
                players={state.players}
                colorMap={colorMap}
                mySocketId={mySocketId}
              />
              {myPlayer && (
                <p className="maze-pos-display">
                  Your position: ({myPlayer.x}, {myPlayer.y}) &bull; Exit: (14, 14)
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
