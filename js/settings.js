import { state } from "./state.js";
import { ensureGradesLoaded } from "./data.js";

export const FILE_VERSION = "1.70";

const SETTINGS_KEY = "kanji_snap_settings_v2";
const DL_KEY = "kanji_snap_downloaded_grades_v1";
const RUNTIME_CACHE = "kanji-snap-runtime-v1";

/* ---------------- Defaults ---------------- */

export const DEFAULT_SETTINGS = {
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

    if (!obj.enabledGrades || typeof obj.enabledGrades !== "object") {
      obj.enabledGrades = structuredClone(DEFAULT_SETTINGS.enabledGrades);
    }
    if (!obj.kanjiOverrides || typeof obj.kanjiOverrides !== "object") {
      obj.kanjiOverrides = {};
    }
    if (typeof obj.compoundEnabled !== "boolean") {
      obj.compoundEnabled = DEFAULT_SETTINGS.compoundEnabled;
    }
    if (typeof obj.dragWordEnabled !== "boolean") {
      obj.dragWordEnabled = DEFAULT_SETTINGS.dragWordEnabled;
    }

    // backfill missing grade flags
    for (const g of Object.keys(DEFAULT_SETTINGS.enabledGrades)) {
      if (typeof obj.enabledGrades[g] !== "boolean") {
        obj.enabledGrades[g] = DEFAULT_SETTINGS.enabledGrades[g];
      }
    }

    return obj;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
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
 * Images are hosted under: ./images/meaning/cartoon/<KANJI>.webp
 * We add ?dl=1 so sw.js can cache the canonical (no-query) URL into RUNTIME_CACHE.
 */
function meaningUrlForDownload(kanjiChar) {
  const u = new URL(`./images/meaning/cartoon/${encodeURIComponent(kanjiChar)}.webp`, location.href);
  u.searchParams.set("dl", "1");
  return u.toString();
}

async function cacheGradeImages(grade, { onProgress } = {}) {
  await ensureGradesLoaded([grade]);

  const chars = [...state.kanjiById.values()]
    .filter((k) => k.grade === grade)
    .map((k) => k.id);

  const urls = chars.map(meaningUrlForDownload);

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

async function countCachedMeaningImages() {
  if (!("caches" in window)) return null;

  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const keys = await cache.keys();
    return keys.filter((req) => {
      const u = new URL(req.url);
      return u.pathname.includes("/images/meaning/cartoon/") && u.pathname.endsWith(".webp");
    }).length;
  } catch {
    return null;
  }
}

async function clearRuntimeMeaningImages() {
  if (!("caches" in window)) return;

  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();

  await Promise.all(
    keys.map(async (req) => {
      try {
        const u = new URL(req.url);
        if (u.pathname.includes("/images/meaning/cartoon/") && u.pathname.endsWith(".webp")) {
          await cache.delete(req);
        }
      } catch {
        // ignore malformed cache entries
      }
    })
  );
}

/* ---------------- Settings UI ---------------- */

function renderGradeControls(host, onChange) {
  if (!host) return;
  host.innerHTML = "";

  for (const g of [1, 2, 3]) {
    const row = document.createElement("div");
    row.className = "gradeLine";

    const label = document.createElement("label");
    label.className = "check";
    label.style.marginTop = "0";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.id = `gradeEnabled${g}`;
    chk.checked = !!state.settings.enabledGrades[g];

    chk.addEventListener("change", () => {
      state.settings.enabledGrades[g] = !!chk.checked;
      saveSettings();
      onChange?.();
    });

    label.appendChild(chk);
    label.appendChild(document.createTextNode(` Grade ${g}`));

    const right = document.createElement("span");
    right.className = "gradeRight";

    const pill = document.createElement("span");
    pill.className = "pill pillTiny";
    pill.textContent = isGradeDownloaded(g) ? "Downloaded" : "Not downloaded";

    right.appendChild(pill);

    row.appendChild(label);
    row.appendChild(right);
    host.appendChild(row);
  }
}

async function refreshImagesStatusPill() {
  const pill = document.getElementById("imagesStatusPill");
  if (!pill) return;

  const count = await countCachedMeaningImages();
  const downloaded = [...loadDownloadedGrades()].sort((a, b) => a - b);

  if (count == null) {
    pill.textContent = "Cached: N/A";
    return;
  }

  const gradesText = downloaded.length ? ` • Grades: ${downloaded.join(", ")}` : "";
  pill.textContent = `Cached: ${count} images${gradesText}`;
}

/**
 * Current HTML structure:
 * - #gradeList
 * - #downloadImagesBtn
 * - #clearImagesBtn
 * - #imagesStatusPill
 * - #compoundEnabled
 * - #dragWordEnabled
 */
export function initSettingsUI(onSettingsChanged) {
  const gradeList = document.getElementById("gradeList");

  const downloadImagesBtn = document.getElementById("downloadImagesBtn");
  const clearImagesBtn = document.getElementById("clearImagesBtn");
  const imagesStatusPill = document.getElementById("imagesStatusPill");

  const compoundEnabled = document.getElementById("compoundEnabled");
  const dragWordEnabled = document.getElementById("dragWordEnabled");

  function commit() {
    saveSettings();
    renderGradeControls(gradeList, commit);
    refreshImagesStatusPill();
    onSettingsChanged?.();
  }

  renderGradeControls(gradeList, commit);

  if (compoundEnabled instanceof HTMLInputElement) {
    compoundEnabled.checked = !!state.settings.compoundEnabled;
    compoundEnabled.addEventListener("change", () => {
      state.settings.compoundEnabled = !!compoundEnabled.checked;
      commit();
    });
  }

  if (dragWordEnabled instanceof HTMLInputElement) {
    dragWordEnabled.checked = !!state.settings.dragWordEnabled;
    dragWordEnabled.addEventListener("change", () => {
      state.settings.dragWordEnabled = !!dragWordEnabled.checked;
      commit();
    });
  }

  downloadImagesBtn?.addEventListener("click", async () => {
    const grades = getEnabledGrades();
    if (!grades.length) {
      alert("Enable at least one grade first.");
      return;
    }

    const originalText = downloadImagesBtn.textContent || "Download images";
    downloadImagesBtn.disabled = true;
    if (clearImagesBtn) clearImagesBtn.disabled = true;

    try {
      let grandTotal = 0;
      let grandOk = 0;
      let grandFail = 0;

      for (const g of grades) {
        if (imagesStatusPill) {
          imagesStatusPill.textContent = `Downloading Grade ${g}…`;
        }

        const result = await cacheGradeImages(g, {
          onProgress: ({ done, total, ok, fail }) => {
            if (imagesStatusPill) {
              imagesStatusPill.textContent = `Grade ${g}: ${done}/${total} (ok ${ok}, fail ${fail})`;
            }
          }
        });

        grandTotal += result.total;
        grandOk += result.ok;
        grandFail += result.fail;

        const set = loadDownloadedGrades();
        set.add(g);
        saveDownloadedGrades(set);
      }

      if (imagesStatusPill) {
        imagesStatusPill.textContent = `Downloaded ${grandOk}/${grandTotal}` + (grandFail ? ` (fail ${grandFail})` : "");
      }
    } catch (err) {
      console.error(err);
      if (imagesStatusPill) {
        imagesStatusPill.textContent = `Download failed: ${err?.message || err}`;
      }
    } finally {
      downloadImagesBtn.disabled = false;
      if (clearImagesBtn) clearImagesBtn.disabled = false;
      downloadImagesBtn.textContent = originalText;
      renderGradeControls(gradeList, commit);
      refreshImagesStatusPill();
    }
  });

  clearImagesBtn?.addEventListener("click", async () => {
    clearImagesBtn.disabled = true;
    if (downloadImagesBtn) downloadImagesBtn.disabled = true;

    try {
      await clearRuntimeMeaningImages();
      resetDownloadedGrades();
      if (imagesStatusPill) imagesStatusPill.textContent = "Cached: 0 images";
    } catch (err) {
      console.error(err);
      if (imagesStatusPill) {
        imagesStatusPill.textContent = `Clear failed: ${err?.message || err}`;
      }
    } finally {
      clearImagesBtn.disabled = false;
      if (downloadImagesBtn) downloadImagesBtn.disabled = false;
      renderGradeControls(gradeList, commit);
      refreshImagesStatusPill();
    }
  });

  // Initial status
  refreshImagesStatusPill();
}
