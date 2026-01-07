import { state } from "./state.js";
import { loadSettings } from "./settings.js";
import { initSettingsUI } from "./settings.js";
import { startQuizGame, wireGameUI } from "./game-quiz.js";
import { initDictionaryUI } from "./dictionary.js";
import { initKanjiPickerUI } from "./kanji-picker.js";
import { setActiveTab } from "./ui.js";

/* ---------------- Service Worker ---------------- */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const swUrl = new URL("./sw.js", location.href);

    const reg = await navigator.serviceWorker.register(swUrl.href, {
      scope: swUrl.pathname.replace(/sw\.js$/, "")
    });

    // If a newer SW is waiting, activate it immediately
    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    // Wait until the SW is ready and controlling
    await navigator.serviceWorker.ready;

    console.log("Service worker registered and ready");
  } catch (err) {
    console.error("Service worker registration failed:", err);
  }
}

/* ---------------- App Init ---------------- */

async function initApp() {
  // Load persisted settings
  state.settings = loadSettings();

  // Wire UI modules
  initSettingsUI();
  initDictionaryUI();
  initKanjiPickerUI();
  wireGameUI();

  // Navigation buttons
  document.getElementById("btnPlay")?.addEventListener("click", startQuizGame);
  document.getElementById("btnHome")?.addEventListener("click", () => setActiveTab("home"));
  document.getElementById("btnSettings")?.addEventListener("click", () => setActiveTab("settings"));
  document.getElementById("btnDictionary")?.addEventListener("click", () => setActiveTab("dictionary"));

  // Default tab
  setActiveTab("home");
}

/* ---------------- Boot ---------------- */

(async () => {
  await registerServiceWorker();
  await initApp();
})();
