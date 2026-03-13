import { useState } from 'react';
import HomePage from './pages/HomePage.jsx';
import LobbyPage from './pages/LobbyPage.jsx';
import GamePage from './pages/GamePage.jsx';

export default function App() {
  // page: 'home' | 'lobby' | 'game'
  const [page, setPage] = useState('home');
  const [roomInfo, setRoomInfo] = useState(null); // { roomCode, playerName, socketId, isHost, players }
  const [gameInfo, setGameInfo] = useState(null); // { gameType, initialState }

  function goToLobby(info) {
    setRoomInfo(info);
    setPage('lobby');
  }

  function goToGame(info) {
    setGameInfo(info);
    setPage('game');
  }

  function goHome() {
    setRoomInfo(null);
    setGameInfo(null);
    setPage('home');
  }

  if (page === 'home') {
    return <HomePage onEnterLobby={goToLobby} />;
  }

  if (page === 'lobby') {
    return (
      <LobbyPage
        roomInfo={roomInfo}
        onGameStarted={goToGame}
        onLeave={goHome}
      />
    );
  }

  if (page === 'game') {
    return (
      <GamePage
        gameInfo={gameInfo}
        roomInfo={roomInfo}
        onLeave={goHome}
      />
    );
  }

  return null;
}
