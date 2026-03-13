const AVATAR_COLORS = ['#f0a500', '#00d4aa', '#7b2ff7', '#e63946', '#4cc9f0', '#ff6b35'];

export default function PlayerList({ players = [], mySocketId, hostSocketId }) {
  return (
    <div className="player-list">
      {players.map((player, i) => {
        const isMe = player.socketId === mySocketId;
        const isHost = player.socketId === hostSocketId || player.isHost;
        const color = AVATAR_COLORS[i % AVATAR_COLORS.length];

        return (
          <div key={player.socketId} className="player-list-item">
            <div className="player-avatar" style={{ background: color, color: '#0f0f1a' }}>
              {player.name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div className="player-name">
                {player.name}
                {isMe && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.4rem' }}>
                    (you)
                  </span>
                )}
              </div>
            </div>
            {isHost && <span className="badge badge-host">Host</span>}
          </div>
        );
      })}
    </div>
  );
}
