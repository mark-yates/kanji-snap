import { constants } from "./state.js";

export function registerServiceWorker(){
  if(!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

export function setActiveTab(which){
  const tabHome = document.getElementById("tabHome");
  const tabSettings = document.getElementById("tabSettings");
  const tabDictionary = document.getElementById("tabDictionary");
  const tabKanji = document.getElementById("tabKanji");           // NEW
  const tabGame = document.getElementById("tabGame");

  const viewHome = document.getElementById("viewHome");
  const viewSettings = document.getElementById("viewSettings");
  const viewDictionary = document.getElementById("viewDictionary");
  const viewKanji = document.getElementById("viewKanji");          // NEW
  const viewGame = document.getElementById("viewGame");

  tabHome?.classList.toggle("active", which === "home");
  tabSettings?.classList.toggle("active", which === "settings");
  tabDictionary?.classList.toggle("active", which === "dictionary");
  tabKanji?.classList.toggle("active", which === "kanji");         // NEW
  tabGame?.classList.toggle("active", which === "game");

  viewHome?.classList.toggle("active", which === "home");
  viewSettings?.classList.toggle("active", which === "settings");
  viewDictionary?.classList.toggle("active", which === "dictionary");
  viewKanji?.classList.toggle("active", which === "kanji");        // NEW
  viewGame?.classList.toggle("active", which === "game");

  // Only show the Game tab button when actually in the game view
  if(tabGame){
    tabGame.style.display = (which === "game") ? "" : "none";
  }
}

export function showGameOverModal(finalScore){
  const overlay = document.getElementById("overlay");
  const gameOverText = document.getElementById("gameOverText");
  if(gameOverText) gameOverText.textContent = `Final score: ${finalScore}`;
  overlay?.classList.add("show");
}

export function hideGameOverModal(){
  document.getElementById("overlay")?.classList.remove("show");
}

export function meaningImgUrlForKanji(kanjiChar){
  return constants.MEANING_IMG_DIR + encodeURIComponent(kanjiChar) + ".png";
}

/**
 * Bracket coloring rule:
 * - If no '[' anywhere -> render everything black
 * - If brackets exist -> inside [...] black, outside 50% grey
 */
export function renderBracketColored(container, s){
  container.innerHTML = "";
  const str = String(s ?? "");

  if(!str.includes("[")){
    const span = document.createElement("span");
    span.className = "fg-strong";
    span.textContent = str;
    container.appendChild(span);
    return;
  }

  const tokens = str.match(/\[[^\]]*\]|[^\[]+/g) || [str];
  for(const t of tokens){
    if(t.startsWith("[") && t.endsWith("]")){
      const span = document.createElement("span");
      span.className = "fg-strong";
      span.textContent = t.slice(1, -1);
      container.appendChild(span);
    } else {
      const span = document.createElement("span");
      span.className = "fg-dim";
      span.textContent = t;
      container.appendChild(span);
    }
  }
}

export function el(tag, className, text){
  const node = document.createElement(tag);
  if(className) node.className = className;
  if(text !== undefined) node.textContent = text;
  return node;
}

export function addKV(container, key, value){
  const row = el("div", "rowKV");
  row.appendChild(el("div", "k", key));
  const v = el("div", "v");
  v.textContent = value;
  row.appendChild(v);
  container.appendChild(row);
}
