// Hexagonal board: center + 6 wedges * 6 layers
// Wedge A is straight vertical (centered at top, 12 o'clock)
// All cell edges are straight lines — no arcs

const WEDGES = ['A', 'B', 'C', 'D', 'E', 'F'];

const WEDGE_COLORS = [
  '#f0a50022', // A - gold
  '#00d4aa22', // B - teal
  '#7b2ff722', // C - purple
  '#e6394622', // D - red
  '#4cc9f022', // E - blue
  '#ff6b3522', // F - orange
];

const WEDGE_STROKE_COLORS = [
  '#f0a500',
  '#00d4aa',
  '#7b2ff7',
  '#e63946',
  '#4cc9f0',
  '#ff6b35',
];

const AVATAR_COLORS = ['#f0a500', '#00d4aa', '#7b2ff7', '#e63946', '#4cc9f0', '#ff6b35'];

const SIZE = 440;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CENTER_R = 32;
const MAX_R = 195;
const LAYER_STEP = (MAX_R - CENTER_R) / 6;

// Angle measured clockwise from north (up). Returns SVG x,y from center.
function hexPoint(angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + r * Math.sin(rad),
    y: CY - r * Math.cos(rad),
  };
}

// Wedge i is centered at angle i*60 degrees from north.
// Its boundaries are at (i*60 - 30) and (i*60 + 30).
function wedgeStartAngle(wi) {
  return wi * 60 - 30;
}

