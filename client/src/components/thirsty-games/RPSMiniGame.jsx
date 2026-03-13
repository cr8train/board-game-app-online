import { useState } from 'react';

const CHOICES = [
  { key: 'rock', emoji: '🪨', label: 'Rock' },
  { key: 'paper', emoji: '📄', label: 'Paper' },
  { key: 'scissors', emoji: '✂️', label: 'Scissors' },
];

export default function RPSMiniGame({
  collision,
  mySocketId,
  isHost,
  rpsResult,
  players,
  onRpsChoice,
  onMiniGameChoice,
}) {
  const [chosen, setChosen] = useState(null);

  const collidingIds = collision?.players?.map(p => p.socketId) || [];
  const collidingNames = collision?.players?.map(p => p.name) || [];
  const amIColliding = collidingIds.includes(mySocketId);

  function handleChoice(choice) {
    if (chosen) return;
    setChosen(choice);
    onRpsChoice(choice);
  }

  return (
    <div>
      <h2 style={{ marginBottom: '0.5rem', color: 'var(--accent-gold)' }}>Rock Paper Scissors!</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Collision between:{' '}
        <strong style={{ color: 'var(--text-primary)' }}>
          {collidingNames.join(' vs ')}
        </strong>
      </p>

      {!rpsResult && (
        <>
          {amIColliding && !chosen && (
            <>
              <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Choose your move:</p>
              <div className="rps-choices">
                {CHOICES.map(c => (
                  <button key={c.key} className="rps-btn" onClick={() => handleChoice(c.key)}>
                    <span>{c.emoji}</span>
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {amIColliding && chosen && (
            <div style={{ margin: '1rem 0' }}>
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                {CHOICES.find(c => c.key === chosen)?.emoji}
              </p>
              <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
                Waiting for opponent...
              </p>
            </div>
          )}
          {!amIColliding && !isHost && (
            <p className="pulse" style={{ color: 'var(--text-secondary)', margin: '1.5rem 0' }}>
              Waiting for players to choose...
            </p>
          )}
          {isHost && !amIColliding && (
            <>
              <p className="pulse" style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
                Watching the duel...
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Or manually decide the outcome:
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                {collision.players.map(p => (
                  <button
                    key={p.socketId}
                    className="btn-danger btn-sm"
                    onClick={() => onMiniGameChoice(p.socketId)}
                  >
                    Eliminate {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {rpsResult && (
        <div className="rps-result">
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1rem' }}>
            {collidingIds.map(id => {
              const choice = rpsResult.choices[id];
              const choiceObj = CHOICES.find(c => c.key === choice);
              const pName = players?.[id]?.name || id;
              const isWinner = id === rpsResult.winnerId;
              return (
                <div key={id} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2rem' }}>{choiceObj?.emoji || '?'}</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '0.25rem' }}>
                    {pName}
                  </div>
                  {isWinner ? (
                    <span className="badge badge-winner" style={{ marginTop: '0.25rem' }}>Winner</span>
                  ) : (
                    <span className="badge badge-dead" style={{ marginTop: '0.25rem' }}>Eliminated</span>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {rpsResult.winnerId === mySocketId
              ? 'You won the duel!'
              : rpsResult.loserId === mySocketId
              ? 'You were eliminated.'
              : `${players?.[rpsResult.winnerId]?.name} wins!`}
          </p>
        </div>
      )}
    </div>
  );
}
