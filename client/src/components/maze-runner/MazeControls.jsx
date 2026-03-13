export default function MazeControls({ onMove, myPlayer }) {
  return (
    <div className="maze-controls-panel">
      <p className="section-label" style={{ alignSelf: 'flex-start' }}>Controls</p>

      <div className="maze-dpad">
        <button className="dpad-btn dpad-up" onClick={() => onMove('UP')} title="Up (W / ↑)">
          ↑
        </button>
        <button className="dpad-btn dpad-left" onClick={() => onMove('LEFT')} title="Left (A / ←)">
          ←
        </button>
        <button className="dpad-btn dpad-right" onClick={() => onMove('RIGHT')} title="Right (D / →)">
          →
        </button>
        <button className="dpad-btn dpad-down" onClick={() => onMove('DOWN')} title="Down (S / ↓)">
          ↓
        </button>
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Arrow keys or WASD
      </p>

      {myPlayer && (
        <p className="maze-pos-display">
          Pos: ({myPlayer.x}, {myPlayer.y})
        </p>
      )}
    </div>
  );
}