// Build a straight-edged quadrilateral path for one wedge segment
function buildCellPath(wi, layer) {
  const start = wedgeStartAngle(wi);
  const end = start + 60;
  const innerR = CENTER_R + (layer - 1) * LAYER_STEP;
  const outerR = CENTER_R + layer * LAYER_STEP;

  const p1 = hexPoint(start, innerR); // inner-start
  const p2 = hexPoint(start, outerR); // outer-start
  const p3 = hexPoint(end, outerR);   // outer-end
  const p4 = hexPoint(end, innerR);   // inner-end

  return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} L ${p4.x} ${p4.y} Z`;
}

// Hexagonal polygon path at a given radius (vertices at wedge boundary angles)
function hexPath(r) {
  // Wedge boundary angles: -30, 30, 90, 150, 210, 270
  const boundaryAngles = [-30, 30, 90, 150, 210, 270];
  return boundaryAngles
    .map((a, i) => {
      const pt = hexPoint(a, r);
      return `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`;
    })
    .join(' ') + ' Z';
}

// True trapezoid centroid for placing player avatars (weights toward wider outer side)
function getCellCenter(wi, layer) {
  const midAngle = wi * 60;
  const innerR = CENTER_R + (layer - 1) * LAYER_STEP;
  const outerR = CENTER_R + layer * LAYER_STEP;
  // Trapezoid centroid: weight toward wider (outer) side
  const centroidR = innerR + (outerR - innerR) * (innerR + 2 * outerR) / (3 * (innerR + outerR));
  return hexPoint(midAngle, centroidR);
}

export default function ThirstyBoard({ players = {}, stormLayer, mySocketId }) {
  const playerList = Object.values(players);

  const colorMap = {};
  playerList.forEach(p => {
    const idx = (p.district - 1) % AVATAR_COLORS.length;
    colorMap[p.socketId] = AVATAR_COLORS[idx];
  });

  // Group alive players by position
  const positionGroups = {};
  for (const p of playerList) {
    if (!p.isAlive) continue;
    const pos = p.position;
    const key = pos.type === 'center' ? 'center' : `${pos.wedge}${pos.layer}`;
    if (!positionGroups[key]) positionGroups[key] = [];
    positionGroups[key].push(p);
  }

  function renderPlayersAt(cx, cy, group) {
    const offset = 11;
    const count = group.length;
    return group.map((p, i) => {
      const dx = count > 1 ? (i - (count - 1) / 2) * offset : 0;
      const isMe = p.socketId === mySocketId;
      return (
        <g key={p.socketId}>
          <circle
            cx={cx + dx}
            cy={cy}
            r={isMe ? 9 : 7}
            fill={colorMap[p.socketId]}
            stroke={isMe ? 'white' : 'rgba(255,255,255,0.4)'}
            strokeWidth={isMe ? 2 : 1}
          />
          <text
            x={cx + dx}
            y={cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7"
            fontWeight="800"
            fill="#0f0f1a"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {p.district || p.name.slice(0, 1).toUpperCase()}
          </text>
        </g>
      );
    });
  }

  return (
    <div className="tg-board-container">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ maxWidth: '100%', height: 'auto' }}
        aria-label="Thirsty Games Board"
      >
        <rect width={SIZE} height={SIZE} fill="#0f0f1a" rx="8" />

        {/* Wedge segments: 6 wedges × 6 layers, straight-edged hexagonal cells */}
        {WEDGES.map((wedge, wi) => {
          const strokeColor = WEDGE_STROKE_COLORS[wi];
          const fillColor = WEDGE_COLORS[wi];

          return Array.from({ length: 6 }, (_, layerIdx) => {
            const layer = layerIdx + 1;
            // Storm: outer layers >= stormLayer are in the storm
            const isStorm = stormLayer !== null && layer >= stormLayer;
            const path = buildCellPath(wi, layer);

            return (
              <path
                key={`${wedge}-${layer}`}
                d={path}
                fill={isStorm ? 'rgba(230,57,70,0.45)' : fillColor}
                stroke={strokeColor}
                strokeWidth={0.8}
                opacity={0.9}
              />
            );
          });
        })}

        {/* Storm boundary: hexagonal outline at inner edge of storm zone */}
        {stormLayer !== null && (
          <>
            <path
              d={hexPath(CENTER_R + (stormLayer - 1) * LAYER_STEP)}
              fill="none"
              stroke="#e63946"
              strokeWidth={2.5}
              strokeDasharray="6 3"
              opacity={0.9}
            />
          </>
        )}

        {/* Radial divider lines between wedges */}
        {WEDGES.map((_, wi) => {
          const angle = wedgeStartAngle(wi);
          const inner = hexPoint(angle, CENTER_R);
          const outer = hexPoint(angle, MAX_R);
          return (
            <line
              key={`div-${wi}`}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#1a1a2e"
              strokeWidth={1.5}
            />
          );
        })}

        {/* Outer hexagonal border */}
        <path
          d={hexPath(MAX_R)}
          fill="none"
          stroke="#2a2a4a"
          strokeWidth={2}
        />

        {/* Wedge labels just outside the outer hex */}
        {WEDGES.map((wedge, wi) => {
          const midAngle = wi * 60; // center of wedge
          const labelPt = hexPoint(midAngle, MAX_R + 18);
          return (
            <text
              key={`label-${wedge}`}
              x={labelPt.x}
              y={labelPt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="16"
              fontWeight="700"
              fill={WEDGE_STROKE_COLORS[wi]}
              style={{ userSelect: 'none' }}
            >
              {wedge}
            </text>
          );
        })}

        {/* Layer number labels (inside wedge A, along center axis) */}
        {Array.from({ length: 6 }, (_, i) => {
          const layer = i + 1;
          const midR = CENTER_R + (layer - 0.5) * LAYER_STEP;
          const pt = hexPoint(0, midR); // wedge A center = 0° from north
          return (
            <text
              key={`layer-label-${layer}`}
              x={pt.x}
              y={pt.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="11"
              fontWeight="700"
              fill="rgba(255,255,255,0.7)"
              style={{ userSelect: 'none' }}
            >
              {layer}
            </text>
          );
        })}

        {/* Storm label */}
        {stormLayer !== null && (() => {
          const r = CENTER_R + (stormLayer - 1) * LAYER_STEP;
          const pt = hexPoint(0, r); // top of storm boundary
          return (
            <text
              x={pt.x}
              y={pt.y - 10}
              textAnchor="middle"
              fontSize="12"
              fill="#e63946"
              fontWeight="700"
              style={{ userSelect: 'none' }}
            >
              STORM
            </text>
          );
        })()}

        {/* Center circle */}
        <circle
          cx={CX}
          cy={CY}
          r={CENTER_R}
          fill="#1a1a2e"
          stroke="#3a3a6a"
          strokeWidth={2}
        />
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fill="#a0a0b8"
          fontWeight="700"
          style={{ userSelect: 'none' }}
        >
          CTR
        </text>

        {/* Players */}
        {Object.entries(positionGroups).map(([key, group]) => {
          if (key === 'center') {
            return <g key="center">{renderPlayersAt(CX, CY, group)}</g>;
          }
          const wedge = key[0];
          const layer = parseInt(key.slice(1));
          const wi = WEDGES.indexOf(wedge);
          if (wi === -1) return null;
          const { x, y } = getCellCenter(wi, layer);
          return <g key={key}>{renderPlayersAt(x, y, group)}</g>;
        })}
      </svg>
    </div>
  );
}
