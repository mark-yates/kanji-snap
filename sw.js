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

export const FILE_VERSION = "1.81";

const MAX_HISTORY = 8;
const RUNTIME_CACHE = "kanji-snap-runtime-v1";

// Mix probabilities (drag checked first, then compound, else single)
const DRAGWORD_PROBABILITY = 0.35;

// 50/50 split for drag layouts
const DRAG_LAYOUT_VERTICAL_PROBABILITY = 0.5;

/* ---------- utils ---------- */

function rand(n) { return Math.floor(Math.random() * n); }
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// IMPORTANT: compute the SW cache key (url.pathname) for GitHub Pages base paths
function meaningImagePath(kanjiChar) {
  return new URL(`./images/meaning/cartoon/${encodeURIComponent(kanjiChar)}.webp`, location.href).pathname;
}

function updateHUD() {
  const livesEl = document.getElementById("hudLives");
  const scoreEl = document.getElementById("hudScore");
  if (livesEl) livesEl.textContent = `❤️ ${Math.max(0, state.lives)}`;
  if (scoreEl) scoreEl.textContent = `${state.score}`;
}

function endGame() {
  cancelActiveDrag();
  state.locked = true;
  state.peekMode = false;
  state.gameActive = false;
  updateHUD();
  showGameOverModal(state.score);
}

function clearPromptClasses() {
  document.getElementById("prompt")?.classList.remove("correct", "wrong", "drag-idle");
}

function clearBoardLayoutClasses() {
  const qa = document.getElementById("qaGrid");
  if (!qa) return;
  qa.classList.remove("drag-board", "drag-h", "drag-v");
}

function applyBoardLayoutForQuestion(q) {
  const qa = document.getElementById("qaGrid");
  if (!qa) return;

  // Always reset
  qa.classList.remove("drag-board", "drag-h", "drag-v");

  if (q?.type === "dragword") {
    qa.classList.add("drag-board");
    qa.classList.add(q.layout === "v" ? "drag-v" : "drag-h");
  }
}

function setPromptKanji(text) {
  const inner = document.getElementById("promptInner");
  if (!inner) return;
  inner.innerHTML = "";
  const div = document.createElement("div");
  div.className = "kanjiText";
  div.textContent = text;
  inner.appendChild(div);
}

function setPromptKana(text) {
  const inner = document.getElementById("promptInner");
  if (!inner) return;
  inner.innerHTML = "";
  const div = document.createElement("div");
  div.className = "kanaText";
  div.textContent = text;
  inner.appendChild(div);
}

/* ---------- History ---------- */

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

    const right = document.createElement("div");
    right.className = "historyRight";
    right.textContent = "Details";

    row.appendChild(left);
    row.appendChild(right);

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

/* ---------- Meaning tiles: CACHE ONLY ---------- */

function renderFallback(btn, fallbackText) {
  btn.innerHTML = "";
  const fallback = document.createElement("div");
  fallback.className = "meaningFallback";

  const inner = document.createElement("div");
  inner.className = "fallbackRich";
  renderBracketColored(inner, fallbackText);

  fallback.appendChild(inner);
  btn.appendChild(fallback);
}

async function setMeaningFromCache(btn, kanjiChar, fallbackText) {
  renderFallback(btn, fallbackText);

  const path = meaningImagePath(kanjiChar);

  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const hit = await cache.match(path);
    if (!hit) return;

    const blob = await hit.blob();
    const objectUrl = URL.createObjectURL(blob);

    const img = document.createElement("img");
    img.className = "meaningImg";
    img.alt = fallbackText;

    img.style.position = "absolute";
    img.style.inset = "0";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";

    img.onload = () => setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    img.onerror = () => { URL.revokeObjectURL(objectUrl); img.remove(); };

    img.src = objectUrl;

    btn.innerHTML = "";
    btn.appendChild(img);
  } catch {
    // keep fallback
  }
}

function renderChoicesMeaning(options) {
  const choicesEl = document.getElementById("choices");
  if (!choicesEl) return;
  choicesEl.innerHTML = "";
  choicesEl.style.display = "grid";

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.dataset.kind = "meaning";
    btn.dataset.ok = opt.ok ? "1" : "0";
    btn.dataset.kanji = opt.kanji;

    setMeaningFromCache(btn, opt.kanji, opt.meaning);

    btn.addEventListener("click", () => onChoiceClick(btn));
    choicesEl.appendChild(btn);
  });
}

