import { state, constants } from "./state.js";
import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import {
  rebuildWordIndexForGrades,
  getEligibleCompoundWords,
  getEligibleDragWords
} from "./words.js";
import {
  getEnabledGrades,
  isCompoundEnabled,
  isDragWordEnabled
} from "./settings.js";
import { renderBracketColored, setActiveTab, showGameOverModal } from "./ui.js";

export const FILE_VERSION = "1.80";

/* ============================================================
   Utilities
============================================================ */

function rand(n) { return Math.floor(Math.random() * n); }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ============================================================
   Event hook (future profiles / analytics / audio)
============================================================ */

function emitGameEvent(type, payload = {}) {
  // No-op for now.
  // Later: profile tracking, audio, analytics, etc.
  // console.log("GAME EVENT:", type, payload);
}

/* ============================================================
   Score / Lives helpers
============================================================ */

function addScore(amount) {
  state.score += amount;
  emitGameEvent("score", { amount, total: state.score });
}

function loseLives(amount) {
  state.lives -= amount;
  emitGameEvent("livesLost", { amount, total: state.lives });
}

function updateHUD() {
  const livesEl = document.getElementById("hudLives");
  const scoreEl = document.getElementById("hudScore");
  if (livesEl) livesEl.textContent = `❤️ ${Math.max(0, state.lives)}`;
  if (scoreEl) scoreEl.textContent = `${state.score}`;
}

/* ============================================================
   Layout helpers
============================================================ */

function clearBoardLayoutClasses() {
  const qa = document.getElementById("qaGrid");
  if (!qa) return;
  qa.classList.remove("drag-board", "drag-h", "drag-v");
}

function applyBoardLayout(q) {
  const qa = document.getElementById("qaGrid");
  if (!qa) return;

  clearBoardLayoutClasses();

  if (q?.type === "dragword") {
    qa.classList.add("drag-board");
    qa.classList.add(q.layout === "v" ? "drag-v" : "drag-h");
  }
}

/* ============================================================
   Prompt rendering
============================================================ */

function clearPromptClasses() {
  document.getElementById("prompt")?.classList.remove("correct", "wrong", "drag-idle");
}

function setPromptKanji(text) {
  const inner = document.getElementById("promptInner");
  inner.innerHTML = "";
  const div = document.createElement("div");
  div.className = "kanjiText";
  div.textContent = text;
  inner.appendChild(div);
}

function setPromptKana(text) {
  const inner = document.getElementById("promptInner");
  inner.innerHTML = "";
  const div = document.createElement("div");
  div.className = "kanaText";
  div.textContent = text;
  inner.appendChild(div);
}

/* ============================================================
   History
============================================================ */

const MAX_HISTORY = 8;

function ensureHistory() {
  if (!Array.isArray(state.history)) state.history = [];
}

function addHistoryEntry(entry) {
  ensureHistory();
  state.history.unshift(entry);
  if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
  renderHistory();
}

function renderHistory() {
  const host = document.getElementById("historyList");
  if (!host) return;
  host.innerHTML = "";

  for (const h of state.history) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "historyRow";

    const left = document.createElement("div");
    left.className = "historyLeft";

    const mark = document.createElement("div");
    mark.className = "historyMark " + (h.ok ? "ok" : "bad");
    mark.textContent = h.ok ? "✓" : "✕";

    const q = document.createElement("div");
    q.className = "historyQ";
    q.textContent = h.display;

    left.appendChild(mark);
    left.appendChild(q);

    row.appendChild(left);
    row.addEventListener("click", async () => {
      if (h.type === "compound" || h.type === "dragword") {
        await window.__openWordDetail?.(h.wordMeta);
      } else {
        await window.__openDictionaryWithQuery?.(h.dictQuery, true);
      }
    });

    host.appendChild(row);
  }
}

/* ============================================================
   Question generation
============================================================ */

const DRAGWORD_PROBABILITY = 0.35;
const DRAG_LAYOUT_VERTICAL_PROBABILITY = 0.5;

function buildSingleQuestion() {
  const record = state.pool[rand(state.pool.length)];
  const others = state.pool.filter(k => k.id !== record.id);
  shuffle(others);
  const wrongs = others.slice(0, 3);

  const options = shuffle([
    { kanji: record.id, meaning: record.meaningKey, ok: true },
    ...wrongs.map(w => ({ kanji: w.id, meaning: w.meaningKey, ok: false }))
  ]);

  return { type: "single", record, options };
}

function buildCompoundQuestion(eligibleWords) {
  const w = eligibleWords[rand(eligibleWords.length)];
  const [k1, k2] = w.kanjiChars;

  const poolOthers = state.pool.map(x => x.id).filter(x => x !== k1 && x !== k2);
  shuffle(poolOthers);
  const wrongs = poolOthers.slice(0, 2);

  return {
    type: "compound",
    kana: w.kana,
    kanji: w.kanji,
    kanjiChars: w.kanjiChars,
    answers: shuffle([k1, k2, ...wrongs]),
    meta: w.meta || null
  };
}

