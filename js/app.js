import { state } from "./state.js";
import { loadSettings, initSettingsUI } from "./settings.js";
import { startQuizGame, wireGameUI } from "./game-quiz.js";
import { initDictionaryUI } from "./dictionary.js";
import { initKanjiPickerUI } from "./kanji-picker.js";
import { setActiveTab } from "./ui.js";

/* ---------------- Service Worker ---------------- */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const swUrl = new URL("./sw.js", location.href);
    const reg = await navigator.serviceWorker.register(swUrl.href);

    // If a newer SW is waiting, activate it immediately.
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error("SW registration failed:", err);
  }
}

/* ---------------- UI Wiring (robust) ---------------- */

function wireStartGameButtons() {
  // Preferred: data-action="start-quiz"
  document.querySelectorAll('[data-action="start-quiz"]').forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      startQuizGame();
    });
  });

  // Common legacy IDs (covers most earlier versions)
  const ids = [
    "btnPlay",
    "btnStart",
    "btnStartGame",
    "startBtn",
    "startGameBtn",
    "playBtn",
    "playGameBtn",
    "startQuizBtn",
    "btnStartQuiz"
  ];

  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      startQuizGame();
    });
  }
}

function wireTabButtons() {
  // Preferred: data-tab="home|settings|dictionary|game"
  document.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = el.getAttribute("data-tab");
      if (tab) setActiveTab(tab);
    });
  });

  // Common legacy IDs
  const map = [
    ["btnHome", "home"],
    ["btnSettings", "settings"],
    ["btnDictionary", "dictionary"],
    ["btnGame", "game"],
    ["tabHome", "home"],
    ["tabSettings", "settings"],
    ["tabDictionary", "dictionary"],
    ["tabGame", "game"]
  ];

  for (const [id, tab] of map) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      setActiveTab(tab);
    });
  }
}

function wireGlobalDebugTap() {
  // Optional: if you have an on-screen error box, keep it dismissible
  const err = document.getElementById("appErrorBox");
  err?.addEventListener("click", () => (err.style.display = "none"));
}

/* ---------------- App Init ---------------- */

async function initApp() {
  // Load settings into global state
  state.settings = loadSettings();

  // Initialize modules (these should be no-ops if their DOM isn’t present)
  initSettingsUI?.();
  initDictionaryUI?.();
  initKanjiPickerUI?.();
  wireGameUI?.();

  // Wire navigation + actions
  wireTabButtons();
  wireStartGameButtons();
  wireGlobalDebugTap();

  // Default
  setActiveTab("home");
}

/* ---------------- Boot ---------------- */

(async () => {
  try {
    await registerServiceWorker();
    await initApp();
  } catch (e) {
    console.error("App init failed:", e);
    // Fail-safe visible error
    alert(`App init failed:\n${e?.message || e}`);
  }
})();
