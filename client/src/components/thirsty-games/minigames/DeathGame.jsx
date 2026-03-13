import { useState } from 'react';
import socket from '../../../socket.js';

export default function DeathGame({ miniGameState, collision, mySocketId, isHost }) {
  const [number, setNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [survivors, setSurvivors] = useState(() => {
    const init = {};
    for (const c of (miniGameState?.competitors || [])) {
      init[c.socketId] = true; // default: all survive
    }
    return init;
  });

  if (!miniGameState) return null;

  const { competitors, numbers, revealed } = miniGameState;
  const isCompetitor = competitors.some(c => c.socketId === mySocketId);

  function handleSubmit() {
    if (!number.trim() || submitted) return;
    socket.emit('tg:deathSubmit', { number: number.trim() });
    setSubmitted(true);
  }

  function handleDecision() {
    const survivorIds = Object.entries(survivors)
      .filter(([, v]) => v)
      .map(([id]) => id);
    socket.emit('tg:deathDecision', { survivorIds });
  }

  return (
    <div>
      <h2 style={{ color: '#e63946', marginBottom: '0.4rem' }}>⚰️ Death</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        Each player picks a number. The host decides who survives.
      </p>

      <p style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        Collision between:{' '}
        <strong style={{ color: 'var(--text-primary)' }}>
          {competitors.map(c => c.name).join(' vs ')}
        </strong>
      </p>

      {/* Competitor input */}
      {isCompetitor && !revealed && (
        <div style={{ marginBottom: '1rem' }}>
          {!submitted ? (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <input
                type="text"
                value={number}
                onChange={e => setNumber(e.target.value)}
                placeholder="Enter your number"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '1rem',
                  width: 180,
                }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button className="btn-primary" onClick={handleSubmit} disabled={!number.trim()}>
                Submit
              </button>
            </div>
          ) : (
            <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
              Waiting for others...
            </p>
          )}
        </div>
      )}

      {/* Non-competitor waiting */}
      {!isCompetitor && !revealed && (
        <p className="pulse" style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
          Waiting for competitors to submit their numbers...
        </p>
      )}

      {/* Revealed numbers */}
      {revealed && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Numbers revealed:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {competitors.map(c => (
              <div
                key={c.socketId}
                style={{
                  background: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.5rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderLeft: '3px solid #e63946',
                }}
              >
                <strong>{c.name}</strong>
                <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontSize: '1.1rem' }}>
                  {numbers[c.socketId] ?? '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Host decision */}
      {isHost && revealed && (
        <div>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Who survives?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            {competitors.map(c => (
              <label
                key={c.socketId}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={!!survivors[c.socketId]}
                  onChange={e => setSurvivors(prev => ({ ...prev, [c.socketId]: e.target.checked }))}
                />
                <span>{c.name}</span>
              </label>
            ))}
          </div>
          <button className="btn-primary" onClick={handleDecision}>
            Confirm Decision
          </button>
        </div>
      )}

      {/* Non-host waiting for decision */}
      {!isHost && revealed && (
        <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
          Waiting for host to decide...
        </p>
      )}
    </div>
  );
}
