import { state, constants } from "./state.js";
import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import { rebuildWordIndexForGrades, getEligibleCompoundWords } from "./words.js";
import { getEnabledGrades, isCompoundEnabled } from "./settings.js";
import {
  renderBracketColored,
  setActiveTab,
  showGameOverModal
} from "./ui.js";

const MAX_HISTORY = 8;

/* ---------- utils ---------- */

function rand(n){ return Math.floor(Math.random() * n); }
function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- meaning images (single fixed location) ---------- */

function meaningImageUrl(kanjiChar){
  return `./images/meaning/${encodeURIComponent(kanjiChar)}.png`;
}

/* ---------- HUD ---------- */

function updateHUD(){
  document.getElementById("hudLives").textContent = `Lives: ${Math.max(0, state.lives)}`;
  document.getElementById("hudScore").textContent = `Score: ${state.score}`;
  document.getElementById("hudPeek").textContent  = `Sneak Peek: ${state.peekMode ? "on" : "off"}`;
}

function endGame(){
  state.locked = true;
  state.peekMode = false;
  state.gameActive = false;
  updateHUD();
  showGameOverModal(state.score);
}

function clearPromptClasses(){
  document.getElementById("prompt")?.classList.remove("correct", "wrong");
}

/* ---------- prompt ---------- */

function setPromptKanji(text){
  const inner = document.getElementById("promptInner");
  inner.innerHTML = "";
  const div = document.createElement("div");
  div.className = "kanjiText";
  div.textContent = text;
  inner.appendChild(div);
}

function setPromptKana(text){
  const inner = document.getElementById("promptInner");
  inner.innerHTML = "";
  const div = document.createElement("div");
  div.className = "kanaText";
  div.textContent = text;
  inner.appendChild(div);
}

/* ---------- history ---------- */

function ensureHistory(){
  if(!Array.isArray(state.history)) state.history = [];
}

function addHistoryEntry(entry){
  ensureHistory();
  state.history.unshift(entry);
  if(state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
  renderHistory();
}

function renderHistory(){
  const host = document.getElementById("historyList");
  if(!host) return;

  host.innerHTML = "";

  for(const h of state.history){
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

    row.addEventListener("click", () => {
      if(h.type === "compound"){
        window.__openWordDetail?.(h.wordMeta);
      } else {
        window.__openDictionaryWithQuery?.(h.dictQuery, true);
      }
    });

    host.appendChild(row);
  }
}

/* ---------- meaning choices ---------- */

function renderMeaningChoiceContent(btn, kanjiChar, fallbackText){
  const img = document.createElement("img");
  img.className = "meaningImg";
  img.alt = fallbackText;

  img.onerror = () => {
    img.remove();
    const div = document.createElement("div");
    div.className = "meaningFallback";

    const inner = document.createElement("div");
    inner.className = "fallbackRich";
    renderBracketColored(inner, fallbackText);

    div.appendChild(inner);
    btn.appendChild(div);
  };

  img.src = meaningImageUrl(kanjiChar);
  btn.appendChild(img);
}

function renderChoicesMeaning(options){
  const choicesEl = document.getElementById("choices");
  choicesEl.innerHTML = "";
  choicesEl.style.display = "grid";

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.dataset.kind = "meaning";
    btn.dataset.ok = opt.ok ? "1" : "0";
    btn.dataset.kanji = opt.kanji;

    renderMeaningChoiceContent(btn, opt.kanji, opt.meaning);
    btn.addEventListener("click", () => onChoiceClick(btn));
    choicesEl.appendChild(btn);
  });
}

/* ---------- compound choices ---------- */

