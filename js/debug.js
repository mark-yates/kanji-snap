export const FILE_VERSION = "1.63";

import { state } from "./state.js";
import { getWordsAll } from "./words.js";

// Import FILE_VERSION from modules (no heavy side effects expected)
import { FILE_VERSION as STATE_VER } from "./state.js";
import { FILE_VERSION as UI_VER } from "./ui.js";
import { FILE_VERSION as SETTINGS_VER } from "./settings.js";
import { FILE_VERSION as DATA_VER } from "./data.js";
import { FILE_VERSION as GAME_VER } from "./game-quiz.js";
import { FILE_VERSION as WORDS_VER } from "./words.js";

const RUNTIME_CACHE = "kanji-snap-runtime-v1";

function setGrid(host, rows) {
  if (!host) return;
  host.innerHTML = "";
  for (const [k, v] of rows) {
    const kEl = document.createElement("div");
    kEl.className = "debugKey";
    kEl.textContent = k;

    const vEl = document.createElement("div");
    vEl.className = "debugVal";
    vEl.textContent = v;

    host.appendChild(kEl);
    host.appendChild(vEl);
  }
}

async function countCachedMeaningImages() {
  if (!("caches" in window)) return { count: null, note: "Cache API not available" };

  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const keys = await cache.keys();
    const count = keys.filter((req) => {
      const u = new URL(req.url);
      return u.pathname.includes("/images/meaning/cartoon/") && u.pathname.endsWith(".webp");
    }).length;

    return { count, note: "" };
  } catch (e) {
    return { count: null, note: `Cache read failed: ${e?.message || e}` };
  }
}

function getEnabledKanjiCount() {
  // Best-effort: state.pool is set when game is prepared
  if (Array.isArray(state.pool)) return state.pool.length;
  return null;
}

function getWordsCount() {
  const all = getWordsAll?.();
  if (!Array.isArray(all)) return null;
  return all.length;
}

export function initDebugUI({ appVersion } = {}) {
  const versionsHost = document.getElementById("debugVersions");
  const totalsHost = document.getElementById("debugTotals");
  const refreshBtn = document.getElementById("debugRefreshBtn");

  async function refresh() {
    const wordsCount = getWordsCount();
    const enabledKanjiCount = getEnabledKanjiCount();
    const img = await countCachedMeaningImages();

    setGrid(versionsHost, [
      ["app.js", appVersion ?? "(unknown)"],
      ["debug.js", FILE_VERSION],
      ["state.js", STATE_VER],
      ["ui.js", UI_VER],
      ["settings.js", SETTINGS_VER],
      ["data.js", DATA_VER],
      ["game-quiz.js", GAME_VER],
      ["words.js", WORDS_VER],
    ]);

    setGrid(totalsHost, [
      ["Words loaded", wordsCount == null ? "N/A" : String(wordsCount)],
      ["Enabled kanji (pool)", enabledKanjiCount == null ? "N/A (start a game once)" : String(enabledKanjiCount)],
      ["Meaning images cached", img.count == null ? `N/A (${img.note})` : String(img.count)],
      ["Runtime cache", RUNTIME_CACHE],
    ]);
  }

  refreshBtn?.addEventListener("click", refresh);

  // Refresh when Debug tab is opened (best effort)
  document.getElementById("tabDebug")?.addEventListener("click", () => {
    refresh();
  });

  // Initial render
  refresh();
}
