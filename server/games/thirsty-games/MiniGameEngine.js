const { initMazeRunnerState, applyMazeMove } = require('../maze-runner/MazeRunnerEngine');

// ── Trivia question bank (30 questions) ──────────────────────────────────────
const TRIVIA_QUESTIONS = [
  { q: "What is the largest planet in our solar system?", choices: ["Saturn","Jupiter","Neptune","Uranus"], answer: 1 },
  { q: "How many sides does a hexagon have?", choices: ["5","6","7","8"], answer: 1 },
  { q: "What gas do plants absorb from the atmosphere?", choices: ["Oxygen","Hydrogen","Carbon Dioxide","Nitrogen"], answer: 2 },
  { q: "Who painted the Mona Lisa?", choices: ["Michelangelo","Raphael","Leonardo da Vinci","Donatello"], answer: 2 },
  { q: "What is the chemical symbol for gold?", choices: ["Go","Gd","Au","Ag"], answer: 2 },
  { q: "How many bones are in the adult human body?", choices: ["186","206","226","246"], answer: 1 },
  { q: "What is the capital of Australia?", choices: ["Sydney","Melbourne","Brisbane","Canberra"], answer: 3 },
  { q: "Which element has the atomic number 1?", choices: ["Helium","Hydrogen","Lithium","Oxygen"], answer: 1 },
  { q: "What year did World War II end?", choices: ["1943","1944","1945","1946"], answer: 2 },
  { q: "How many strings does a standard guitar have?", choices: ["4","5","6","7"], answer: 2 },
  { q: "What is the speed of light (approx)?", choices: ["200,000 km/s","300,000 km/s","400,000 km/s","500,000 km/s"], answer: 1 },
  { q: "Which country invented pizza?", choices: ["France","Spain","Greece","Italy"], answer: 3 },
  { q: "What is the largest ocean?", choices: ["Atlantic","Indian","Arctic","Pacific"], answer: 3 },
  { q: "How many players on a basketball team on court?", choices: ["4","5","6","7"], answer: 1 },
  { q: "What is the square root of 144?", choices: ["11","12","13","14"], answer: 1 },
  { q: "Which planet is closest to the sun?", choices: ["Venus","Earth","Mars","Mercury"], answer: 3 },
  { q: "What language has the most native speakers?", choices: ["English","Spanish","Hindi","Mandarin"], answer: 3 },
  { q: "How many continents are there?", choices: ["5","6","7","8"], answer: 2 },
  { q: "What is the hardest natural substance?", choices: ["Gold","Iron","Diamond","Platinum"], answer: 2 },
  { q: "In which year did the Titanic sink?", choices: ["1910","1911","1912","1913"], answer: 2 },
  { q: "What is the smallest prime number?", choices: ["0","1","2","3"], answer: 2 },
  { q: "Which country has the most natural lakes?", choices: ["USA","Russia","Brazil","Canada"], answer: 3 },
  { q: "How many hearts does an octopus have?", choices: ["1","2","3","4"], answer: 2 },
  { q: "What is the tallest mountain on Earth?", choices: ["K2","Kangchenjunga","Mount Everest","Lhotse"], answer: 2 },
  { q: "Which gas makes up most of Earth's atmosphere?", choices: ["Oxygen","Argon","Carbon Dioxide","Nitrogen"], answer: 3 },
  { q: "What is the currency of Japan?", choices: ["Won","Yuan","Yen","Ringgit"], answer: 2 },
  { q: "How many teeth does an adult human have?", choices: ["28","30","32","34"], answer: 2 },
  { q: "What sport uses a shuttlecock?", choices: ["Tennis","Badminton","Squash","Pickleball"], answer: 1 },
  { q: "Who wrote Romeo and Juliet?", choices: ["Charles Dickens","Jane Austen","William Shakespeare","Mark Twain"], answer: 2 },
  { q: "How many degrees in a right angle?", choices: ["45","60","90","120"], answer: 2 },
];

// ── Memory game color palette ─────────────────────────────────────────────────
const MEMORY_COLORS = ['white', 'black', 'magenta', 'baby-blue'];

