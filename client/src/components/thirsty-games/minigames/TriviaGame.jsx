import { useState, useEffect, useRef } from 'react';
import socket from '../../../socket.js';

const ANSWER_LABELS = ['A', 'B', 'C', 'D'];

export default function TriviaGame({ miniGameState, mySocketId }) {
  const [answered, setAnswered] = useState(false);
  const [chosenAnswer, setChosenAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(12);
  const [lastResult, setLastResult] = useState(null);   // { correct, answers }
  const [overData, setOverData] = useState(null);       // tg:triviaOver payload (handled by parent update)
  const timerRef = useRef(null);
  const questionStartRef = useRef(null);

  if (!miniGameState) return null;

  const { competitors, questions, currentQ, phase, questionStartTime } = miniGameState;
  const isCompetitor = competitors.some(c => c.socketId === mySocketId);
  const question = questions?.[currentQ];

  // Reset answered state when question changes
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    setAnswered(false);
    setChosenAnswer(null);
    setLastResult(null);
    questionStartRef.current = questionStartTime ? questionStartTime : Date.now();

    // Countdown timer
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(12);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentQ, questionStartTime]);

  function handleAnswer(index) {
    if (!isCompetitor || answered) return;
    const timeMs = Date.now() - (questionStartRef.current || Date.now());
    setChosenAnswer(index);
    setAnswered(true);
    socket.emit('tg:triviaAnswer', { answer: index, timeMs });
  }

  if (phase === 'done' || overData) {
    const { scores, winnerId } = miniGameState;
    return (
      <div>
        <h2 style={{ color: 'var(--accent-teal)', marginBottom: '0.75rem' }}>🧠 Trivia — Results!</h2>
        {scores ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {competitors.map(c => {
                const s = scores[c.socketId];
                const isWinner = c.socketId === winnerId;
                return (
                  <div key={c.socketId} style={{
                    background: isWinner ? 'rgba(0,212,170,0.1)' : 'var(--bg-elevated)',
                    border: `2px solid ${isWinner ? 'var(--accent-teal)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.6rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <strong>{c.name}{isWinner ? ' 🏆' : ''}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {s?.correct ?? 0}/{questions.length} correct &bull; {((s?.totalTime ?? 0) / 1000).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="pulse" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Continuing game...</p>
          </>
        ) : (
          <p className="pulse" style={{ color: 'var(--text-secondary)' }}>Calculating results...</p>
        )}
      </div>
    );
  }

  if (!question) return (
    <div>
      <h2 style={{ color: 'var(--accent-teal)', marginBottom: '0.75rem' }}>🧠 Trivia</h2>
      <p className="pulse" style={{ color: 'var(--text-secondary)' }}>Loading question...</p>
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
        <h2 style={{ color: 'var(--accent-teal)', margin: 0 }}>🧠 Trivia</h2>
        <div style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          color: timeLeft <= 3 ? '#e63946' : 'var(--accent-gold)',
          minWidth: 32,
          textAlign: 'right',
        }}>
          {timeLeft}s
        </div>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1rem' }}>
        Question {currentQ + 1} of {questions.length} &bull;{' '}
        {competitors.map(c => c.name).join(' vs ')}
      </p>

      <div style={{
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        fontSize: '1.05rem',
        lineHeight: 1.5,
        color: 'var(--text-primary)',
        borderLeft: '3px solid var(--accent-teal)',
      }}>
        {question.q}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
        {question.choices.map((choice, i) => {
          let borderColor = 'var(--border-color)';
          let bg = 'var(--bg-elevated)';
          if (answered) {
            if (i === question.answer) { borderColor = '#00d4aa'; bg = 'rgba(0,212,170,0.12)'; }
            else if (i === chosenAnswer) { borderColor = '#e63946'; bg = 'rgba(230,57,70,0.12)'; }
          }
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={!isCompetitor || answered}
              style={{
                background: bg,
                border: `2px solid ${borderColor}`,
                borderRadius: 'var(--radius-sm)',
                padding: '0.6rem 0.75rem',
                color: 'var(--text-primary)',
                cursor: !isCompetitor || answered ? 'default' : 'pointer',
                textAlign: 'left',
                fontSize: '0.9rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                transition: 'border-color 0.2s, background 0.2s',
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--accent-gold)', minWidth: 18 }}>
                {ANSWER_LABELS[i]}.
              </span>
              {choice}
            </button>
          );
        })}
      </div>

      {!isCompetitor && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
          Spectating — competitors are answering...
        </p>
      )}
      {isCompetitor && answered && (
        <p className="pulse" style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem' }}>
          Answer locked in — waiting for opponent...
        </p>
      )}
    </div>
  );
}
