import { useState } from 'react';

const MOVE_LABELS = {
  UP: '↑ OUT',
  DOWN: '↓ IN',
  LEFT: '← LEFT',
  RIGHT: '→ RIGHT',
  CENTER: '◎ STAY',
};

export default function MoveSubmitter({
  movesAllowed,
  onSubmit,
  hasSubmitted,
  players = [],
  submittedIds,
  myPlayer,
}) {
  const [sequence, setSequence] = useState([]);
  const [preferredWedge, setPreferredWedge] = useState(myPlayer?.preferredWedge || 'A');

  const alivePlayers = players.filter(p => p.isAlive);
  const submittedCount = alivePlayers.filter(p => submittedIds?.has(p.socketId)).length;

  function addMove(move) {
    if (sequence.length >= movesAllowed) return;
    setSequence(prev => [...prev, move]);
  }

  function removeLastMove() {
    setSequence(prev => prev.slice(0, -1));
  }

  function clearMoves() {
    setSequence([]);
  }

  function handleSubmit() {
    if (hasSubmitted) return;
    const padded = [...sequence];
    while (padded.length < movesAllowed) padded.push('CENTER');
    onSubmit(padded, preferredWedge);
  }

  const atCenter = myPlayer?.position?.type === 'center';

  if (hasSubmitted) {
    return (
      <div className="move-submitter">
        <p className="section-label">Moves</p>
        <p style={{ color: 'var(--accent-teal)', fontWeight: 600, fontSize: '0.9rem' }}>
          Moves submitted! ({submittedCount}/{alivePlayers.length})
        </p>
      </div>
    );
  }

  return (
    <div className="move-submitter">
      <p className="section-label">
        Submit Moves ({sequence.length}/{movesAllowed})
      </p>

      {/* Move sequence display */}
      <div className="move-sequence">
        {sequence.map((m, i) => (
          <span key={i} className="move-chip">{m}</span>
        ))}
        {sequence.length === 0 && (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', alignSelf: 'center' }}>
            No moves yet
          </span>
        )}
      </div>

      {/* Move buttons */}
      <div className="move-buttons">
        <div />
        <button
          className="move-btn"
          onClick={() => addMove('UP')}
          disabled={sequence.length >= movesAllowed}
        >
          ↑ Out
        </button>
        <div />
        <button
          className="move-btn"
          onClick={() => addMove('LEFT')}
          disabled={sequence.length >= movesAllowed || atCenter}
        >
          ↺ CCW
        </button>
        <button
          className="move-btn"
          onClick={() => addMove('CENTER')}
          disabled={sequence.length >= movesAllowed}
        >
          Stay
        </button>
        <button
          className="move-btn"
          onClick={() => addMove('RIGHT')}
          disabled={sequence.length >= movesAllowed || atCenter}
        >
          ↻ CW
        </button>
        <div />
        <button
          className="move-btn"
          onClick={() => addMove('DOWN')}
          disabled={sequence.length >= movesAllowed}
        >
          ↓ In
        </button>
        <div />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <button className="btn-secondary btn-sm" onClick={removeLastMove} disabled={sequence.length === 0}>
          Undo
        </button>
        <button className="btn-secondary btn-sm" onClick={clearMoves} disabled={sequence.length === 0}>
          Clear
        </button>
      </div>

      {atCenter && (
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
            Preferred wedge when moving out:
          </label>
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {['A','B','C','D','E','F'].map(w => (
              <button
                key={w}
                className={preferredWedge === w ? 'btn-teal btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => setPreferredWedge(w)}
                style={{ minWidth: 32 }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn-primary"
        style={{ width: '100%' }}
        onClick={handleSubmit}
        disabled={hasSubmitted}
      >
        Submit ({sequence.length || movesAllowed} moves)
      </button>

      <div className="submitted-list" style={{ marginTop: '0.5rem' }}>
        {submittedCount}/{alivePlayers.length} submitted
      </div>
    </div>
  );
}