/* ---------- Kanji tiles (compound click mode) ---------- */

function renderChoicesKanjiClick(kanjiOptions) {
  const choicesEl = document.getElementById("choices");
  if (!choicesEl) return;
  choicesEl.innerHTML = "";
  choicesEl.style.display = "grid";

  kanjiOptions.forEach(k => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.dataset.kind = "compound";
    btn.dataset.kanji = k;

    const div = document.createElement("div");
    div.className = "choiceKanji";
    div.textContent = k;
    btn.appendChild(div);

    btn.addEventListener("click", () => onChoiceClick(btn));
    choicesEl.appendChild(btn);
  });
}

/* ---------- Peek tiles ---------- */

function renderPeekSingle(record) {
  const choicesEl = document.getElementById("choices");
  if (!choicesEl) return;
  choicesEl.innerHTML = "";
  choicesEl.style.display = "block";

  const tile = document.createElement("div");
  tile.className = "settingsCard";

  const pre = document.createElement("pre");
  pre.className = "mono";
  pre.textContent = JSON.stringify(record.raw, null, 2);

  const hint = document.createElement("div");
  hint.className = "muted";
  hint.style.marginTop = "8px";
  hint.textContent = "Tap the prompt tile again to return to the choices.";

  tile.appendChild(pre);
  tile.appendChild(hint);
  choicesEl.appendChild(tile);
}

function renderPeekCompound(q) {
  const choicesEl = document.getElementById("choices");
  if (!choicesEl) return;
  choicesEl.innerHTML = "";
  choicesEl.style.display = "block";

  const tile = document.createElement("div");
  tile.className = "settingsCard";

  const pre = document.createElement("pre");
  pre.className = "mono";
  pre.textContent = JSON.stringify(q.meta || {}, null, 2);

  const hint = document.createElement("div");
  hint.className = "muted";
  hint.style.marginTop = "8px";
  hint.textContent = "Tap the prompt tile again to return to the choices.";

  tile.appendChild(pre);
  tile.appendChild(hint);
  choicesEl.appendChild(tile);
}

/* ---------- Drag word rendering + mechanics ---------- */

const drag = {
  active: false,
  pointerId: null,
  kanji: "",
  originBtn: /** @type {HTMLButtonElement|null} */ (null),
  dragEl: /** @type {HTMLElement|null} */ (null),
  hoveredZoneId: /** @type {number|null} */ (null),

  // Per-question zone registry:
  zones: /** @type {Map<number, {id:number, expectKanji:string, el:HTMLSpanElement, filled:boolean}>} */ (new Map()),
};

function cancelActiveDrag() {
  if (!drag.active) return;
  try {
    window.removeEventListener("pointermove", moveDrag);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  } catch { /* ignore */ }

  clearHover();
  drag.dragEl?.remove();

  drag.active = false;
  drag.pointerId = null;
  drag.kanji = "";
  drag.originBtn = null;
  drag.dragEl = null;

  // if we abort a drag mid-question, restore idle cue
  if (!state.locked && state.currentQuestion?.type === "dragword") {
    document.getElementById("prompt")?.classList.add("drag-idle");
  }
}

function clearHover() {
  if (drag.hoveredZoneId == null) return;
  const z = drag.zones.get(drag.hoveredZoneId);
  z?.el.classList.remove("hover");
  drag.hoveredZoneId = null;
}

function setHover(zoneId) {
  if (drag.hoveredZoneId === zoneId) return;
  clearHover();
  if (zoneId == null) return;

  const z = drag.zones.get(zoneId);
  if (!z || z.filled) return;

  z.el.classList.add("hover");
  drag.hoveredZoneId = zoneId;
}

function hitTestZone(clientX, clientY) {
  let el = document.elementFromPoint(clientX, clientY);
  while (el && el !== document.body) {
    if (el instanceof HTMLSpanElement && el.classList.contains("dd-zone")) {
      const id = Number(el.dataset.zoneId);
      return Number.isFinite(id) ? id : null;
    }
    el = el.parentElement;
  }
  return null;
}

