// Renders the 15x15 maze grid with CSS borders as walls
// Players are rendered as colored dots using an absolute-positioned overlay

const CELL_SIZE = 34; // px

export default function MazeBoard({ maze, players = {}, colorMap = {}, mySocketId }) {
  if (!maze || maze.length === 0) return null;

  const HEIGHT = maze.length;
  const WIDTH = maze[0].length;
  const TOTAL_W = WIDTH * CELL_SIZE;
  const TOTAL_H = HEIGHT * CELL_SIZE;

  const playerList = Object.values(players);

  return (
    <div className="maze-wrapper" style={{ width: TOTAL_W, height: TOTAL_H }}>
      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${WIDTH}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${HEIGHT}, ${CELL_SIZE}px)`,
          width: TOTAL_W,
          height: TOTAL_H,
          position: 'relative',
          background: 'var(--bg-primary)',
          border: '2px solid var(--border-bright)',
          boxSizing: 'content-box',
        }}
      >
        {maze.map((row, y) =>
          row.map((cell, x) => {
            const isExit = x === 14 && y === 14;
            const isStart = x === 0 && y === 0;
            const walls = cell.walls;

            const borderStyle = {
              borderTop: walls.N ? '2px solid var(--border-bright)' : '2px solid transparent',
              borderBottom: walls.S ? '2px solid var(--border-bright)' : '2px solid transparent',
              borderLeft: walls.W ? '2px solid var(--border-bright)' : '2px solid transparent',
              borderRight: walls.E ? '2px solid var(--border-bright)' : '2px solid transparent',
            };

            return (
              <div
                key={`${x}-${y}`}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  boxSizing: 'border-box',
                  background: isExit
                    ? 'rgba(0,212,170,0.15)'
                    : isStart
                    ? 'rgba(240,165,0,0.08)'
                    : 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: CELL_SIZE <= 24 ? '0.6rem' : '0.75rem',
                  ...borderStyle,
                }}
              >
                {isExit && (
                  <span style={{ opacity: 0.9, fontSize: CELL_SIZE <= 24 ? '0.7rem' : '1rem' }}>
                    🏁
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Players overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: TOTAL_W,
          height: TOTAL_H,
          pointerEvents: 'none',
        }}
      >
        {playerList.map(player => {
          const color = colorMap[player.socketId] || '#888';
          const isMe = player.socketId === mySocketId;
          const dotSize = isMe ? 20 : 16;
          const left = player.x * CELL_SIZE + CELL_SIZE / 2;
          const top = player.y * CELL_SIZE + CELL_SIZE / 2;

          return (
            <div
              key={player.socketId}
              style={{
                position: 'absolute',
                left,
                top,
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                background: color,
                border: isMe ? '2px solid white' : '1.5px solid rgba(255,255,255,0.4)',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.5rem',
                fontWeight: 800,
                color: '#0f0f1a',
                boxShadow: isMe ? `0 0 8px ${color}` : '0 1px 4px rgba(0,0,0,0.6)',
                transition: 'left 0.1s ease, top 0.1s ease',
                zIndex: isMe ? 10 : 5,
                opacity: player.finished ? 0.4 : 1,
              }}
            >
              {player.name.slice(0, 1).toUpperCase()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
