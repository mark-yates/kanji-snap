export const constants = {
  START_LIVES: 10,
  COST_WRONG: 3,
  COST_PEEK: 1,

  PAUSE_AFTER_ANSWER_MS: 1100,
  PAUSE_ENDGAME_MS: 500,

  COMPOUND_PROBABILITY: 0.35,

  MEANING_IMG_DIR: "./meaning-img/" // you can change later
};

export const state = {
  settings: null,

  loadedGrades: new Set(),
  kanjiById: new Map(),
  pool: [],

  // game state
  score: 0,
  lives: constants.START_LIVES,
  locked: false,
  peekMode: false,
  peekChargedThisQuestion: false,
  currentQuestion: null,
  compoundPicks: [],
  history: [],

  // navigation helpers
  gameActive: false,        // true while you’re mid-game
  returnTo: null,           // "game" or null
  lastWordDetail: null      // last word block shown on word page
};