function allKanjiZonesFilled() {
  // Only zones with expectKanji != "" are required
  for (const z of drag.zones.values()) {
    if (z.expectKanji && !z.filled) return false;
  }
  return true;
}

function setPromptDragZones(q) {
  const inner = document.getElementById("promptInner");
  if (!inner) return;

  inner.innerHTML = "";
  const line = document.createElement("div");
  line.className = "kanaText";
  line.style.display = "inline-block";

  // Horizontal: keep all in one line.
  // Vertical: allow wrapping/columns (future sentence support).
  if (q.layout === "h") {
    line.style.whiteSpace = "nowrap";
  } else {
    line.style.whiteSpace = "normal";
  }

  drag.zones = new Map();

  // Render all segments as dd-zone:
  // - kanji-bearing segments: expectKanji = kanji
  // - kana-only segments: expectKanji = "" (incorrect drop-zone)
  q.segments.forEach((seg, idx) => {
    const span = document.createElement("span");
    span.className = "dd-zone";
    span.dataset.zoneId = String(idx);
    span.dataset.expectKanji = seg.kanji || "";
    span.textContent = seg.reading || "";
    line.appendChild(span);

    drag.zones.set(idx, {
      id: idx,
      expectKanji: seg.kanji || "",
      el: span,
      filled: false
    });
  });

  inner.appendChild(line);
}

function renderChoicesKanjiDrag(kanjiOptions) {
  const choicesEl = document.getElementById("choices");
  if (!choicesEl) return;
  choicesEl.innerHTML = "";
  choicesEl.style.display = "grid";

  kanjiOptions.forEach(k => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.dataset.kind = "dragword";
    btn.dataset.kanji = k;

    // Better touch behavior while dragging
    btn.style.touchAction = "none";

    const div = document.createElement("div");
    div.className = "choiceKanji";
    div.textContent = k;
    btn.appendChild(div);

    btn.addEventListener("pointerdown", (e) => {
      if (state.locked || state.peekMode) return;
      if (e.button != null && e.button !== 0) return;
      beginDrag(btn, k, e);
    });

    // Don’t click-answer in drag mode
    btn.addEventListener("click", (e) => e.preventDefault());

    choicesEl.appendChild(btn);
  });
}

function beginDrag(btn, kanji, e) {
  if (state.locked) return;

  drag.active = true;

  // Leaving idle state while dragging
  document.getElementById("prompt")?.classList.remove("drag-idle");

  drag.pointerId = e.pointerId;
  drag.kanji = kanji;
  drag.originBtn = btn;

  const ghost = document.createElement("div");
  ghost.className = "dd-drag";
  ghost.textContent = kanji;
  document.body.appendChild(ghost);
  drag.dragEl = ghost;

  moveDrag(e);

  window.addEventListener("pointermove", moveDrag, { passive: false });
  window.addEventListener("pointerup", endDrag, { passive: false });
  window.addEventListener("pointercancel", endDrag, { passive: false });

  try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
}

function moveDrag(e) {
  if (!drag.active || drag.pointerId !== e.pointerId) return;
  e.preventDefault();

  if (drag.dragEl) {
    drag.dragEl.style.left = `${e.clientX}px`;
    drag.dragEl.style.top = `${e.clientY}px`;
  }

  // Hit test using glyph center (not finger)
  if (drag.dragEl) {
    const r = drag.dragEl.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    setHover(hitTestZone(x, y));
  } else {
    setHover(null);
  }
}

function flashWrongAndAdvance(displayText, wordMeta) {
  state.locked = true;

  const promptEl = document.getElementById("prompt");
  promptEl?.classList.remove("correct");
  promptEl?.classList.add("wrong");
  drag.originBtn?.classList.add("wrong");

  state.lives -= constants.COST_WRONG;

  addHistoryEntry({
    type: "dragword",
    display: displayText,
    ok: false,
    wordMeta
  });

  updateHUD();
  setTimeout(() => state.lives <= 0 ? endGame() : newQuestion(), constants.PAUSE_AFTER_ANSWER_MS);
}

function markCorrectAndAdvance(displayText, wordMeta) {
  state.locked = true;

  const promptEl = document.getElementById("prompt");
  promptEl?.classList.remove("wrong");
  promptEl?.classList.add("correct");

  state.score += 1;

  addHistoryEntry({
    type: "dragword",
    display: displayText,
    ok: true,
    wordMeta
  });

  updateHUD();
  setTimeout(() => state.lives <= 0 ? endGame() : newQuestion(), constants.PAUSE_AFTER_ANSWER_MS);
}

