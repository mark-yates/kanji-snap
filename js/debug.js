export const FILE_VERSION = "1.64";

import { state } from "./state.js";

// versions
import { FILE_VERSION as STATE_VER } from "./state.js";
import { FILE_VERSION as UI_VER } from "./ui.js";
import { FILE_VERSION as SETTINGS_VER } from "./settings.js";
import { FILE_VERSION as DATA_VER } from "./data.js";
import { FILE_VERSION as GAME_VER } from "./game-quiz.js";
import { FILE_VERSION as WORDS_VER } from "./words.js";
import { FILE_VERSION as DEMO_VER } from "./demo.js";

// data + settings helpers
import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import { getEnabledGrades } from "./settings.js";

// words helpers
import { ensureWordsLoaded, getWordsAll, getEligibleDragWords } from "./words.js";

const RUNTIME_CACHE = "kanji-snap-runtime-v1";

function setRows(host, rows) {
  if (!host) return;

  // Override the CSS grid (which collapses into 1 column on small screens)
  host.innerHTML = "";
  host.style.display = "flex";
  host.style.flexDirection = "column";
  host.style.gap = "8px";
  host.style.marginTop = "10px";

  for (const [k, v] of rows) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.alignItems = "baseline";
    row.style.justifyContent = "space-between";
    row.style.gap = "12px";

    const kEl = document.createElement("div");
    kEl.className = "debugKey";
    kEl.textContent = k;
    kEl.style.flex = "1 1 auto";
    kEl.style.minWidth = "0";
    kEl.style.whiteSpace = "nowrap";
    kEl.style.overflow = "hidden";
    kEl.style.textOverflow = "ellipsis";

    const vEl = document.createElement("div");
    vEl.className = "debugVal";
    vEl.textContent = v;
    vEl.style.flex = "0 0 auto";
    vEl.style.whiteSpace = "nowrap";

    row.appendChild(kEl);
    row.appendChild(vEl);
    host.appendChild(row);
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

function getWordsCount() {
  const all = getWordsAll?.();
  if (!Array.isArray(all)) return null;
  return all.length;
}

async function computeEnabledPoolCount() {
  // Prefer the existing pool (if a game has been started once)
  if (Array.isArray(state.pool) && state.pool.length) return state.pool.length;

  // Otherwise compute it from settings (best effort)
  const grades = getEnabledGrades();
  if (!grades.length) return 0;

  await ensureGradesLoaded(grades);
  const tmpPool = buildPoolForGrades(grades);
  return tmpPool.length;
}

async function computeEligibleDragWordsCount() {
  const grades = getEnabledGrades();
  if (!grades.length) return null;

  // Build a pool from current settings even if the game hasn't been started.
  await ensureGradesLoaded(grades);
  const pool = buildPoolForGrades(grades);

  // Words must be loaded to compute eligibility.
  await ensureWordsLoaded();

  const eligible = getEligibleDragWords(pool);
  return Array.isArray(eligible) ? eligible.length : null;
}

export function initDebugUI({ appVersion } = {}) {
  const versionsHost = document.getElementById("debugVersions");
  const totalsHost = document.getElementById("debugTotals");
  const refreshBtn = document.getElementById("debugRefreshBtn");

  async function refresh() {
    // Try to ensure words are loaded so counts work (don’t hard-fail if offline)
    try {
      await ensureWordsLoaded();
    } catch {
      // ignore; we'll show N/A where needed
    }

    const wordsCount = getWordsCount();
    const enabledPoolCount = await (async () => {
      try { return await computeEnabledPoolCount(); } catch { return null; }
    })();
    const dragEligibleCount = await (async () => {
      try { return await computeEligibleDragWordsCount(); } catch { return null; }
    })();

    const img = await countCachedMeaningImages();

    setRows(versionsHost, [
      ["app.js", appVersion ?? "(unknown)"],
      ["debug.js", FILE_VERSION],
      ["state.js", STATE_VER],
      ["ui.js", UI_VER],
      ["settings.js", SETTINGS_VER],
      ["data.js", DATA_VER],
      ["game-quiz.js", GAME_VER],
      ["words.js", WORDS_VER],
      ["demo.js", DEMO_VER],
    ]);

    setRows(totalsHost, [
      ["Words loaded", wordsCount == null ? "N/A" : String(wordsCount)],
      ["Enabled kanji (pool)", enabledPoolCount == null ? "N/A" : String(enabledPoolCount)],
      ["Eligible drag words", dragEligibleCount == null ? "N/A" : String(dragEligibleCount)],
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
