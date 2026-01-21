import { state } from "./state.js";
import { loadSettings, initSettingsUI } from "./settings.js";
import { startQuizGame, wireGameUI } from "./game-quiz.js";
import { setActiveTab } from "./ui.js";
import { ensureWordsLoaded } from "./words.js";

/* ---------------- Service Worker ---------------- */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const swUrl = new URL("./sw.js", location.href);
    const reg = await navigator.serviceWorker.register(swUrl.href);

    // If a newer SW is waiting, activate it immediately.
    if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });

    await navigator.serviceWorker.ready;
    // console.log("SW ready");
  } catch (err) {
    console.error("SW registration failed:", err);
  }
}

/* ---------------- UI Wiring (robust) ---------------- */

function wireStartGameButtons(wordsReadyPromise) {
  async function startGameSafely(e) {
    e?.preventDefault?.();

    try {
      await wordsReadyPromise;
    } catch (err) {
      console.error("Words dataset failed to load:", err);
      alert(
        "Could not load words dataset (words.v2.csv).\n\n" +
        (err?.message || String(err))
      );
      return;
    }

    startQuizGame();
  }

  // Preferred data attribute
  document.querySelectorAll('[data-action="start-quiz"]').forEach((el) => {
    el.addEventListener("click", startGameSafely);
  });

  // Common legacy IDs
  const ids = [
    "btnPlay","btnStart","btnStartGame","startBtn","startGameBtn",
    "playBtn","playGameBtn","startQuizBtn","btnStartQuiz"
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("click", startGameSafely);
  }
}

function wireTabButtons() {
  // Preferred data attribute
  document.querySelectorAll("[data-tab]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const tab = el.getAttribute("data-tab");
      if (tab) setActiveTab(tab);
    });
  });

  // Legacy IDs
  const map = [
    ["btnHome","home"],["btnSettings","settings"],
    ["btnDictionary","dictionary"],["btnGame","game"],
    ["tabHome","home"],["tabSettings","settings"],
    ["tabDictionary","dictionary"],["tabGame","game"]
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
  const err = document.getElementById("appErrorBox");
  err?.addEventListener("click", () => (err.style.display = "none"));
}

/* ---------------- App Init ---------------- */

async function initApp() {
  // Load settings into global state
  state.settings = loadSettings();

  // ✅ Build an absolute URL to avoid any PWA scope/relative-path weirdness
  const wordsUrl = new URL("./data/words.v2.csv", location.href).href;

  // Start loading words ASAP (but don't block initial UI paint)
  const wordsReady = ensureWordsLoaded(wordsUrl);

  // Initialize core modules
  initSettingsUI?.();
  wireGameUI?.();

  // Optional modules (don’t crash if the export name differs / file missing)
  try {
    const dict = await import("./dictionary.js");
    dict.initDictionaryUI?.();
  } catch (e) {
    // console.warn("dictionary.js not initialized:", e);
  }
  try {
    const picker = await import("./kanji-picker.js");
    picker.initKanjiPickerUI?.();
  } catch (e) {
    // console.warn("kanji-picker.js not initialized:", e);
  }

  // Wire navigation + actions
  wireTabButtons();
  wireStartGameButtons(wordsReady);
  wireGlobalDebugTap();

  // Default tab
  setActiveTab("home");
}

/* ---------------- Boot ---------------- */

(async () => {
  try {
    await registerServiceWorker();
    await initApp();
  } catch (e) {
    console.error("App init failed:", e);
    alert(`App init failed:\n${e?.message || e}`);
  }
})();
