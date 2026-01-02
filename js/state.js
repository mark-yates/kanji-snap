export const state = {
  // settings
  settings: null,

  // loaded kanji data
  loadedGrades: new Set(),
  kanjiById: new Map(),

  // derived word/compound index built from kanji raw data
  wordsIndexBuiltForGradesKey: "",  // e.g. "1,2,3"
  compoundWords: [],                // [{kana, kanji, kanjiChars, meta}]
  compoundByKanji: new Map(),       // kanjiChar -> list of compoundWord entries

  // game state
  pool: [],
  currentQuestion: null,
  locked: false,
  score: 0,
  lives: 10,
  peekMode: false,
  peekChargedThisQuestion: false,

  // compound selection state
  compoundPicks: [],
};

export const constants = {
  START_LIVES: 10,
  COST_WRONG: 3,
  COST_PEEK: 1,

  PAUSE_AFTER_ANSWER_MS: 900,
  PAUSE_ENDGAME_MS: 700,

  MEANING_IMG_DIR: "./images/meaning/",

  // probability that a new question is a compound (if eligible)
  COMPOUND_PROBABILITY: 0.35
};
