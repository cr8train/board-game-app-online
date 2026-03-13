import { useState } from 'react';
import socket from '../../../socket.js';

export default function TruthsLiesGame({ miniGameState, mySocketId, allPlayers }) {
  const [statements, setStatements] = useState(['', '', '']);
  const [lieIndex, setLieIndex] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [myVotes, setMyVotes] = useState({}); // competitorSocketId -> chosen index
  const [juiciestVoted, setJuiciestVoted] = useState(false);

  if (!miniGameState) return null;

  const { competitors, phase, votes } = miniGameState;
  const isCompetitor = competitors.some(c => c.socketId === mySocketId);

  function handleWritingSubmit() {
    if (submitted || lieIndex === null) return;
    socket.emit('tg:truthsLieSubmit', { statements, lieIndex });
    setSubmitted(true);
  }

  function handleVote(competitorSocketId, guessIndex) {
    if (myVotes[competitorSocketId] !== undefined) return;
    socket.emit('tg:truthsLieVote', { competitorSocketId, lieGuessIndex: guessIndex });
    setMyVotes(prev => ({ ...prev, [competitorSocketId]: guessIndex }));
  }

  function handleJuiciestVote(votedForId) {
    if (juiciestVoted) return;
    socket.emit('tg:juiciestVote', { votedForId });
    setJuiciestVoted(true);
  }

  // Writing phase
  if (phase === 'writing') {
    if (isCompetitor) {
      return (
        <div>
          <h2 style={{ color: '#ff6b35', marginBottom: '0.4rem' }}>🤥 2 Truths &amp; 1 Lie</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Write 3 statements about yourself — 2 true, 1 lie. Mark which is the lie.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {statements.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', minWidth: 80 }}>
                  <input
                    type="radio"
                    name="lie"
                    checked={lieIndex === i}
                    onChange={() => setLieIndex(i)}
                    disabled={submitted}
                  />
                  <span style={{ fontSize: '0.8rem', color: lieIndex === i ? '#e63946' : 'var(--text-muted)' }}>
                    {lieIndex === i ? '🤥 Lie' : `Statement ${i + 1}`}
                  </span>
                </label>
                <input
                  type="text"
                  value={s}
                  onChange={e => {
                    const next = [...statements];
                    next[i] = e.target.value;
                    setStatements(next);
                  }}
                  placeholder={`Statement ${i + 1}`}
                  disabled={submitted}
                  style={{
                    flex: 1,
                    background: 'var(--bg-elevated)',
                    border: `1px solid ${lieIndex === i ? '#e63946' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            ))}
          </div>
          {!submitted ? (
            <button
              className="btn-primary"
              onClick={handleWritingSubmit}
              disabled={lieIndex === null || statements.some(s => !s.trim())}
            >
              Submit Statements
            </button>
          ) : (
            <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
              Waiting for opponent to submit...
            </p>
          )}
        </div>
      );
    }
    return (
      <div>
        <h2 style={{ color: '#ff6b35', marginBottom: '0.5rem' }}>🤥 2 Truths &amp; 1 Lie</h2>
        <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
          Competitors are writing their statements...
        </p>
      </div>
    );
  }

  // Voting phases
  if (phase === 'voting-0' || phase === 'voting-1') {
    // miniGameState.currentVotingCompetitor is set by server via tg:truthsLieVoting event
    // The parent updates miniGameState; we read votingData from it
    const votingSocketId = miniGameState.currentVotingCompetitorId;
    const votingStatements = miniGameState.currentVotingStatements;
    const votingName = miniGameState.currentVotingName;

    if (!votingSocketId || !votingStatements) {
      return (
        <div>
          <h2 style={{ color: '#ff6b35', marginBottom: '0.5rem' }}>🤥 2 Truths &amp; 1 Lie — Voting</h2>
          <p className="pulse" style={{ color: 'var(--text-secondary)' }}>Loading voting round...</p>
        </div>
      );
    }

    const imVotingTarget = votingSocketId === mySocketId;
    const alreadyVoted = myVotes[votingSocketId] !== undefined;

    return (
      <div>
        <h2 style={{ color: '#ff6b35', marginBottom: '0.4rem' }}>🤥 2 Truths &amp; 1 Lie</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Which of <strong style={{ color: 'var(--text-primary)' }}>{votingName}</strong>'s statements is the lie?
        </p>

        {!imVotingTarget ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
            {votingStatements.map((stmt, i) => {
              const isChosen = myVotes[votingSocketId] === i;
              return (
                <button
                  key={i}
                  onClick={() => handleVote(votingSocketId, i)}
                  disabled={alreadyVoted}
                  style={{
                    background: isChosen ? 'rgba(230,57,70,0.15)' : 'var(--bg-elevated)',
                    border: `2px solid ${isChosen ? '#e63946' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.65rem 1rem',
                    color: 'var(--text-primary)',
                    cursor: alreadyVoted ? 'default' : 'pointer',
                    textAlign: 'left',
                    fontSize: '0.9rem',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 700, marginRight: '0.5rem' }}>
                    {i + 1}.
                  </span>
                  {stmt}
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {votingStatements.map((stmt, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 1rem',
                    fontSize: '0.9rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 700, marginRight: '0.5rem' }}>
                    {i + 1}.
                  </span>
                  {stmt}
                </div>
              ))}
            </div>
            <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
              Others are guessing your lie...
            </p>
          </>
        )}

        {!imVotingTarget && alreadyVoted && (
          <p className="pulse" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Vote submitted — waiting for everyone...
          </p>
        )}
      </div>
    );
  }

  // Juiciest vote tiebreaker
  if (phase === 'juiciest-vote') {
    return (
      <div>
        <h2 style={{ color: '#ff6b35', marginBottom: '0.5rem' }}>🤥 Tiebreaker!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          It's a tie! Vote for who had the juiciest truths.
        </p>
        {!isCompetitor && !juiciestVoted && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            {competitors.map(c => (
              <button
                key={c.socketId}
                className="btn-primary"
                onClick={() => handleJuiciestVote(c.socketId)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {(isCompetitor || juiciestVoted) && (
          <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
            Waiting for votes...
          </p>
        )}
      </div>
    );
  }

  if (phase === 'done') {
    const { results, winnerId } = miniGameState;
    return (
      <div>
        <h2 style={{ color: '#ff6b35', marginBottom: '0.75rem' }}>🤥 2 Truths &amp; 1 Lie — Reveal!</h2>
        {results ? (
          <>
            {competitors.map(c => {
              const r = results[c.socketId];
              const isWinner = c.socketId === winnerId;
              return (
                <div key={c.socketId} style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 700, marginBottom: '0.4rem', color: isWinner ? 'var(--accent-teal)' : 'var(--text-primary)' }}>
                    {c.name}{isWinner ? ' 🏆' : ''} — fooled {r?.fooledCount ?? 0} people
                  </p>
                  {r?.statements.map((s, i) => (
                    <div key={i} style={{
                      background: s.isLie ? 'rgba(230,57,70,0.12)' : 'rgba(0,212,170,0.08)',
                      border: `1px solid ${s.isLie ? '#e63946' : '#00d4aa'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.45rem 0.75rem',
                      marginBottom: '0.3rem',
                      fontSize: '0.88rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span>{i + 1}. {s.text}</span>
                      <span style={{ fontWeight: 700, color: s.isLie ? '#e63946' : '#00d4aa', marginLeft: '0.5rem', flexShrink: 0 }}>
                        {s.isLie ? '🤥 LIE' : '✓'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
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