// ── Know-X prompts ────────────────────────────────────────────────────────────
const KNOW_X_PROMPTS = [
  "Name 5 things you'd bring to the beach",
  "Name 5 of your favorite movies",
  "Name 5 of your favorite foods",
  "Name 5 countries you'd love to visit",
  "Name 5 of your hobbies or interests",
  "Name 5 things you'd bring to a deserted island",
  "Name 5 of your favorite TV shows",
  "Name 5 things that make you happy",
  "Name 5 of your favorite musicians or bands",
  "Name 5 things you'd find in your dream home",
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickTriviaQuestions(n = 5) {
  return shuffle(TRIVIA_QUESTIONS).slice(0, n);
}

function generateMemoryGrid(size = 5) {
  const grid = [];
  for (let r = 0; r < size; r++) {
    grid[r] = [];
    for (let c = 0; c < size; c++) {
      grid[r][c] = pickRandom(MEMORY_COLORS);
    }
  }
  return grid;
}

// ── Init functions for each mini-game ────────────────────────────────────────

function initDeathState(competitors) {
  return {
    type: 'death',
    competitors, // [{ socketId, name }]
    numbers: {}, // socketId -> number string
    revealed: false,
  };
}

function initMazeState(competitors) {
  const fakePlayers = competitors.map(c => ({ socketId: c.socketId, name: c.name }));
  const mazeState = initMazeRunnerState(fakePlayers);
  return {
    type: 'maze',
    competitors,
    maze: mazeState.maze,
    positions: Object.fromEntries(
      competitors.map(c => [c.socketId, { x: 0, y: 0, finished: false, finishTime: null, name: c.name }])
    ),
    winner: null,
    startTime: Date.now(),
  };
}

function initTriviaState(competitors) {
  const questions = pickTriviaQuestions(5);
  return {
    type: 'trivia',
    competitors,
    questions,
    currentQ: 0,
    answers: Object.fromEntries(competitors.map(c => [c.socketId, []])), // array of { answer, timeMs }
    questionStartTime: null,
    phase: 'question', // 'question' | 'reveal' | 'done'
  };
}

function initKnowXState(competitors, allPlayers) {
  // Pick a subject from non-competitors
  const nonCompetitors = allPlayers.filter(
    p => p.isAlive && !competitors.find(c => c.socketId === p.socketId)
  );
  const subjectPlayer = nonCompetitors.length > 0
    ? nonCompetitors[Math.floor(Math.random() * nonCompetitors.length)]
    : competitors[0]; // fallback
  const subject = { socketId: subjectPlayer.socketId, name: subjectPlayer.name };
  const prompt = pickRandom(KNOW_X_PROMPTS);
  return {
    type: 'know-x',
    competitors,
    subject,
    prompt,
    subjectAnswers: null, // array of 5 strings, set when subject submits
    guesses: {}, // socketId -> [string, string, string, string, string]
    guessTimes: {}, // socketId -> ms taken
    guessStart: null,
    phase: 'subject-answering', // 'subject-answering' | 'competitors-guessing' | 'done'
  };
}

function initTruthsLiesState(competitors) {
  return {
    type: 'truths-lies',
    competitors,
    statements: {}, // socketId -> [{ text, isLie }]  — 3 items, 1 isLie
    votes: {}, // competitorSocketId -> { [voterSocketId]: statementIndex (0,1,2) }
    submitTimes: {}, // socketId -> ms taken
    submitStart: null,
    phase: 'writing', // 'writing' | 'voting-0' | 'voting-1' | 'done'
    juiciestVotes: {}, // socketId -> votes
  };
}

function initMemoryState(competitors) {
  const grid = generateMemoryGrid(5);
  return {
    type: 'memory',
    competitors,
    grid,
    showingGrid: true, // true for 15 seconds, then false
    submissions: {}, // socketId -> 5x5 grid
    submitTimes: {}, // socketId -> ms
    submitStart: null,
    phase: 'memorize', // 'memorize' | 'recall' | 'done'
  };
}

// ── Scoring helpers ───────────────────────────────────────────────────────────

function scoreMemorySubmission(original, submission) {
  let correct = 0;
  const total = original.length * original[0].length;
  for (let r = 0; r < original.length; r++) {
    for (let c = 0; c < original[r].length; c++) {
      if (submission[r]?.[c] === original[r][c]) correct++;
    }
  }
  return correct / total;
}

function scoreTriviaAnswers(questions, answers) {
  let correct = 0;
  let totalTime = 0;
  for (let i = 0; i < questions.length; i++) {
    const a = answers[i];
    if (!a) continue;
    if (a.answer === questions[i].answer) correct++;
    totalTime += a.timeMs || 0;
  }
  return { correct, totalTime };
}

function scoreKnowX(subjectAnswers, guesses) {
  // Case-insensitive partial match
  let correct = 0;
  const used = new Set();
  for (const guess of guesses) {
    if (!guess) continue;
    const g = guess.trim().toLowerCase();
    for (let i = 0; i < subjectAnswers.length; i++) {
      if (used.has(i)) continue;
      const s = subjectAnswers[i].trim().toLowerCase();
      if (s && g && (s.includes(g) || g.includes(s))) {
        correct++;
        used.add(i);
        break;
      }
    }
  }
  return correct;
}

module.exports = {
  initDeathState,
  initMazeState,
  initTriviaState,
  initKnowXState,
  initTruthsLiesState,
  initMemoryState,
  scoreMemorySubmission,
  scoreTriviaAnswers,
  scoreKnowX,
  applyMazeMove,
  MEMORY_COLORS,
};
