const AVATAR_COLORS = ['#f0a500', '#00d4aa', '#7b2ff7', '#e63946', '#4cc9f0', '#ff6b35'];

const WEDGE_COLORS = {
  A: '#f0a500',
  B: '#00d4aa',
  C: '#7b2ff7',
  D: '#e63946',
  E: '#4cc9f0',
  F: '#ff6b35',
};

function positionLabel(pos) {
  if (!pos) return '?';
  if (pos.type === 'center') return 'Center';
  return `${pos.wedge}${pos.layer}`;
}

export default function PlayerStatus({ players = [], mySocketId, submittedIds, phase }) {
  const sorted = [...players].sort((a, b) => {
    if (a.isAlive && !b.isAlive) return -1;
    if (!a.isAlive && b.isAlive) return 1;
    return (a.district || 0) - (b.district || 0);
  });

  return (
    <div className="player-list">
      {sorted.map((player, i) => {
        const isMe = player.socketId === mySocketId;
        const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
        const submitted = submittedIds?.has(player.socketId);

        return (
          <div
            key={player.socketId}
            className="player-list-item"
            style={!player.isAlive ? { opacity: 0.5 } : {}}
          >
            <div className="player-avatar" style={{ background: color, color: '#0f0f1a' }}>
              {player.district || player.name.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="player-name" style={{ fontSize: '0.85rem' }}>
                {player.name}
                {isMe && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
                    (you)
                  </span>
                )}
              </div>
              <div className="player-info">
                {positionLabel(player.position)}
                {player.isAlive && phase === 'submit' && (
                  <span
                    style={{
                      marginLeft: '0.4rem',
                      color: submitted ? 'var(--accent-teal)' : 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {submitted ? '✓' : '...'}
                  </span>
                )}
              </div>
            </div>
            <span className={`badge ${player.isAlive ? 'badge-alive' : 'badge-dead'}`}>
              {player.isAlive ? 'Alive' : 'Out'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