function buildDragWordQuestion(eligibleWords) {
  const w = eligibleWords[rand(eligibleWords.length)];
  const layout = (Math.random() < DRAG_LAYOUT_VERTICAL_PROBABILITY) ? "v" : "h";
  const targetCount = (layout === "v") ? 3 : 4;

  const correct = Array.from(new Set(w.kanjiChars));
  const poolOthers = state.pool.map(x => x.id).filter(x => !correct.includes(x));
  shuffle(poolOthers);

  const answers = shuffle([
    ...correct,
    ...poolOthers.slice(0, Math.max(0, targetCount - correct.length))
  ]);

  return {
    type: "dragword",
    layout,
    kana: w.kana,
    kanji: w.kanji,
    kanjiChars: w.kanjiChars,
    segments: w.segments || [],
    answers,
    meta: w.meta || null
  };
}

async function pickNextQuestion() {
  const wantDrag = isDragWordEnabled?.();
  const wantCompound = isCompoundEnabled();

  if (wantDrag) {
    const eligibleDrag = getEligibleDragWords(state.pool);
    if (eligibleDrag.length && Math.random() < DRAGWORD_PROBABILITY) {
      return buildDragWordQuestion(eligibleDrag);
    }
  }

  if (wantCompound) {
    const eligible = getEligibleCompoundWords(state.pool);
    if (eligible.length && Math.random() < constants.COMPOUND_PROBABILITY) {
      return buildCompoundQuestion(eligible);
    }
  }

  return buildSingleQuestion();
}

/* ============================================================
   Game lifecycle
============================================================ */

function advanceAfterDelay() {
  setTimeout(() => {
    if (state.lives <= 0) endGame();
    else newQuestion();
  }, constants.PAUSE_AFTER_ANSWER_MS);
}

function endGame() {
  state.locked = true;
  state.gameActive = false;
  emitGameEvent("gameOver", { score: state.score });
  updateHUD();
  showGameOverModal(state.score);
}

async function newQuestion() {
  if (state.lives <= 0) { endGame(); return; }

  state.locked = false;
  state.peekMode = false;
  state.peekChargedThisQuestion = false;
  state.compoundPicks = [];

  clearPromptClasses();
  clearBoardLayoutClasses();

  state.currentQuestion = await pickNextQuestion();
  applyBoardLayout(state.currentQuestion);

  const q = state.currentQuestion;

  if (q.type === "single") {
    setPromptKanji(q.record.id);
    renderChoicesMeaning(q.options);
  }
  else if (q.type === "compound") {
    setPromptKana(q.kana);
    renderChoicesKanjiClick(q.answers);
  }
  else {
    setPromptDragZones(q);
    renderChoicesKanjiDrag(q.answers);
    document.getElementById("prompt")?.classList.add("drag-idle");
  }

  updateHUD();
  renderHistory();
}

/* ============================================================
   Answer handling (unchanged behaviour)
============================================================ */

function applySingleAnswer(btn) {
  state.locked = true;
  const ok = btn.dataset.ok === "1";

  if (ok) addScore(1);
  else loseLives(constants.COST_WRONG);

  addHistoryEntry({
    type: "single",
    display: state.currentQuestion.record.id,
    ok,
    dictQuery: state.currentQuestion.record.id
  });

  updateHUD();
  advanceAfterDelay();
}

function evaluateCompoundSecondPick() {
  const q = state.currentQuestion;
  const correct = new Set(q.kanjiChars);
  const picked = new Set(state.compoundPicks);
  const ok = q.kanjiChars.every(k => picked.has(k));

  if (ok) addScore(1);
  else loseLives(constants.COST_WRONG);

  addHistoryEntry({
    type: "compound",
    display: q.kana,
    ok,
    wordMeta: q.meta || { word: q.kanji, reading: q.kana }
  });

  updateHUD();
  advanceAfterDelay();
}

function handleCompoundPick(btn) {
  if (state.locked) return;

  const k = btn.dataset.kanji;
  if (state.compoundPicks.includes(k)) return;

  state.compoundPicks.push(k);
  if (state.compoundPicks.length === 2) {
    state.locked = true;
    evaluateCompoundSecondPick();
  }
}

function onChoiceClick(btn) {
  if (state.locked || state.peekMode) return;

  const t = state.currentQuestion?.type;
  if (t === "single") applySingleAnswer(btn);
  else if (t === "compound") handleCompoundPick(btn);
}

/* ============================================================
   Public API
============================================================ */

export async function startQuizGame() {
  const enabledGrades = getEnabledGrades();
  if (!enabledGrades.length) {
    alert("Enable at least one grade in Settings.");
    setActiveTab("settings");
    return;
  }

  await ensureGradesLoaded(enabledGrades);
  state.pool = buildPoolForGrades(enabledGrades);
  rebuildWordIndexForGrades(enabledGrades);

  state.score = 0;
  state.lives = constants.START_LIVES;
  state.history = [];
  state.gameActive = true;

  setActiveTab("game");
  updateHUD();
  newQuestion();
}

export function wireGameUI() {
  document.getElementById("prompt")?.addEventListener("click", () => {
    if (state.locked) return;
    // peek logic remains unchanged (handled elsewhere in your original structure)
  });
}
