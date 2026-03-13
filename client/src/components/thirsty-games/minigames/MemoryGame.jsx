import { useState, useEffect, useRef } from 'react';
import socket from '../../../socket.js';

const COLOR_MAP = {
  'white':    '#ffffff',
  'black':    '#222222',
  'magenta':  '#ff00ff',
  'baby-blue':'#89cff0',
};

const COLOR_CYCLE = ['white', 'black', 'magenta', 'baby-blue'];

function nextColor(current) {
  const idx = COLOR_CYCLE.indexOf(current);
  return COLOR_CYCLE[(idx + 1) % COLOR_CYCLE.length];
}

export default function MemoryGame({ miniGameState, mySocketId }) {
  const [countdown, setCountdown] = useState(15);
  const [recallGrid, setRecallGrid] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const recallStartRef = useRef(null);
  const timerRef = useRef(null);

  if (!miniGameState) return null;

  const { competitors, grid, showingGrid, phase } = miniGameState;
  const isCompetitor = competitors.some(c => c.socketId === mySocketId);

  // Memorize phase countdown
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (phase !== 'memorize') return;
    setCountdown(15);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  // When phase switches to recall, init recall grid and start timer
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (phase === 'recall' && !recallGrid) {
      const blank = Array.from({ length: 5 }, () => Array(5).fill('white'));
      setRecallGrid(blank);
      recallStartRef.current = Date.now();
    }
  }, [phase, recallGrid]);

  function handleCellClick(r, c) {
    if (!isCompetitor || submitted || phase !== 'recall') return;
    setRecallGrid(prev => {
      const next = prev.map(row => [...row]);
      next[r][c] = nextColor(next[r][c]);
      return next;
    });
  }

  function handleSubmit() {
    if (submitted || !recallGrid) return;
    const timeMs = recallStartRef.current ? Date.now() - recallStartRef.current : 0;
    socket.emit('tg:memorySubmit', { grid: recallGrid, timeMs });
    setSubmitted(true);
  }

  function renderGrid(displayGrid, clickable = false, dimmed = false) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 44px)',
        gridTemplateRows: 'repeat(5, 44px)',
        gap: 3,
        margin: '0 auto',
        width: 'fit-content',
      }}>
        {displayGrid.map((row, r) =>
          row.map((color, c) => (
            <div
              key={`${r}-${c}`}
              onClick={() => clickable && handleCellClick(r, c)}
              style={{
                width: 44,
                height: 44,
                background: dimmed ? '#555' : COLOR_MAP[color] || '#888',
                borderRadius: 4,
                border: '2px solid rgba(255,255,255,0.15)',
                cursor: clickable ? 'pointer' : 'default',
                transition: 'background 0.15s',
                boxSizing: 'border-box',
              }}
            />
          ))
        )}
      </div>
    );
  }

  // Memorize phase
  if (phase === 'memorize') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h2 style={{ color: '#7b2ff7', margin: 0 }}>🧩 Memory Challenge</h2>
          <div style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: countdown <= 5 ? '#e63946' : 'var(--accent-gold)',
            minWidth: 32,
            textAlign: 'right',
          }}>
            {countdown}s
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Memorize this grid! It will disappear.
        </p>
        {grid && renderGrid(grid)}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
          {COLOR_CYCLE.map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <div style={{ width: 14, height: 14, background: COLOR_MAP[c], borderRadius: 2, border: '1px solid rgba(255,255,255,0.3)' }} />
              {c}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Recall phase
  if (phase === 'recall') {
    return (
      <div>
        <h2 style={{ color: '#7b2ff7', marginBottom: '0.4rem' }}>🧩 Memory Challenge — Recall!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
          {isCompetitor
            ? 'Recreate the grid! Click cells to cycle colors.'
            : 'Competitors are recreating the grid...'}
        </p>

        {isCompetitor && recallGrid && (
          <>
            {renderGrid(recallGrid, !submitted)}
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {COLOR_CYCLE.map(c => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: 14, height: 14, background: COLOR_MAP[c], borderRadius: 2, border: '1px solid rgba(255,255,255,0.3)' }} />
                  {c}
                </div>
              ))}
            </div>
            {!submitted ? (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button className="btn-primary" onClick={handleSubmit}>
                  Submit Grid
                </button>
              </div>
            ) : (
              <p className="pulse" style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.75rem' }}>
                Submitted — waiting for opponent...
              </p>
            )}
          </>
        )}

        {!isCompetitor && grid && (
          <>
            {renderGrid(grid, false, false)}
            <p className="pulse" style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '0.75rem' }}>
              Competitors are recreating the grid...
            </p>
          </>
        )}
      </div>
    );
  }

  if (phase === 'done') {
    const { scores, winnerId, grid: originalGrid } = miniGameState;
    return (
      <div>
        <h2 style={{ color: '#7b2ff7', marginBottom: '0.75rem' }}>🧩 Memory Challenge — Results!</h2>
        {scores ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {competitors.map(c => {
                const s = scores[c.socketId];
                const pct = Math.round((s?.pct ?? 0) * 100);
                const isWinner = c.socketId === winnerId;
                return (
                  <div key={c.socketId} style={{
                    background: isWinner ? 'rgba(123,47,247,0.12)' : 'var(--bg-elevated)',
                    border: `2px solid ${isWinner ? '#7b2ff7' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <strong>{c.name}{isWinner ? ' 🏆' : ''}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {pct}% correct &bull; {((s?.timeMs ?? 0) / 1000).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
            {originalGrid && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Original grid:</p>
                {renderGrid(originalGrid)}
              </div>
            )}
            <p className="pulse" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Continuing game...</p>
          </>
        ) : (
          <p className="pulse" style={{ color: 'var(--text-secondary)' }}>Calculating results...</p>
        )}
      </div>
    );
  }

  return null;
}
