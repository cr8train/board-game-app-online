import { useState, useRef } from 'react';
import socket from '../../../socket.js';

export default function KnowXGame({ miniGameState, mySocketId }) {
  const [subjectInputs, setSubjectInputs] = useState(['', '', '', '', '']);
  const [subjectSubmitted, setSubjectSubmitted] = useState(false);
  const [guessInputs, setGuessInputs] = useState(['', '', '', '', '']);
  const [guessSubmitted, setGuessSubmitted] = useState(false);
  const guessStartRef = useRef(null);

  if (!miniGameState) return null;

  const { competitors, subject, prompt, phase, subjectAnswers, guesses } = miniGameState;
  const isCompetitor = competitors.some(c => c.socketId === mySocketId);
  const isSubject = subject?.socketId === mySocketId;

  function handleSubjectSubmit() {
    if (subjectSubmitted) return;
    const trimmed = subjectInputs.map(s => s.trim());
    socket.emit('tg:knowXSubjectAnswers', { answers: trimmed });
    setSubjectSubmitted(true);
  }

  function handleGuessSubmit() {
    if (guessSubmitted) return;
    const timeMs = guessStartRef.current ? Date.now() - guessStartRef.current : 0;
    const trimmed = guessInputs.map(s => s.trim());
    socket.emit('tg:knowXGuess', { guesses: trimmed, timeMs });
    setGuessSubmitted(true);
  }

  // Start guess timer when phase changes to competitors-guessing
  if (phase === 'competitors-guessing' && !guessStartRef.current) {
    guessStartRef.current = Date.now();
  }

  // Done phase
  if (phase === 'done') {
    return (
      <div>
        <h2 style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>
          🤔 How Well Do You Know {subject?.name}?
        </h2>
        <p className="pulse" style={{ color: 'var(--text-secondary)' }}>Calculating results...</p>
      </div>
    );
  }

  // Results shown via tg:knowXOver — the parent updates miniGameState
  // Subject answering phase
  if (phase === 'subject-answering') {
    if (isSubject) {
      return (
        <div>
          <h2 style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>
            🤔 How Well Do They Know You?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {prompt}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {subjectInputs.map((val, i) => (
              <input
                key={i}
                type="text"
                value={val}
                onChange={e => {
                  const next = [...subjectInputs];
                  next[i] = e.target.value;
                  setSubjectInputs(next);
                }}
                placeholder={`Answer ${i + 1}`}
                disabled={subjectSubmitted}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.95rem',
                }}
              />
            ))}
          </div>
          {!subjectSubmitted ? (
            <button className="btn-primary" onClick={handleSubjectSubmit}>
              Submit My Answers
            </button>
          ) : (
            <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
              Waiting for competitors to see your answers...
            </p>
          )}
        </div>
      );
    }
    return (
      <div>
        <h2 style={{ color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>🤔 How Well Do You Know...</h2>
        <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
          Waiting for {subject?.name} to answer...
        </p>
      </div>
    );
  }

  // Competitors guessing phase
  if (phase === 'competitors-guessing') {
    if (isCompetitor) {
      return (
        <div>
          <h2 style={{ color: 'var(--accent-gold)', marginBottom: '0.4rem' }}>
            🤔 How Well Do You Know {subject?.name}?
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {prompt} — guess their answers!
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {guessInputs.map((val, i) => (
              <input
                key={i}
                type="text"
                value={val}
                onChange={e => {
                  const next = [...guessInputs];
                  next[i] = e.target.value;
                  setGuessInputs(next);
                }}
                placeholder={`Guess ${i + 1}`}
                disabled={guessSubmitted}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.95rem',
                }}
              />
            ))}
          </div>
          {!guessSubmitted ? (
            <button className="btn-primary" onClick={handleGuessSubmit}>
              Submit Guesses
            </button>
          ) : (
            <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
              Waiting for opponent...
            </p>
          )}
        </div>
      );
    }

    // Spectator / subject — show the prompt and answers
    return (
      <div>
        <h2 style={{ color: 'var(--accent-gold)', marginBottom: '0.4rem' }}>
          🤔 How Well Do They Know {subject?.name}?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>
          {prompt}
        </p>
        {subjectAnswers && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.85rem' }}>
              {subject?.name}'s answers:
            </p>
            <ol style={{ paddingLeft: '1.25rem', color: 'var(--text-primary)', lineHeight: 1.8 }}>
              {subjectAnswers.map((a, i) => <li key={i}>{a || '—'}</li>)}
            </ol>
          </div>
        )}
        <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
          Competitors are guessing...
        </p>
      </div>
    );
  }

  return null;
}
