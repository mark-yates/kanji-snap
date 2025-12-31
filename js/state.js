export const state = {
  // settings (loaded by settings.js)
  settings: null,

  // loaded data
  loadedGrades: new Set(),
  kanjiById: new Map(),

  // game state
  pool: [],
  current: null,
  currentOptions: null,
  locked: false,
  score: 0,
  lives: 10,
  peekMode: false,
  peekChargedThisQuestion: false,
};

export const constants = {
  START_LIVES: 10,
  COST_WRONG: 3,
  COST_PEEK: 1,

  PAUSE_AFTER_ANSWER_MS: 900,
  PAUSE_ENDGAME_MS: 700,

  MEANING_IMG_DIR: "./images/meaning/",
};
