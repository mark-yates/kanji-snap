import { state, constants } from "./state.js";
import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import { rebuildWordIndexForGrades, getEligibleCompoundWords } from "./words.js";
import { getEnabledGrades } from "./settings.js";
import {
  meaningImgUrlForKanji,
  renderBracketColored,
  setActiveTab,
  showGameOverModal
} from "./ui.js";

function rand(n){ return Math.floor(Math.random() * n); }
function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function updateHUD(){
  document.getElementById("hudLives").textContent = `Lives: ${Math.max(0, state.lives)}`;
  document.getElementById("hudScore").textContent = `Score: ${state.score}`;
  document.getElementById("hudPeek").textContent  = `Sneak Peek: ${state.peekMode ? "on" : "off"}`;
}

function endGame(){
  state.locked = true;
  state.peekMode = false;
  updateHUD();
  showGameOverModal(state.score);
}

function clearPromptClasses(){
  const promptEl = document.getElementById("prompt");
  promptEl.classList.remove("correct", "wrong");
}

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

/* ---------- Rendering (meaning choices) ---------- */

function renderMeaningChoiceContent(btn, kanjiChar, fallbackText){
  const img = document.createElement("img");
  img.className = "meaningImg";
  img.alt = fallbackText;

  const fallback = () => {
    img.remove();
    const div = document.createElement("div");
    div.className = "meaningFallback";

    const inner = document.createElement("div");
    inner.className = "fallbackRich";
    renderBracketColored(inner, fallbackText);

    div.appendChild(inner);
    btn.appendChild(div);
  };

  img.onerror = fallback;
  img.src = meaningImgUrlForKanji(kanjiChar);
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

/* ---------- Rendering (kanji choices for compound) ---------- */

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

/* ---------- Peek tiles (single) ---------- */

function renderPeekSingle(record){
  const choicesEl = document.getElementById("choices");
  choicesEl.innerHTML = "";
  choicesEl.style.display = "block";

  const tile = document.createElement("div");
  tile.className = "dictTile";

  const header = document.createElement("div");
  header.className = "dictHeader";

  const big = document.createElement("div");
  big.className = "dictKanji";
  big.textContent = record.id;

  const chips = document.createElement("div");
  chips.className = "chips";
  const chipG = document.createElement("div");
  chipG.className = "chipLight";
  chipG.textContent = `Grade G${record.grade}`;
  chips.appendChild(chipG);

  header.appendChild(big);
  header.appendChild(chips);

  const rows = document.createElement("div");
  rows.className = "dictRows";

  const addKV = (k, v) => {
    const row = document.createElement("div");
    row.className = "rowKV";
    const kk = document.createElement("div");
    kk.className = "k"; kk.textContent = k;
    const vv = document.createElement("div");
    vv.className = "v"; vv.textContent = v;
    row.appendChild(kk); row.appendChild(vv);
    rows.appendChild(row);
  };

  if(record.on?.length) addKV("音読み", record.on.join("、"));
  if(record.kun?.length) addKV("訓読み", record.kun.join("、"));
  addKV("fallback", record.meaningKey);

  const pre = document.createElement("pre");
  pre.className = "mono";
  pre.textContent = JSON.stringify(record.raw, null, 2);

  const hint = document.createElement("div");
  hint.className = "muted";
  hint.style.marginTop = "8px";
  hint.textContent = "Tap the prompt tile again to return to the choices.";

  tile.appendChild(header);
  tile.appendChild(rows);
  tile.appendChild(pre);
  tile.appendChild(hint);

  choicesEl.appendChild(tile);
}

/* ---------- Peek tiles (compound) ---------- */

function renderPeekCompound(q){
  const choicesEl = document.getElementById("choices");
  choicesEl.innerHTML = "";
  choicesEl.style.display = "block";

  const tile = document.createElement("div");
  tile.className = "dictTile";

  const header = document.createElement("div");
  header.className = "dictHeader";

  const big = document.createElement("div");
  big.className = "dictKanji";
  big.textContent = q.kanji;

  const chips = document.createElement("div");
  chips.className = "chips";

  const chipKana = document.createElement("div");
  chipKana.className = "chipLight";
  chipKana.textContent = `かな: ${q.kana}`;
  chips.appendChild(chipKana);

  const eg = q.meta?.__effectiveGrade;
  if(Number.isFinite(Number(eg))){
    const chipG = document.createElement("div");
    chipG.className = "chipLight";
    chipG.textContent = `word grade: G${eg}`;
    chips.appendChild(chipG);
  }

  header.appendChild(big);
  header.appendChild(chips);

  const rows = document.createElement("div");
  rows.className = "dictRows";

  const addKV = (k, v) => {
    const row = document.createElement("div");
    row.className = "rowKV";
    const kk = document.createElement("div");
    kk.className = "k"; kk.textContent = k;
    const vv = document.createElement("div");
    vv.className = "v"; vv.textContent = v;
    row.appendChild(kk); row.appendChild(vv);
    rows.appendChild(row);
  };

  const [k1, k2] = q.kanjiChars;
  addKV("Kanji 1", k1);
  addKV("Kanji 2", k2);

  if(q.meta){
    if(q.meta.band != null) addKV("band", String(q.meta.band));
    if(q.meta.age_min != null) addKV("age_min", String(q.meta.age_min));
    if(q.meta.meaning_hira) addKV("meaning_hira", String(q.meta.meaning_hira));
    if(q.meta.meaning_en) addKV("meaning_en", String(q.meta.meaning_en));
  }

  const hint = document.createElement("div");
  hint.className = "muted";
  hint.style.marginTop = "8px";
  hint.textContent = "Tap the prompt tile again to return to the choices.";

  tile.appendChild(header);
  tile.appendChild(rows);
  tile.appendChild(hint);

  choicesEl.appendChild(tile);
}

/* ---------- Question generation ---------- */

function buildSingleQuestion(){
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

function buildCompoundQuestion(eligibleWords){
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

async function pickNextQuestion(){
  const eligible = getEligibleCompoundWords(state.pool);
  const wantCompound = (Math.random() < constants.COMPOUND_PROBABILITY) && eligible.length > 0;

  if(wantCompound) return buildCompoundQuestion(eligible);
  return buildSingleQuestion();
}

/* ---------- Question lifecycle ---------- */

async function newQuestion(){
  if(state.lives <= 0){
    endGame();
    return;
  }

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
}

function handleSingleAnswer(btn){
  state.locked = true;

  const promptEl = document.getElementById("prompt");
  const buttons = [...document.querySelectorAll("button.choice")];
  buttons.forEach(b => b.disabled = true);

  const isOk = btn.dataset.ok === "1";

  if(isOk){
    state.score += 1;
    btn.classList.add("correct");
    promptEl.classList.add("correct");
  } else {
    state.lives -= constants.COST_WRONG;
    btn.classList.add("wrong");
    promptEl.classList.add("wrong");

    const right = buttons.find(b => b.dataset.ok === "1");
    if(right) right.classList.add("correct");
  }

  updateHUD();

  if(state.lives <= 0){
    setTimeout(endGame, constants.PAUSE_ENDGAME_MS);
    return;
  }

  setTimeout(() => newQuestion().catch(()=>{}), constants.PAUSE_AFTER_ANSWER_MS);
}

function evaluateCompoundSecondPick(){
  const q = state.currentQuestion;

  const correctSet = new Set(q.kanjiChars);      // the two correct kanji
  const pickedSet = new Set(state.compoundPicks); // exactly two picks (second pick triggers evaluation)

  const allCorrectPicked =
    q.kanjiChars.every(k => pickedSet.has(k)) && pickedSet.size === 2;

  const buttons = [...document.querySelectorAll("button.choice")];

  // NEW RULE:
  // - correct answers: always green (even if not selected)
  // - incorrect answers: red ONLY if the user selected them
  for(const b of buttons){
    const k = b.dataset.kanji;
    b.classList.remove("selected", "correct", "wrong");

    if(correctSet.has(k)){
      b.classList.add("correct");
    } else if(pickedSet.has(k)){
      b.classList.add("wrong");
    }
    b.disabled = true;
  }

  const promptEl = document.getElementById("prompt");
  if(allCorrectPicked){
    state.score += 1;
    promptEl.classList.add("correct");
  } else {
    state.lives -= constants.COST_WRONG;
    promptEl.classList.add("wrong");
  }

  updateHUD();

  if(state.lives <= 0){
    setTimeout(endGame, constants.PAUSE_ENDGAME_MS);
    return;
  }

  setTimeout(() => newQuestion().catch(()=>{}), constants.PAUSE_AFTER_ANSWER_MS);
}

function handleCompoundPick(btn){
  if(state.locked) return;

  const k = btn.dataset.kanji;
  if(state.compoundPicks.includes(k)) return;

  state.compoundPicks.push(k);

  if(state.compoundPicks.length === 1){
    btn.classList.add("selected"); // blue overlay
    return;
  }

  state.locked = true;
  evaluateCompoundSecondPick();
}

function onChoiceClick(btn){
  if(state.peekMode) return;
  if(state.locked) return;

  const q = state.currentQuestion;
  if(!q) return;

  if(q.type === "single") handleSingleAnswer(btn);
  else handleCompoundPick(btn);
}

/* ---------- Peek toggle ---------- */

function togglePeek(){
  if(!state.currentQuestion) return;
  if(state.locked) return;

  state.peekMode = !state.peekMode;

  if(state.peekMode){
    if(!state.peekChargedThisQuestion){
      state.lives -= constants.COST_PEEK;
      state.peekChargedThisQuestion = true;
      updateHUD();
      if(state.lives <= 0){
        endGame();
        return;
      }
    }

    if(state.currentQuestion.type === "single") renderPeekSingle(state.currentQuestion.record);
    else renderPeekCompound(state.currentQuestion);
  } else {
    if(state.currentQuestion.type === "single"){
      renderChoicesMeaning(state.currentQuestion.options);
    } else {
      renderChoicesKanji(state.currentQuestion.answers);

      // Restore blue selection if the user already made the first pick
      if(state.compoundPicks.length === 1){
        const picked = state.compoundPicks[0];
        const btns = [...document.querySelectorAll("button.choice")];
        const found = btns.find(b => b.dataset.kanji === picked);
        if(found) found.classList.add("selected");
      }
    }
  }

  updateHUD();
}

/* ---------- Public API ---------- */

export async function startQuizGame(){
  const enabledGrades = getEnabledGrades();
  if(enabledGrades.length === 0){
    alert("Enable at least one grade in Settings.");
    setActiveTab("settings");
    return;
  }

  await ensureGradesLoaded(enabledGrades);
  state.pool = buildPoolForGrades(enabledGrades);

  if(state.pool.length < 6){
    alert("Not enough kanji in selected pool. Enable more grades.");
    setActiveTab("settings");
    return;
  }

  rebuildWordIndexForGrades(enabledGrades);

  state.score = 0;
  state.lives = constants.START_LIVES;
  state.locked = false;
  state.peekMode = false;
  state.peekChargedThisQuestion = false;
  state.currentQuestion = null;
  state.compoundPicks = [];

  setActiveTab("game");
  updateHUD();
  await newQuestion();
}

export function wireGameUI(){
  document.getElementById("exitBtn")?.addEventListener("click", () => {
    setActiveTab("home");
  });

  document.getElementById("skipBtn")?.addEventListener("click", () => {
    if(state.locked || state.peekMode) return;
    newQuestion().catch(err => alert(String(err)));
  });

  document.getElementById("prompt")?.addEventListener("click", () => togglePeek());

  window.addEventListener("keydown", (e) => {
    const viewGame = document.getElementById("viewGame");
    if(!viewGame?.classList.contains("active")) return;

    const overlay = document.getElementById("overlay");
    if(overlay?.classList.contains("show")) return;

    if(e.key === " "){
      e.preventDefault();
      if(!state.locked && !state.peekMode) newQuestion().catch(() => {});
      return;
    }

    if(e.key.toLowerCase() === "p"){
      togglePeek();
      return;
    }

    if(state.peekMode || state.locked) return;

    const n = Number(e.key);
    if(Number.isFinite(n) && n >= 1 && n <= 4){
      const btn = document.querySelectorAll("button.choice")[n - 1];
      if(btn) btn.click();
    }
  });
}
