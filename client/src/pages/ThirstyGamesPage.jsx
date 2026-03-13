import { useState, useEffect } from 'react';
import socket from '../socket.js';
import ThirstyBoard from '../components/thirsty-games/ThirstyBoard.jsx';
import MoveSubmitter from '../components/thirsty-games/MoveSubmitter.jsx';
import RPSMiniGame from '../components/thirsty-games/RPSMiniGame.jsx';
import MiniGameRouter from '../components/thirsty-games/MiniGameRouter.jsx';
import PlayerStatus from '../components/thirsty-games/PlayerStatus.jsx';

export default function ThirstyGamesPage({ initialState, roomInfo, onLeave }) {
  const [gs, setGs] = useState(initialState);
  const [turnInfo, setTurnInfo] = useState({
    turnNumber: initialState.turnNumber,
    movesAllowed: initialState.movesThisTurn,
    stormLayer: initialState.stormLayer,
  });
  const [miniGame, setMiniGame] = useState(null); // { collision, miniGameType, miniGameState }
  const [rpsResult, setRpsResult] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [gameOver, setGameOver] = useState(null); // { winner }
  const [submittedIds, setSubmittedIds] = useState(new Set());
  const [revivalRequests, setRevivalRequests] = useState([]);
  const [stormSick, setStormSick] = useState(null); // { affected: [...] } — host only
  const [triviaOver, setTriviaOver] = useState(null); // { scores, winnerId, loserId }

  const mySocketId = socket.id;
  const isHost = roomInfo.isHost;
  const myPlayer = gs?.players?.[mySocketId];
  const isAlive = myPlayer?.isAlive ?? false;

  function addNotification(msg) {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, msg }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  }

  useEffect(() => {
    function onTurnStart({ turnNumber, movesAllowed, stormLayer, newState }) {
      setGs(newState);
      setTurnInfo({ turnNumber, movesAllowed, stormLayer });
      setSubmittedIds(new Set());
      setMiniGame(null);
      setRpsResult(null);
      setStormSick(null);
      setTriviaOver(null);
    }

    function onTurnResolved({ newState, stormSick: sick, collisions }) {
      setGs(newState);
      if (sick && sick.length > 0) {
        sick.forEach(n => addNotification(`${n.name} is sick from the storm!`));
        if (!isHost) {
          setStormSick({ affected: sick });
        }
      }
    }

    function onPlayerSubmitted({ socketId }) {
      setSubmittedIds(prev => new Set([...prev, socketId]));
    }

    function onMiniGameStart({ collision, miniGameType, miniGameState: mgs }) {
      setMiniGame({ collision, miniGameType, miniGameState: mgs });
      setRpsResult(null);
      setTriviaOver(null);
    }

    function onRpsResult({ choices, winnerId, loserId, playerNames }) {
      setRpsResult({ choices, winnerId, loserId, playerNames });
    }

    function onPlayerEliminated({ playerId, name }) {
      addNotification(`${name} has been eliminated!`);
      setGs(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [playerId]: { ...prev.players[playerId], isAlive: false },
          },
        };
      });
    }

    function onGameOver({ winner }) {
      setGameOver({ winner });
      setGs(prev => prev ? { ...prev, phase: 'ended', winner: winner?.socketId } : prev);
    }

    function onStormSick({ affected }) {
      setStormSick({ affected });
    }

    function onRevivalPrompt({ requests }) {
      setRevivalRequests(requests);
    }

    function onRevivalResult({ playerId, approved }) {
      if (approved) {
        addNotification(`${gs?.players?.[playerId]?.name || 'A player'} has been revived!`);
      }
      setGs(prev => {
        if (!prev || !approved) return prev;
        return {
          ...prev,
          players: {
            ...prev.players,
            [playerId]: { ...prev.players[playerId], isAlive: true, position: { type: 'center' } },
          },
        };
      });
    }

    // ── Death ──
    function onDeathRevealed(data) {
      setMiniGame(prev => prev ? { ...prev, miniGameState: { ...prev.miniGameState, ...data, revealed: true } } : prev);
    }

    // ── Maze mini ──
    function onMazeMiniUpdate({ positions, maze }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        return { ...prev, miniGameState: { ...prev.miniGameState, positions, maze } };
      });
    }

    function onMazeMiniOver({ winnerId, loserId }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        return { ...prev, miniGameState: { ...prev.miniGameState, winner: winnerId, loserId } };
      });
    }

    // ── Trivia ──
    function onTriviaQuestionResult({ questionIndex, answers, correct }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        const mgs = { ...prev.miniGameState };
        mgs.phase = 'reveal';
        mgs.lastResult = { questionIndex, answers, correct };
        return { ...prev, miniGameState: mgs };
      });
    }

    function onTriviaNextQuestion({ questionIndex, questionStartTime }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          miniGameState: {
            ...prev.miniGameState,
            currentQ: questionIndex,
            phase: 'question',
            questionStartTime,
          },
        };
      });
    }

    function onTriviaOver({ scores, winnerId, loserId }) {
      setTriviaOver({ scores, winnerId, loserId });
      setMiniGame(prev => {
        if (!prev) return prev;
        return { ...prev, miniGameState: { ...prev.miniGameState, phase: 'done', scores, winnerId, loserId } };
      });
    }

    // ── Know-X ──
    function onKnowXReveal({ subject, prompt, answers }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          miniGameState: {
            ...prev.miniGameState,
            phase: 'competitors-guessing',
            subjectAnswers: answers,
          },
        };
      });
    }

    function onKnowXOver({ scores, subjectAnswers, guesses, winnerId, loserId }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          miniGameState: {
            ...prev.miniGameState,
            phase: 'done',
            scores,
            subjectAnswers,
            guesses,
            winnerId,
            loserId,
          },
        };
      });
    }

    // ── Truths & Lies ──
    function onTruthsLieVoting({ competitorSocketId, competitorName, statements }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        const phaseIdx = prev.miniGameState?.competitors?.findIndex(c => c.socketId === competitorSocketId);
        const phase = phaseIdx === 0 ? 'voting-0' : 'voting-1';
        return {
          ...prev,
          miniGameState: {
            ...prev.miniGameState,
            phase,
            currentVotingCompetitorId: competitorSocketId,
            currentVotingName: competitorName,
            currentVotingStatements: statements,
          },
        };
      });
    }

    function onTruthsLieOver({ results, winnerId, loserId }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          miniGameState: {
            ...prev.miniGameState,
            phase: 'done',
            results,
            winnerId,
            loserId,
          },
        };
      });
    }

    function onJuiciestVoteRequest({ competitors }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          miniGameState: {
            ...prev.miniGameState,
            phase: 'juiciest-vote',
          },
        };
      });
    }

    // ── Memory ──
    function onMemoryHide() {
      setMiniGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          miniGameState: {
            ...prev.miniGameState,
            showingGrid: false,
            phase: 'recall',
          },
        };
      });
    }

    function onMemoryOver({ scores, grid, winnerId, loserId }) {
      setMiniGame(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          miniGameState: {
            ...prev.miniGameState,
            phase: 'done',
            scores,
            grid,
            winnerId,
            loserId,
          },
        };
      });
    }

    socket.on('tg:turnStart', onTurnStart);
    socket.on('tg:turnResolved', onTurnResolved);
    socket.on('tg:playerSubmitted', onPlayerSubmitted);
    socket.on('tg:miniGameStart', onMiniGameStart);
    socket.on('tg:rpsResult', onRpsResult);
    socket.on('tg:playerEliminated', onPlayerEliminated);
    socket.on('tg:gameOver', onGameOver);
    socket.on('tg:stormSick', onStormSick);
    socket.on('tg:revivalPrompt', onRevivalPrompt);
    socket.on('tg:revivalResult', onRevivalResult);
    socket.on('tg:deathRevealed', onDeathRevealed);
    socket.on('tg:mazeMiniUpdate', onMazeMiniUpdate);
    socket.on('tg:mazeMiniOver', onMazeMiniOver);
    socket.on('tg:triviaQuestionResult', onTriviaQuestionResult);
    socket.on('tg:triviaNextQuestion', onTriviaNextQuestion);
    socket.on('tg:triviaOver', onTriviaOver);
    socket.on('tg:knowXReveal', onKnowXReveal);
    socket.on('tg:knowXOver', onKnowXOver);
    socket.on('tg:truthsLieVoting', onTruthsLieVoting);
    socket.on('tg:truthsLieOver', onTruthsLieOver);
    socket.on('tg:juiciestVoteRequest', onJuiciestVoteRequest);
    socket.on('tg:memoryHide', onMemoryHide);
    socket.on('tg:memoryOver', onMemoryOver);

    return () => {
      socket.off('tg:turnStart', onTurnStart);
      socket.off('tg:turnResolved', onTurnResolved);
      socket.off('tg:playerSubmitted', onPlayerSubmitted);
      socket.off('tg:miniGameStart', onMiniGameStart);
      socket.off('tg:rpsResult', onRpsResult);
      socket.off('tg:playerEliminated', onPlayerEliminated);
      socket.off('tg:gameOver', onGameOver);
      socket.off('tg:stormSick', onStormSick);
      socket.off('tg:revivalPrompt', onRevivalPrompt);
      socket.off('tg:revivalResult', onRevivalResult);
      socket.off('tg:deathRevealed', onDeathRevealed);
      socket.off('tg:mazeMiniUpdate', onMazeMiniUpdate);
      socket.off('tg:mazeMiniOver', onMazeMiniOver);
      socket.off('tg:triviaQuestionResult', onTriviaQuestionResult);
      socket.off('tg:triviaNextQuestion', onTriviaNextQuestion);
      socket.off('tg:triviaOver', onTriviaOver);
      socket.off('tg:knowXReveal', onKnowXReveal);
      socket.off('tg:knowXOver', onKnowXOver);
      socket.off('tg:truthsLieVoting', onTruthsLieVoting);
      socket.off('tg:truthsLieOver', onTruthsLieOver);
      socket.off('tg:juiciestVoteRequest', onJuiciestVoteRequest);
      socket.off('tg:memoryHide', onMemoryHide);
      socket.off('tg:memoryOver', onMemoryOver);
    };
  }, [gs]);

  function handleSubmitMoves(moves, preferredWedge) {
    socket.emit('tg:submitMoves', { moves, preferredWedge });
  }

  function handleRpsChoice(choice) {
    socket.emit('tg:rpsChoice', { choice });
  }

  function handleMiniGameChoice(loserId) {
    socket.emit('tg:miniGameChoice', { loserId });
  }

  function handleRevivalDecision(targetPlayerId, approved) {
    socket.emit('tg:revivalDecision', { targetPlayerId, approved });
    setRevivalRequests(prev => prev.filter(r => r.socketId !== targetPlayerId));
  }

  function handleRevivalRequest() {
    socket.emit('tg:revivalRequest');
  }

  function handleAcknowledgeStorm() {
    socket.emit('tg:acknowledgeStorm');
    setStormSick(null);
  }

  const phase = gs?.phase;
  const stormLayer = turnInfo.stormLayer;

  const playerList = gs ? Object.values(gs.players) : [];
  const alivePlayers = playerList.filter(p => p.isAlive);

  return (
    <div className="game-layout">
      {/* Game over overlay */}
      {gameOver && (
        <div className="overlay">
          <div className="overlay-box">
            <h2 className="glow-gold" style={{ marginBottom: '0.75rem' }}>Game Over!</h2>
            {gameOver.winner ? (
              <>
                <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                  Winner: <strong style={{ color: 'var(--accent-gold)' }}>{gameOver.winner.name}</strong>
                </p>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {gameOver.winner.socketId === mySocketId ? 'You won! Congratulations!' : 'Better luck next time.'}
                </p>
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>No survivors. Everyone was eliminated.</p>
            )}
            <button className="btn-primary btn-lg" style={{ marginTop: '1.5rem' }} onClick={onLeave}>
              Back to Home
            </button>
          </div>
        </div>
      )}

      {/* Storm sick overlay — host only, must acknowledge to continue */}
      {stormSick && !gameOver && (
        <div className="overlay">
          <div className="overlay-box">
            <h3 style={{ color: '#e63946', marginBottom: '0.75rem' }}>Storm Warning!</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              The following players are sick from the storm:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {stormSick.affected.map(a => (
                <div
                  key={a.socketId}
                  style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.5rem 0.9rem',
                    borderLeft: '3px solid #e63946',
                    fontSize: '0.9rem',
                  }}
                >
                  <strong>{a.name}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                    (Wedge {a.position.wedge}, Layer {a.position.layer})
                  </span>
                </div>
              ))}
            </div>
            {isHost && (
              <button className="btn-primary btn-lg" onClick={handleAcknowledgeStorm}>
                Acknowledge &amp; Continue
              </button>
            )}
            {!isHost && (
              <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
                Waiting for host to acknowledge...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mini game overlay */}
      {miniGame && !gameOver && (
        <div className="overlay">
          <div
            className="overlay-box"
            style={{ maxWidth: miniGame.miniGameType === 'maze' ? 800 : 520, maxHeight: '85vh', overflowY: 'auto' }}
          >
            {miniGame.miniGameType === 'rps' ? (
              <RPSMiniGame
                collision={miniGame.collision}
                mySocketId={mySocketId}
                isHost={isHost}
                rpsResult={rpsResult}
                players={gs?.players}
                onRpsChoice={handleRpsChoice}
                onMiniGameChoice={handleMiniGameChoice}
              />
            ) : (
              <MiniGameRouter
                miniGameType={miniGame.miniGameType}
                miniGameState={miniGame.miniGameState}
                collision={miniGame.collision}
                mySocketId={mySocketId}
                isHost={isHost}
                allPlayers={gs?.players}
                onClose={() => setMiniGame(null)}
              />
            )}
          </div>
        </div>
      )}

      {/* Trivia over results overlay */}
      {triviaOver && !gameOver && (
        <div className="overlay">
          <div className="overlay-box">
            <h2 style={{ color: 'var(--accent-teal)', marginBottom: '0.75rem' }}>🧠 Trivia Results</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {Object.entries(triviaOver.scores).map(([id, s]) => {
                const pName = gs?.players?.[id]?.name || id;
                const isWinner = id === triviaOver.winnerId;
                return (
                  <div
                    key={id}
                    style={{
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.5rem 1rem',
                      borderLeft: `3px solid ${isWinner ? '#00d4aa' : '#e63946'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <strong>{pName}{id === mySocketId ? ' (you)' : ''}</strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {s.correct}/5 correct &bull; {(s.totalTime / 1000).toFixed(1)}s
                    </span>
                  </div>
                );
              })}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {triviaOver.winnerId === mySocketId
                ? 'You won the trivia duel!'
                : `${gs?.players?.[triviaOver.winnerId]?.name} wins!`}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="game-header">
        <h3 style={{ color: 'var(--accent-gold)', flex: 1 }}>The Thirsty Games</h3>
        <div className="tg-phase-banner">
          Turn {turnInfo.turnNumber} &bull; {phase === 'submit' ? 'Submit Moves' : phase === 'minigame' ? 'Mini-Game' : phase === 'resolve' ? 'Resolving' : phase}
        </div>
        {stormLayer && (
          <div className="tg-storm-warning">
            Storm: Layer {stormLayer}+
          </div>
        )}
        <button className="btn-secondary btn-sm" onClick={onLeave}>Leave</button>
      </div>

      <div className="game-body">
        {/* Sidebar */}
        <div className="game-sidebar">
          <div>
            <p className="section-label">Players</p>
            <PlayerStatus
              players={playerList}
              mySocketId={mySocketId}
              submittedIds={submittedIds}
              phase={phase}
            />
          </div>

          {/* Revival controls */}
          {!isAlive && !gameOver && alivePlayers.length >= 3 && (
            <div>
              <button className="btn-teal btn-sm" style={{ width: '100%' }} onClick={handleRevivalRequest}>
                Request Revival
              </button>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Host must approve
              </p>
            </div>
          )}

          {/* Revival requests (host only) */}
          {isHost && revivalRequests.length > 0 && (
            <div>
              <p className="section-label">Revival Requests</p>
              {revivalRequests.map(r => (
                <div key={r.socketId} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ flex: 1, fontSize: '0.85rem' }}>{r.name}</span>
                  <button className="btn-teal btn-sm" onClick={() => handleRevivalDecision(r.socketId, true)}>Yes</button>
                  <button className="btn-danger btn-sm" onClick={() => handleRevivalDecision(r.socketId, false)}>No</button>
                </div>
              ))}
            </div>
          )}

          {/* Notifications */}
          {notifications.length > 0 && (
            <div>
              <p className="section-label">Events</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {notifications.map(n => (
                  <div
                    key={n.id}
                    style={{
                      background: 'var(--bg-elevated)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      borderLeft: '3px solid var(--accent-red)',
                    }}
                  >
                    {n.msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Move submitter */}
          {isAlive && phase === 'submit' && !gameOver && (
            <MoveSubmitter
              movesAllowed={turnInfo.movesAllowed}
              onSubmit={handleSubmitMoves}
              hasSubmitted={submittedIds.has(mySocketId)}
              players={playerList}
              submittedIds={submittedIds}
              myPlayer={myPlayer}
            />
          )}

          {phase === 'submit' && !isAlive && !gameOver && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0.5rem' }}>
              You have been eliminated. Spectating...
            </div>
          )}
        </div>

        {/* Board */}
        <div className="game-main">
          <div className="tg-board-container">
            {gs && (
              <ThirstyBoard
                players={gs.players}
                stormLayer={stormLayer}
                mySocketId={mySocketId}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
