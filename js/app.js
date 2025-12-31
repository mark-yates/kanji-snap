import { state } from "./state.js";
import { registerServiceWorker, setActiveTab, hideGameOverModal } from "./ui.js";
import { loadSettings, initSettingsUI, getEnabledGrades } from "./settings.js";
import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import { startMeaningGame, wireGameUI } from "./game-meaning.js";
import { wireDictionaryUI } from "./dictionary.js";

function updateHomePill(){
  const enabled = getEnabledGrades();
  const homePill = document.getElementById("homePill");
  homePill.textContent = enabled.length
    ? `Active grades: ${enabled.map(g=>"G"+g).join("+")}`
    : "Active grades: none";
}

async function warmLoadForUX(){
  // Optional: preload grade 1 if enabled (makes first dictionary/game feel instant)
  const enabled = getEnabledGrades();
  if(enabled.includes(1)){
    await ensureGradesLoaded([1]);
    // not building pool here; just caching data
    buildPoolForGrades(enabled);
  }
}

function wireTabs(){
  document.getElementById("tabHome").addEventListener("click", () => setActiveTab("home"));
  document.getElementById("tabSettings").addEventListener("click", () => setActiveTab("settings"));
  document.getElementById("tabDictionary").addEventListener("click", () => setActiveTab("dictionary"));
  document.getElementById("tabGame").addEventListener("click", () => setActiveTab("game"));

  document.getElementById("goSettingsBtn").addEventListener("click", () => setActiveTab("settings"));
  document.getElementById("backHomeBtn").addEventListener("click", () => setActiveTab("home"));
}

function wireHome(){
  document.getElementById("startBtn").addEventListener("click", () => {
    startMeaningGame().catch(err => alert(String(err)));
  });

  document.getElementById("goDictionaryBtn").addEventListener("click", () => {
    if(window.__openDictionary) window.__openDictionary();
    else setActiveTab("dictionary");
  });
}

function wireModal(){
  document.getElementById("gameOverOk").addEventListener("click", () => {
    hideGameOverModal();
    setActiveTab("home");
  });
}

async function onSettingsChanged(){
  updateHomePill();
  // If dictionary is open, refresh by re-opening (simple).
  const viewDict = document.getElementById("viewDictionary");
  if(viewDict.classList.contains("active") && window.__openDictionary){
    await window.__openDictionary();
  }
}

(async function main(){
  registerServiceWorker();

  state.settings = loadSettings();

  wireTabs();
  wireHome();
  wireGameUI();
  wireDictionaryUI();
  wireModal();

  initSettingsUI(onSettingsChanged);
  updateHomePill();

  setActiveTab("home");
  await warmLoadForUX().catch(() => {});
})();
