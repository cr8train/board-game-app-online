import ThirstyGamesPage from './ThirstyGamesPage.jsx';
import MazeRunnerPage from './MazeRunnerPage.jsx';

export default function GamePage({ gameInfo, roomInfo, onLeave }) {
  if (!gameInfo) return null;

  if (gameInfo.gameType === 'thirsty-games') {
    return (
      <ThirstyGamesPage
        initialState={gameInfo.initialState}
        roomInfo={roomInfo}
        onLeave={onLeave}
      />
    );
  }

  if (gameInfo.gameType === 'maze-runner') {
    return (
      <MazeRunnerPage
        initialState={gameInfo.initialState}
        roomInfo={roomInfo}
        onLeave={onLeave}
      />
    );
  }

  return (
    <div className="page-container">
      <p>Unknown game type: {gameInfo.gameType}</p>
    </div>
  );
}
