import { state } from "./state.js";
import { FILE_VERSION as GAME_VERSION } from "./game-quiz.js";
import { FILE_VERSION as SETTINGS_VERSION } from "./settings.js";
import { FILE_VERSION as DATA_VERSION } from "./data.js";
import { FILE_VERSION as WORDS_VERSION } from "./words.js";
import { FILE_VERSION as UI_VERSION } from "./ui.js";
import { FILE_VERSION as DEMO_VERSION } from "./demo.js";

export const FILE_VERSION = "1.40";

const RUNTIME_CACHE = "kanji-snap-runtime-v1";

/* -----------------------------------------------------------
   Helpers
----------------------------------------------------------- */

function q(id) {
  return /** @type {HTMLElement|null} */ (document.getElementById(id));
}

async function countCachedMeaningImages() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

async function listCacheNames() {
  try {
    return await caches.keys();
  } catch {
    return [];
  }
}

/* -----------------------------------------------------------
   Render
----------------------------------------------------------- */

export async function renderDebug() {
  const host = q("debugContent");
  if (!host) return;

  host.innerHTML = "";

  const cachedCount = await countCachedMeaningImages();
  const allCaches = await listCacheNames();

  const rows = [
    ["game-quiz.js", GAME_VERSION],
    ["settings.js", SETTINGS_VERSION],
    ["data.js", DATA_VERSION],
    ["words.js", WORDS_VERSION],
    ["ui.js", UI_VERSION],
    ["demo.js", DEMO_VERSION],
    ["debug.js", FILE_VERSION],

    ["Runtime cache name", RUNTIME_CACHE],
    ["Cached meaning images", String(cachedCount)],
    ["All cache names", allCaches.join(", ") || "(none)"],

    ["Pool size", String(state.pool?.length ?? 0)],
    ["History entries", String(state.history?.length ?? 0)],
    ["Game active", String(!!state.gameActive)],
  ];

  const grid = document.createElement("div");
  grid.className = "debugGrid";

  rows.forEach(([k, v]) => {
    const key = document.createElement("div");
    key.className = "debugKey";
    key.textContent = k;

    const val = document.createElement("div");
    val.className = "debugVal";
    val.textContent = v;

    grid.appendChild(key);
    grid.appendChild(val);
  });

  host.appendChild(grid);
}