function placeCorrect(zoneId) {
  const z = drag.zones.get(zoneId);
  if (!z || z.filled) return;

  z.filled = true;
  z.el.classList.remove("hover");
  z.el.classList.add("filled");
  z.el.textContent = z.expectKanji;
}

function endDrag(e) {
  if (!drag.active || drag.pointerId !== e.pointerId) return;
  e.preventDefault();

  window.removeEventListener("pointermove", moveDrag);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);

  const q = state.currentQuestion;

  // Decide drop target based on glyph position
  let zoneId = null;
  if (drag.dragEl) {
    const r = drag.dragEl.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    zoneId = hitTestZone(x, y);
  }

  // Default: snap-back if outside any zone
  if (zoneId != null && q && q.type === "dragword" && !state.locked) {
    const z = drag.zones.get(zoneId);

    if (z && !z.filled) {
      const expect = z.expectKanji || "";

      if (!expect) {
        // kana-only segment => incorrect drop-zone
        flashWrongAndAdvance(q.kana, q.meta || { word: q.kanji, reading: q.kana });
      } else if (drag.kanji === expect) {
        placeCorrect(zoneId);

        if (allKanjiZonesFilled()) {
          markCorrectAndAdvance(q.kana, q.meta || { word: q.kanji, reading: q.kana });
        }
      } else {
        // wrong kanji on a kanji-zone => immediate fail
        flashWrongAndAdvance(q.kana, q.meta || { word: q.kanji, reading: q.kana });
      }
    }
  }

  clearHover();

  drag.dragEl?.remove();
  drag.dragEl = null;
  drag.active = false;
  drag.pointerId = null;
  drag.kanji = "";
  drag.originBtn = null;

  // If question still active (not answered), restore idle blue
  if (!state.locked && state.currentQuestion?.type === "dragword") {
    document.getElementById("prompt")?.classList.add("drag-idle");
  }
}

/* ---------- Question generation ---------- */

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

  const answers = shuffle([k1, k2, ...wrongs]);

  return {
    type: "compound",
    kana: w.kana,
    kanji: w.kanji,
    kanjiChars: w.kanjiChars,
    answers,
    meta: w.meta || null
  };
}