function renderChoicesKanji(kanjiOptions){
  const choicesEl = document.getElementById("choices");
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

/* ---------- question generation ---------- */

function buildSingleQuestion(){
  const record = state.pool[rand(state.pool.length)];
  const others = state.pool.filter(k => k.id !== record.id);
  shuffle(others);
  const wrongs = others.slice(0, 3);

  return {
    type: "single",
    record,
    options: shuffle([
      { kanji: record.id, meaning: record.meaningKey, ok: true },
      ...wrongs.map(w => ({ kanji: w.id, meaning: w.meaningKey, ok: false }))
    ])
  };
}

function buildCompoundQuestion(eligibleWords){
  const w = eligibleWords[rand(eligibleWords.length)];
  const [k1, k2] = w.kanjiChars;

  const poolOthers = state.pool.map(x => x.id).filter(x => x !== k1 && x !== k2);
  shuffle(poolOthers);

  return {
    type: "compound",
    kana: w.kana,
    kanji: w.kanji,
    kanjiChars: w.kanjiChars,
    answers: shuffle([k1, k2, ...poolOthers.slice(0, 2)]),
    meta: w.meta || null
  };
}

async function pickNextQuestion(){
  if(!isCompoundEnabled()) return buildSingleQuestion();
  const eligible = getEligibleCompoundWords(state.pool);
  if(Math.random() < constants.COMPOUND_PROBABILITY && eligible.length){
    return buildCompoundQuestion(eligible);
  }
  return buildSingleQuestion();
}

/* ---------- lifecycle ---------- */

async function newQuestion(){
  if(state.lives <= 0){ endGame(); return; }

  state.locked = false;
  state.peekMode = false;
  state.peekChargedThisQuestion = false;
  state.compoundPicks = [];
  clearPromptClasses();

  state.currentQuestion = await pickNextQuestion();

  if(state.currentQuestion.type === "single"){
    setPromptKanji(state.currentQuestion.record.id);
    renderChoicesMeaning(state.currentQuestion.options);
  } else {
    setPromptKana(state.currentQuestion.kana);
    renderChoicesKanji(state.currentQuestion.answers);
  }

  updateHUD();
  renderHistory();
}

/* ---------- handlers (unchanged logic) ---------- */

function handleSingleAnswer(btn){
  state.locked = true;
  const promptEl = document.getElementById("prompt");
  const buttons = [...document.querySelectorAll("button.choice")];
  buttons.forEach(b => b.disabled = true);

  const ok = btn.dataset.ok === "1";
  if(ok){
    state.score += 1;
    btn.classList.add("correct");
    promptEl.classList.add("correct");
  } else {
    state.lives -= constants.COST_WRONG;
    btn.classList.add("wrong");
    promptEl.classList.add("wrong");
    buttons.find(b => b.dataset.ok === "1")?.classList.add("correct");
  }

  addHistoryEntry({
    type: "single",
    display: state.currentQuestion.record.id,
    ok,
    dictQuery: state.currentQuestion.record.id
  });

  updateHUD();
  setTimeout(() => state.lives <= 0 ? endGame() : newQuestion(), constants.PAUSE_AFTER_ANSWER_MS);
}

function evaluateCompoundSecondPick(){
  const q = state.currentQuestion;
  const correct = new Set(q.kanjiChars);
  const picked = new Set(state.compoundPicks);

  document.querySelectorAll("button.choice").forEach(b => {
    const k = b.dataset.kanji;
    b.classList.remove("selected","correct","wrong");
    if(correct.has(k)) b.classList.add("correct");
    else if(picked.has(k)) b.classList.add("wrong");
    b.disabled = true;
  });

  const promptEl = document.getElementById("prompt");
  const ok = q.kanjiChars.every(k => picked.has(k));
  if(ok){
    state.score += 1;
    promptEl.classList.add("correct");
  } else {
    state.lives -= constants.COST_WRONG;
    promptEl.classList.add("wrong");
  }

  addHistoryEntry({
    type: "compound",
    display: q.kana,
    ok,
    wordMeta: q.meta || { word: q.kanji, reading: q.kana }
  });

  updateHUD();
  setTimeout(() => state.lives <= 0 ? endGame() : newQuestion(), constants.PAUSE_AFTER_ANSWER_MS);
}

function handleCompoundPick(btn){
  if(state.locked) return;
  const k = btn.dataset.kanji;
  if(state.compoundPicks.includes(k)) return;

  state.compoundPicks.push(k);
  if(state.compoundPicks.length === 1){
    btn.classList.add("selected");
  } else {
    state.locked = true;
    evaluateCompoundSecondPick();
  }
}

function onChoiceClick(btn){
  if(state.peekMode || state.locked) return;
  state.currentQuestion.type === "single"
    ? handleSingleAnswer(btn)
    : handleCompoundPick(btn);
}

/* ---------- peek ---------- */

function togglePeek(){
  if(state.locked || !state.currentQuestion) return;

  state.peekMode = !state.peekMode;
  if(state.peekMode && !state.peekChargedThisQuestion){
    state.lives -= constants.COST_PEEK;
    state.peekChargedThisQuestion = true;
    if(state.lives <= 0){ endGame(); return; }
  }

  state.peekMode
    ? (state.currentQuestion.type === "single"
        ? renderPeekSingle(state.currentQuestion.record)
        : renderPeekCompound(state.currentQuestion))
    : newQuestion();
}

/* ---------- public ---------- */

export async function startQuizGame(){
  const enabledGrades = getEnabledGrades();
  if(!enabledGrades.length){
    alert("Enable at least one grade in Settings.");
    setActiveTab("settings");
    return;
  }

  await ensureGradesLoaded(enabledGrades);
  state.pool = buildPoolForGrades(enabledGrades);
  if(state.pool.length < 6){
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

export function wireGameUI(){
  document.getElementById("exitBtn")?.addEventListener("click", () => {
    state.gameActive = false;
    setActiveTab("home");
  });
  document.getElementById("prompt")?.addEventListener("click", togglePeek);
}
