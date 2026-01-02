import { state, constants } from "./state.js";
import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import { getEnabledGrades } from "./settings.js";
import { meaningImgUrlForKanji, renderBracketColored, setActiveTab, showGameOverModal } from "./ui.js";

function rand(n){ return Math.floor(Math.random() * n); }
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j = rand(i+1);
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

function renderChoices(options){
  const choicesEl = document.getElementById("choices");
  choicesEl.innerHTML = "";
  choicesEl.style.display = "grid";

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    btn.dataset.ok = opt.ok ? "1" : "0";
    btn.dataset.kanji = opt.kanji;

    renderMeaningChoiceContent(btn, opt.kanji, opt.meaning);

    btn.addEventListener("click", () => choose(btn));
    choicesEl.appendChild(btn);
  });
}

function renderDictionaryTile(record){
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
    kk.className = "k";
    kk.textContent = k;
    const vv = document.createElement("div");
    vv.className = "v";
    vv.textContent = v;
    row.appendChild(kk);
    row.appendChild(vv);
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
  hint.textContent = "Tap the kanji tile again to return to the 4 choices.";

  tile.appendChild(header);
  tile.appendChild(rows);
  tile.appendChild(pre);
  tile.appendChild(hint);

  choicesEl.appendChild(tile);
}

function buildOptionsForCurrent(){
  const others = state.pool.filter(k => k.id !== state.current.id);
  shuffle(others);
  const wrongs = others.slice(0, 3);

  return shuffle([
    { kanji: state.current.id, meaning: state.current.meaningKey, ok: true },
    ...wrongs.map(w => ({ kanji: w.id, meaning: w.meaningKey, ok: false }))
  ]);
}

function newQuestion(){
  if(state.lives <= 0){
    endGame();
    return;
  }

  state.locked = false;
  state.peekMode = false;
  state.peekChargedThisQuestion = false;

  const promptEl = document.getElementById("prompt");
  promptEl.classList.remove("correct","wrong");

  state.current = state.pool[rand(state.pool.length)];
  document.getElementById("kanjiPrompt").textContent = state.current.id;

  state.currentOptions = buildOptionsForCurrent();
  renderChoices(state.currentOptions);
  updateHUD();
}

function choose(btn){
  if(state.locked) return;
  if(state.peekMode) return;
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
  setTimeout(newQuestion, constants.PAUSE_AFTER_ANSWER_MS);
}

function togglePeek(){
  if(!state.current) return;
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
    renderDictionaryTile(state.current);
  } else {
    renderChoices(state.currentOptions);
  }

  updateHUD();
}

export async function startMeaningGame(){
  const enabledGrades = getEnabledGrades();
  if(enabledGrades.length === 0){
    alert("Enable at least one grade in Settings.");
    setActiveTab("settings");
    return;
  }

  await ensureGradesLoaded(enabledGrades);
  state.pool = buildPoolForGrades(enabledGrades);

  if(state.pool.length < 4){
    alert("Not enough kanji in selected pool. Enable more grades.");
    setActiveTab("settings");
    return;
  }

  state.score = 0;
  state.lives = constants.START_LIVES;
  state.locked = false;
  state.peekMode = false;
  state.peekChargedThisQuestion = false;
  state.current = null;
  state.currentOptions = null;

  setActiveTab("game");
  updateHUD();
  newQuestion();
}

export function wireGameUI(){
  document.getElementById("exitBtn").addEventListener("click", () => {
    setActiveTab("home");
  });

  document.getElementById("skipBtn").addEventListener("click", () => {
    if(state.locked || state.peekMode) return;
    newQuestion();
  });

  document.getElementById("prompt").addEventListener("click", togglePeek);

  window.addEventListener("keydown", (e) => {
    const viewGame = document.getElementById("viewGame");
    if(!viewGame.classList.contains("active")) return;

    const overlay = document.getElementById("overlay");
    if(overlay.classList.contains("show")) return;

    if(e.key === " "){
      e.preventDefault();
      if(!state.locked && !state.peekMode) newQuestion();
      return;
    }
    if(e.key.toLowerCase() === "p"){
      togglePeek();
      return;
    }
    if(state.peekMode || state.locked) return;

    const n = Number(e.key);
    if(Number.isFinite(n) && n >= 1 && n <= 4){
      const btn = document.querySelectorAll("button.choice")[n-1];
      if(btn) btn.click();
    }
  });
}