function buildDragWordQuestion(eligibleWords) {
  const w = eligibleWords[rand(eligibleWords.length)];

  // 50/50: choose layout
  const layout = (Math.random() < DRAG_LAYOUT_VERTICAL_PROBABILITY) ? "v" : "h";

  // Vertical uses 3 tiles; horizontal uses 4 tiles
  const targetCount = (layout === "v") ? 3 : 4;

  const correct = Array.from(new Set(w.kanjiChars));
  const needWrong = Math.max(0, targetCount - correct.length);

  const poolOthers = state.pool.map(x => x.id).filter(x => !correct.includes(x));
  shuffle(poolOthers);
  const wrongs = poolOthers.slice(0, needWrong);

  const answers = shuffle([...correct, ...wrongs]);

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
  const wantDrag = typeof isDragWordEnabled === "function" ? isDragWordEnabled() : false;
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

/* ---------- Lifecycle ---------- */

async function newQuestion() {
  cancelActiveDrag();

  if (state.lives <= 0) { endGame(); return; }

  state.locked = false;
  state.peekMode = false;
  state.peekChargedThisQuestion = false;
  state.compoundPicks = [];
  clearPromptClasses();
  clearBoardLayoutClasses();

  state.currentQuestion = await pickNextQuestion();

  // Apply board layout classes (dragword only)
  applyBoardLayoutForQuestion(state.currentQuestion);

  if (state.currentQuestion.type === "single") {
    setPromptKanji(state.currentQuestion.record.id);
    renderChoicesMeaning(state.currentQuestion.options);
  } else if (state.currentQuestion.type === "compound") {
    setPromptKana(state.currentQuestion.kana);
    renderChoicesKanjiClick(state.currentQuestion.answers);
  } else {
    // dragword
    setPromptDragZones(state.currentQuestion);
    renderChoicesKanjiDrag(state.currentQuestion.answers);

    // 🟦 Idle visual cue
    document.getElementById("prompt")?.classList.add("drag-idle");
  }

  updateHUD();
  renderHistory();
}

function handleSingleAnswer(btn) {
  state.locked = true;
  const promptEl = document.getElementById("prompt");
  const buttons = Array.from(document.querySelectorAll("button.choice"));
  buttons.forEach(b => b.disabled = true);

  const ok = btn.dataset.ok === "1";
  if (ok) {
    state.score += 1;
    btn.classList.add("correct");
    promptEl?.classList.add("correct");
  } else {
    state.lives -= constants.COST_WRONG;
    btn.classList.add("wrong");
    promptEl?.classList.add("wrong");
    buttons.find(b => b.dataset.ok === "1")?.classList.add("correct");
  }

  addHistoryEntry({ type: "single", display: state.currentQuestion.record.id, ok, dictQuery: state.currentQuestion.record.id });

  updateHUD();
  setTimeout(() => state.lives <= 0 ? endGame() : newQuestion(), constants.PAUSE_AFTER_ANSWER_MS);
}

function evaluateCompoundSecondPick() {
  const q = state.currentQuestion;
  const correct = new Set(q.kanjiChars);
  const picked = new Set(state.compoundPicks);

  document.querySelectorAll("button.choice").forEach(b => {
    const k = b.dataset.kanji;
    b.classList.remove("selected", "correct", "wrong");
    if (correct.has(k)) b.classList.add("correct");
    else if (picked.has(k)) b.classList.add("wrong");
    b.disabled = true;
  });

  const promptEl = document.getElementById("prompt");
  const ok = q.kanjiChars.every(k => picked.has(k));
  if (ok) {
    state.score += 1;
    promptEl?.classList.add("correct");
  } else {
    state.lives -= constants.COST_WRONG;
    promptEl?.classList.add("wrong");
  }

  addHistoryEntry({ type: "compound", display: q.kana, ok, wordMeta: q.meta || { word: q.kanji, reading: q.kana } });

  updateHUD();
  setTimeout(() => state.lives <= 0 ? endGame() : newQuestion(), constants.PAUSE_AFTER_ANSWER_MS);
}

function handleCompoundPick(btn) {
  if (state.locked) return;
  const k = btn.dataset.kanji;
  if (state.compoundPicks.includes(k)) return;

  state.compoundPicks.push(k);
  if (state.compoundPicks.length === 1) {
    btn.classList.add("selected");
  } else {
    state.locked = true;
    evaluateCompoundSecondPick();
  }
}

function onChoiceClick(btn) {
  if (state.peekMode || state.locked) return;

  const t = state.currentQuestion?.type;
  if (t === "single") handleSingleAnswer(btn);
  else if (t === "compound") handleCompoundPick(btn);
  // dragword doesn’t use click
}

function togglePeek() {
  if (state.locked || !state.currentQuestion) return;

  // Keep drag questions simple for now: no peek (avoids resetting filled zones)
  if (state.currentQuestion.type === "dragword") return;

  state.peekMode = !state.peekMode;
  if (state.peekMode && !state.peekChargedThisQuestion) {
    state.lives -= constants.COST_PEEK;
    state.peekChargedThisQuestion = true;
    if (state.lives <= 0) { endGame(); return; }
  }

  if (state.peekMode) {
    state.currentQuestion.type === "single"
      ? renderPeekSingle(state.currentQuestion.record)
      : renderPeekCompound(state.currentQuestion);
  } else {
    if (state.currentQuestion.type === "single") renderChoicesMeaning(state.currentQuestion.options);
    else renderChoicesKanjiClick(state.currentQuestion.answers);
  }

  updateHUD();
}

/* ---------- Public ---------- */

export async function startQuizGame() {
  const enabledGrades = getEnabledGrades();
  if (!enabledGrades.length) {
    alert("Enable at least one grade in Settings.");
    setActiveTab("settings");
    return;
  }

  await ensureGradesLoaded(enabledGrades);
  state.pool = buildPoolForGrades(enabledGrades);
  if (state.pool.length < 6) {
    alert("Not enough kanji selected.");
    setActiveTab("settings");
    return;
  }

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
  document.getElementById("prompt")?.addEventListener("click", togglePeek);
}
