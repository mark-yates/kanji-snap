import { state } from "./state.js";
import { ensureGradesLoaded } from "./data.js";

export const FILE_VERSION = "1.66";

const SETTINGS_KEY = "kanji_snap_settings_v2";
const DL_KEY = "kanji_snap_downloaded_grades_v1";
const RUNTIME_CACHE = "kanji-snap-runtime-v1";

/* ---------------- Defaults ---------------- */

const DEFAULT_SETTINGS = {
  enabledGrades: { 1: true, 2: true, 3: true },
  kanjiOverrides: {},

  compoundEnabled: true,
  dragWordEnabled: true,
};

/* ---------------- Load/Save ---------------- */

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);

    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return structuredClone(DEFAULT_SETTINGS);

    // Backfill defaults
    if (!obj.enabledGrades) obj.enabledGrades = structuredClone(DEFAULT_SETTINGS.enabledGrades);
    if (!obj.kanjiOverrides) obj.kanjiOverrides = {};
    if (typeof obj.compoundEnabled !== "boolean") obj.compoundEnabled = DEFAULT_SETTINGS.compoundEnabled;
    if (typeof obj.dragWordEnabled !== "boolean") obj.dragWordEnabled = DEFAULT_SETTINGS.dragWordEnabled;

    return obj;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  const savedPill = document.getElementById("savedPill");
  if (savedPill) {
    savedPill.textContent = "Saved ✓";
    setTimeout(() => (savedPill.textContent = "Saved"), 900);
  }
}

export function getEnabledGrades() {
  return Object.keys(state.settings.enabledGrades)
    .map(Number)
    .filter((g) => state.settings.enabledGrades[g] === true);
}

export function getOverrideCount() {
  return Object.keys(state.settings.kanjiOverrides || {}).length;
}

export function isCompoundEnabled() {
  return !!state.settings.compoundEnabled;
}

export function isDragWordEnabled() {
  return !!state.settings.dragWordEnabled;
}

export function hasKanjiOverride(kanjiId) {
  return typeof state.settings?.kanjiOverrides?.[kanjiId] === "boolean";
}

export function setKanjiOverride(kanjiId, value) {
  if (!state.settings.kanjiOverrides) state.settings.kanjiOverrides = {};
  state.settings.kanjiOverrides[kanjiId] = !!value;
}

export function clearKanjiOverride(kanjiId) {
  if (!state.settings.kanjiOverrides) return;
  delete state.settings.kanjiOverrides[kanjiId];
}

export function isKanjiEnabled(kanjiId, grade) {
  const ov = state.settings?.kanjiOverrides?.[kanjiId];
  if (typeof ov === "boolean") return ov;
  return !!state.settings?.enabledGrades?.[grade];
}

export function clearAllOverrides() {
  state.settings.kanjiOverrides = {};
}

/* ---------------- Download tracking ---------------- */

function loadDownloadedGrades() {
  try {
    const raw = localStorage.getItem(DL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(Number) : []);
  } catch {
    return new Set();
  }
}

function saveDownloadedGrades(set) {
  localStorage.setItem(DL_KEY, JSON.stringify([...set].sort((a, b) => a - b)));
}

export function resetDownloadedGrades() {
  localStorage.removeItem(DL_KEY);
}

export function isGradeDownloaded(grade) {
  return loadDownloadedGrades().has(Number(grade));
}

/* ---------------- Download logic ---------------- */

/**
 * IMPORTANT:
 * - Images are hosted under: ./images/meaning/cartoon/<KANJI>.webp
 * - We add ?dl=1 so sw.js can allow network + cache the canonical (no-query) URL
 * - We build an absolute URL using location.href so it works on GitHub Pages subpaths.
 */
function meaningUrlForDownload(kanjiChar) {
  const u = new URL(`./images/meaning/cartoon/${encodeURIComponent(kanjiChar)}.webp`, location.href);
  u.searchParams.set("dl", "1");
  return u.toString();
}

