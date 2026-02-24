import { state } from "./state.js";

import { FILE_VERSION as GAME_VERSION } from "./game-quiz.js";
import { FILE_VERSION as SETTINGS_VERSION } from "./settings.js";
import { FILE_VERSION as DATA_VERSION } from "./data.js";
import { FILE_VERSION as WORDS_VERSION } from "./words.js";
import { FILE_VERSION as UI_VERSION } from "./ui.js";
import { FILE_VERSION as DEMO_VERSION } from "./demo.js";

export const FILE_VERSION = "1.50";

/**
 * This is the cache used by the app code for meaning images.
 * (Your SW may also use its own cache name; we expose all cache names below.)
 */
const RUNTIME_CACHE = "kanji-snap-runtime-v1";

/* -----------------------------------------------------------
   Helpers
----------------------------------------------------------- */

function q(id) {
  return /** @type {HTMLElement|null} */ (document.getElementById(id));
}

/**
 * Find the container for the Versions panel, supporting a few historical IDs.
 */
function getVersionsHost() {
  return (
    q("debugVersions") ||
    q("versionsBox") ||
    q("debugVersionsBox") ||
    null
  );
}

/**
 * Find the container for the Totals panel, supporting a few historical IDs.
 */
function getTotalsHost() {
  return (
    q("debugTotals") ||
    q("totalsBox") ||
    q("debugTotalsBox") ||
    null
  );
}

function clear(el) {
  if (!el) return;
  el.innerHTML = "";
}

function addRow(host, key, value) {
  if (!host) return;

  const row = document.createElement("div");
  row.style.display = "grid";
  row.style.gridTemplateColumns = "1fr auto";
  row.style.gap = "10px";
  row.style.padding = "6px 0";
  row.style.borderBottom = "1px solid rgba(233,238,252,.08)";

  const k = document.createElement("div");
  k.style.color = "var(--muted)";
  k.style.fontWeight = "800";
  k.textContent = key;

  const v = document.createElement("div");
  v.style.color = "var(--text)";
  v.style.fontWeight = "700";
  v.style.textAlign = "right";
  v.style.wordBreak = "break-word";
  v.textContent = value;

  row.appendChild(k);
  row.appendChild(v);
  host.appendChild(row);
}

async function listCacheNames() {
  try {
    return await caches.keys();
  } catch {
    return [];
  }
}

async function countEntriesInCache(cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

/* -----------------------------------------------------------
   Public API
----------------------------------------------------------- */

/**
 * Keep the same exported entrypoint name the app expects.
 * (If your app calls renderDebug() instead, we export that too.)
 */
export async function initDebugUI() {
  await renderDebug();
}

export async function renderDebug() {
  const versionsHost = getVersionsHost();
  const totalsHost = getTotalsHost();

  // Fallback: some older layouts just have a single debugContent container.
  const fallbackHost = q("debugContent");

  // Clear whichever hosts exist
  clear(versionsHost);
  clear(totalsHost);
  clear(fallbackHost);

  const cacheNames = await listCacheNames();
  const runtimeCount = await countEntriesInCache(RUNTIME_CACHE);

  const versions = [
    ["game-quiz.js", GAME_VERSION],
    ["settings.js", SETTINGS_VERSION],
    ["data.js", DATA_VERSION],
    ["words.js", WORDS_VERSION],
    ["ui.js", UI_VERSION],
    ["demo.js", DEMO_VERSION],
    ["debug.js", FILE_VERSION],
  ];

  const totals = [
    ["Runtime cache", RUNTIME_CACHE],
    ["Runtime cache entries", String(runtimeCount)],
    ["All cache names", cacheNames.length ? cacheNames.join(", ") : "(none)"],
    ["Pool size", String(state.pool?.length ?? 0)],
    ["History entries", String(state.history?.length ?? 0)],
    ["Game active", String(!!state.gameActive)],
  ];

  // If the two hosts exist, populate them. Otherwise dump everything into fallbackHost.
  if (versionsHost && totalsHost) {
    for (const [k, v] of versions) addRow(versionsHost, k, v);
    for (const [k, v] of totals) addRow(totalsHost, k, v);

    // Remove bottom borders on last rows for neatness
    if (versionsHost.lastElementChild) versionsHost.lastElementChild.style.borderBottom = "none";
    if (totalsHost.lastElementChild) totalsHost.lastElementChild.style.borderBottom = "none";
    return;
  }

  // Fallback: write a single combined panel
  if (fallbackHost) {
    const h1 = document.createElement("div");
    h1.className = "sectionTitle";
    h1.textContent = "Versions";
    fallbackHost.appendChild(h1);

    for (const [k, v] of versions) addRow(fallbackHost, k, v);
    if (fallbackHost.lastElementChild) fallbackHost.lastElementChild.style.borderBottom = "none";

    const h2 = document.createElement("div");
    h2.className = "sectionTitle";
    h2.style.marginTop = "12px";
    h2.textContent = "Totals";
    fallbackHost.appendChild(h2);

    for (const [k, v] of totals) addRow(fallbackHost, k, v);
    if (fallbackHost.lastElementChild) fallbackHost.lastElementChild.style.borderBottom = "none";
    return;
  }

  // If we got here, we couldn't find any target containers.
  // Fail silently (debug UI layout probably changed).
  console.warn("debug.js: no debug containers found (expected #debugVersions/#debugTotals or #debugContent).");
}
