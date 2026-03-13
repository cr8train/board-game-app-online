import { useEffect, useCallback } from 'react';
import socket from '../../../socket.js';
import MazeBoard from '../../maze-runner/MazeBoard.jsx';

const COMPETITOR_COLORS = ['#f0a500', '#4cc9f0', '#7b2ff7', '#00d4aa', '#e63946', '#ff6b35'];

export default function MazeMiniGame({ miniGameState, collision, mySocketId }) {
  if (!miniGameState) return null;

  const { competitors, maze, positions, winner } = miniGameState;
  const isCompetitor = competitors.some(c => c.socketId === mySocketId);
  const myPos = positions?.[mySocketId];
  const hasFinished = myPos?.finished;

  // Build colorMap for the two competitors
  const colorMap = {};
  competitors.forEach((c, i) => {
    colorMap[c.socketId] = COMPETITOR_COLORS[i % COMPETITOR_COLORS.length];
  });

  // Build players object compatible with MazeBoard (needs x, y, socketId, name, finished)
  const mazePlayers = {};
  for (const c of competitors) {
    const pos = positions?.[c.socketId] || { x: 0, y: 0, finished: false };
    mazePlayers[c.socketId] = {
      socketId: c.socketId,
      name: c.name,
      x: pos.x,
      y: pos.y,
      finished: pos.finished,
    };
  }

  const move = useCallback((direction) => {
    if (!isCompetitor || hasFinished) return;
    socket.emit('tg:mazeMiniMove', { direction });
  }, [isCompetitor, hasFinished]);

  useEffect(() => {
    function onKeyDown(e) {
      const keyMap = {
        ArrowUp: 'UP',
        ArrowDown: 'DOWN',
        ArrowLeft: 'LEFT',
        ArrowRight: 'RIGHT',
        w: 'UP', W: 'UP',
        s: 'DOWN', S: 'DOWN',
        a: 'LEFT', A: 'LEFT',
        d: 'RIGHT', D: 'RIGHT',
      };
      const dir = keyMap[e.key];
      if (dir) {
        e.preventDefault();
        move(dir);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [move]);

  return (
    <div>
      <h2 style={{ color: 'var(--accent-teal)', marginBottom: '0.4rem' }}>🌀 Maze Duel</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
        Race to the exit! Fastest wins.
      </p>

      {/* Competitor legend */}
      <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
        {competitors.map((c, i) => (
          <div key={c.socketId} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: COMPETITOR_COLORS[i % COMPETITOR_COLORS.length],
                border: c.socketId === mySocketId ? '2px solid white' : '1.5px solid rgba(255,255,255,0.4)',
              }}
            />
            <span style={{ color: c.socketId === mySocketId ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {c.name}{c.socketId === mySocketId ? ' (you)' : ''}
              {positions?.[c.socketId]?.finished ? ' ✓' : ''}
            </span>
          </div>
        ))}
      </div>

      {/* Maze board */}
      {maze && (
        <div style={{ overflowX: 'auto' }}>
          <MazeBoard
            maze={maze}
            players={mazePlayers}
            colorMap={colorMap}
            mySocketId={mySocketId}
          />
        </div>
      )}

      {/* Controls for competitors */}
      {isCompetitor && !hasFinished && !winner && (
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: '4px', justifyContent: 'center', margin: '0 auto' }}>
            <div />
            <button className="btn-secondary btn-sm" style={{ padding: '0.4rem' }} onClick={() => move('UP')}>↑</button>
            <div />
            <button className="btn-secondary btn-sm" style={{ padding: '0.4rem' }} onClick={() => move('LEFT')}>←</button>
            <button className="btn-secondary btn-sm" style={{ padding: '0.4rem' }} onClick={() => move('DOWN')}>↓</button>
            <button className="btn-secondary btn-sm" style={{ padding: '0.4rem' }} onClick={() => move('RIGHT')}>→</button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
            Arrow keys or WASD also work
          </p>
        </div>
      )}

      {isCompetitor && hasFinished && !winner && (
        <p className="pulse" style={{ color: 'var(--accent-teal)', marginTop: '0.75rem', textAlign: 'center' }}>
          You escaped! Waiting for opponent...
        </p>
      )}

      {!isCompetitor && !winner && (
        <p className="pulse" style={{ color: 'var(--text-secondary)', marginTop: '0.75rem', textAlign: 'center' }}>
          Watching the maze duel...
        </p>
      )}

      {winner && (
        <p style={{ color: 'var(--accent-gold)', fontWeight: 700, marginTop: '0.75rem', textAlign: 'center' }}>
          {winner === mySocketId ? 'You won the maze duel!' : `${competitors.find(c => c.socketId === winner)?.name} escaped first!`}
        </p>
      )}
    </div>
  );
}
