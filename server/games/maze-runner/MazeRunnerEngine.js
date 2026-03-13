const DIRECTIONS = ['UP', 'DOWN', 'LEFT', 'RIGHT'];

// Recursive backtracker maze generation on a 15x15 grid
function generateMaze(width, height) {
  // Initialize grid: every cell has all walls
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid[y] = [];
    for (let x = 0; x < width; x++) {
      grid[y][x] = { walls: { N: true, S: true, E: true, W: true }, visited: false };
    }
  }

  function removeWall(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 1) { grid[y1][x1].walls.E = false; grid[y2][x2].walls.W = false; }
    else if (dx === -1) { grid[y1][x1].walls.W = false; grid[y2][x2].walls.E = false; }
    else if (dy === 1) { grid[y1][x1].walls.S = false; grid[y2][x2].walls.N = false; }
    else if (dy === -1) { grid[y1][x1].walls.N = false; grid[y2][x2].walls.S = false; }
  }

  function getUnvisitedNeighbors(x, y) {
    const neighbors = [];
    if (y > 0 && !grid[y - 1][x].visited) neighbors.push({ x, y: y - 1 });
    if (y < height - 1 && !grid[y + 1][x].visited) neighbors.push({ x, y: y + 1 });
    if (x > 0 && !grid[y][x - 1].visited) neighbors.push({ x: x - 1, y });
    if (x < width - 1 && !grid[y][x + 1].visited) neighbors.push({ x: x + 1, y });
    return neighbors;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Iterative DFS to avoid stack overflow on large grids
  const stack = [{ x: 0, y: 0 }];
  grid[0][0].visited = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = shuffle(getUnvisitedNeighbors(current.x, current.y));
    if (neighbors.length === 0) {
      stack.pop();
    } else {
      const next = neighbors[0];
      removeWall(current.x, current.y, next.x, next.y);
      grid[next.y][next.x].visited = true;
      stack.push(next);
    }
  }

  // Clean up visited flag
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      delete grid[y][x].visited;
    }
  }

  return grid;
}

function initMazeRunnerState(players) {
  const maze = generateMaze(15, 15);
  const playerMap = {};
  for (const p of players) {
    playerMap[p.socketId] = {
      socketId: p.socketId,
      name: p.name,
      x: 0,
      y: 0,
      finished: false,
      finishTime: null,
    };
  }
  return {
    maze,
    players: playerMap,
    phase: 'playing',
    winner: null,
    finishOrder: [],
    startTime: Date.now(),
  };
}

function applyMazeMove(state, socketId, direction) {
  const player = state.players[socketId];
  if (!player || player.finished || state.phase === 'ended') {
    return { moved: false, finished: false };
  }

  let { x, y } = player;
  const cell = state.maze[y][x];

  let newX = x;
  let newY = y;

  if (direction === 'UP') {
    if (cell.walls.N) return { moved: false, finished: false };
    newY = y - 1;
  } else if (direction === 'DOWN') {
    if (cell.walls.S) return { moved: false, finished: false };
    newY = y + 1;
  } else if (direction === 'LEFT') {
    if (cell.walls.W) return { moved: false, finished: false };
    newX = x - 1;
  } else if (direction === 'RIGHT') {
    if (cell.walls.E) return { moved: false, finished: false };
    newX = x + 1;
  } else {
    return { moved: false, finished: false };
  }

  // Bounds check
  if (newX < 0 || newX > 14 || newY < 0 || newY > 14) {
    return { moved: false, finished: false };
  }

  player.x = newX;
  player.y = newY;

  // Check if reached exit
  const finished = newX === 14 && newY === 14;
  if (finished) {
    player.finished = true;
    player.finishTime = Date.now();
    state.finishOrder.push(socketId);

    // First to finish wins
    if (!state.winner) {
      state.winner = socketId;
    }
  }

  return { moved: true, finished };
}

module.exports = {
  initMazeRunnerState,
  applyMazeMove,
  DIRECTIONS,
};
