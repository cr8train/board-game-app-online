import socket from '../../socket.js';
import DeathGame from './minigames/DeathGame.jsx';
import MazeMiniGame from './minigames/MazeMiniGame.jsx';
import TriviaGame from './minigames/TriviaGame.jsx';
import KnowXGame from './minigames/KnowXGame.jsx';
import TruthsLiesGame from './minigames/TruthsLiesGame.jsx';
import MemoryGame from './minigames/MemoryGame.jsx';

export default function MiniGameRouter({
  miniGameType,
  miniGameState,
  collision,
  mySocketId,
  isHost,
  allPlayers,
  onClose,
}) {
  const props = { miniGameState, collision, mySocketId, isHost, allPlayers };

  switch (miniGameType) {
    case 'death':
      return <DeathGame {...props} />;
    case 'maze':
      return <MazeMiniGame {...props} />;
    case 'trivia':
      return <TriviaGame {...props} />;
    case 'know-x':
      return <KnowXGame {...props} />;
    case 'truths-lies':
      return <TruthsLiesGame {...props} />;
    case 'memory':
      return <MemoryGame {...props} />;
    default:
      return (
        <div>
          <h3>Mini-Game</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '1rem 0' }}>
            Type: {miniGameType}
          </p>
          {isHost && (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              {collision?.players?.map(p => (
                <button
                  key={p.socketId}
                  className="btn-danger"
                  onClick={() => socket.emit('tg:miniGameChoice', { loserId: p.socketId })}
                >
                  Eliminate {p.name}
                </button>
              ))}
            </div>
          )}
          {!isHost && (
            <p className="pulse" style={{ color: 'var(--text-secondary)' }}>
              Waiting for host to decide...
            </p>
          )}
        </div>
      );
  }
}