async function cacheGradeImages(grade, { onProgress } = {}) {
  await ensureGradesLoaded([grade]);

  // ✅ FIX: correctly iterate kanji entries (not an iterator wrapped in an array)
  const chars = [...state.kanjiById.values()]
    .filter((k) => k.grade === grade)
    .map((k) => k.id);

  const urls = chars.map(meaningUrlForDownload);

  // Ensure cache exists (SW writes into this during dl=1 fetches)
  await caches.open(RUNTIME_CACHE);

  let done = 0;
  let ok = 0;
  let fail = 0;

  const CONCURRENCY = 6;
  let i = 0;

  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const url = urls[idx];

      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) ok++;
        else fail++;
      } catch {
        fail++;
      }

      done++;
      onProgress?.({ done, total: urls.length, ok, fail });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { total: urls.length, ok, fail };
}

function setDlStatus(grade, text) {
  const el = document.getElementById(`dlStatusG${grade}`);
  if (el) el.textContent = text;
}

function setDlButtonVisible(grade, visible) {
  const btn = document.getElementById(`btnDlG${grade}`);
  if (btn) btn.style.display = visible ? "" : "none";
}

function refreshDownloadUI() {
  const set = loadDownloadedGrades();

  for (const g of [1, 2, 3]) {
    const btn = document.getElementById(`btnDlG${g}`);
    if (set.has(g)) {
      setDlStatus(g, "Downloaded");
      setDlButtonVisible(g, false);
    } else {
      setDlStatus(g, "Not downloaded");
      setDlButtonVisible(g, true);
      if (btn) btn.disabled = false;
    }
  }
}

/* ---------------- UI wiring ---------------- */

export function initSettingsUI(onSettingsChanged) {
  const chkG1 = document.getElementById("chkG1");
  const chkG2 = document.getElementById("chkG2");
  const chkG3 = document.getElementById("chkG3");
  const chkCompound = document.getElementById("chkCompound");
  const chkDragWords = document.getElementById("chkDragWords");
  const btnClearOverrides = document.getElementById("btnClearOverrides");
  const btnResetDownloads = document.getElementById("btnResetDownloads");

  function syncFromState() {
    if (chkG1) chkG1.checked = !!state.settings.enabledGrades[1];
    if (chkG2) chkG2.checked = !!state.settings.enabledGrades[2];
    if (chkG3) chkG3.checked = !!state.settings.enabledGrades[3];

    if (chkCompound) chkCompound.checked = !!state.settings.compoundEnabled;
    if (chkDragWords) chkDragWords.checked = !!state.settings.dragWordEnabled;

    const ov = document.getElementById("overrideCount");
    if (ov) ov.textContent = String(getOverrideCount());

    refreshDownloadUI();
  }

  function commit() {
    saveSettings();
    onSettingsChanged?.();
    syncFromState();
  }

  chkG1?.addEventListener("change", () => {
    state.settings.enabledGrades[1] = !!chkG1.checked;
    commit();
  });
  chkG2?.addEventListener("change", () => {
    state.settings.enabledGrades[2] = !!chkG2.checked;
    commit();
  });
  chkG3?.addEventListener("change", () => {
    state.settings.enabledGrades[3] = !!chkG3.checked;
    commit();
  });

  chkCompound?.addEventListener("change", () => {
    state.settings.compoundEnabled = !!chkCompound.checked;
    commit();
  });

  chkDragWords?.addEventListener("change", () => {
    state.settings.dragWordEnabled = !!chkDragWords.checked;
    commit();
  });

  btnClearOverrides?.addEventListener("click", () => {
    clearAllOverrides();
    commit();
  });

  btnResetDownloads?.addEventListener("click", () => {
    resetDownloadedGrades();
    refreshDownloadUI();
  });

  // Download buttons
  for (const g of [1, 2, 3]) {
    const btn = document.getElementById(`btnDlG${g}`);
    if (!btn) continue;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      setDlStatus(g, "Downloading…");

      try {
        const result = await cacheGradeImages(g, {
          onProgress: ({ done, total, ok, fail }) => {
            setDlStatus(g, `Downloading… ${done}/${total} (ok ${ok}, fail ${fail})`);
          }
        });

        const set = loadDownloadedGrades();
        set.add(g);
        saveDownloadedGrades(set);

        setDlStatus(g, `Downloaded (${result.ok}/${result.total})`);
        setDlButtonVisible(g, false);
      } catch (err) {
        console.error(err);
        setDlStatus(g, "Failed (see console)");
        btn.disabled = false;
      }
    });
  }

  // Initial render
  syncFromState();
}
