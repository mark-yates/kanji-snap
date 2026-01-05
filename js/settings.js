import { state } from "./state.js";
import { ensureGradesLoaded } from "./data.js";

const SETTINGS_KEY = "kanjiSnap.settings.v12";
const DL_KEY = "kanjiSnap.downloadedGrades.v1";

// Must match sw.js runtime cache name
const RUNTIME_CACHE = "kanji-snap-runtime-v1";

export const DEFAULT_SETTINGS = {
  enabledGrades: { 1:true, 2:false, 3:false, 4:false, 5:false, 6:false },
  kanjiOverrides: {},
  compoundEnabled: true
};

export function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if(!raw) return structuredClone(DEFAULT_SETTINGS);

    const obj = JSON.parse(raw);
    obj.enabledGrades = obj.enabledGrades || structuredClone(DEFAULT_SETTINGS.enabledGrades);
    for(const g of Object.keys(DEFAULT_SETTINGS.enabledGrades)){
      if(typeof obj.enabledGrades[g] !== "boolean") obj.enabledGrades[g] = DEFAULT_SETTINGS.enabledGrades[g];
    }
    if(!obj.kanjiOverrides || typeof obj.kanjiOverrides !== "object") obj.kanjiOverrides = {};
    if(typeof obj.compoundEnabled !== "boolean") obj.compoundEnabled = true;
    return obj;
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  const savedPill = document.getElementById("savedPill");
  if(savedPill){
    savedPill.textContent = "Saved ✓";
    setTimeout(() => savedPill.textContent = "Saved", 900);
  }
}

export function getEnabledGrades(){
  return Object.keys(state.settings.enabledGrades)
    .map(Number)
    .filter(g => state.settings.enabledGrades[g] === true);
}

export function getOverrideCount(){
  return Object.keys(state.settings.kanjiOverrides || {}).length;
}

export function isCompoundEnabled(){
  return !!state.settings.compoundEnabled;
}

export function isKanjiEnabled(kanjiId, grade){
  const ov = state.settings?.kanjiOverrides?.[kanjiId];
  if(typeof ov === "boolean") return ov;
  return !!state.settings?.enabledGrades?.[grade];
}

export function clearAllOverrides(){
  state.settings.kanjiOverrides = {};
}

/* ---------------- Download tracking ---------------- */

function loadDownloadedGrades(){
  try{
    const raw = localStorage.getItem(DL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(Number) : []);
  } catch {
    return new Set();
  }
}

function saveDownloadedGrades(set){
  localStorage.setItem(DL_KEY, JSON.stringify([...set].sort((a,b)=>a-b)));
}

export function isGradeDownloaded(grade){
  return loadDownloadedGrades().has(Number(grade));
}

/* ---------------- Download logic ---------------- */

function meaningUrl(kanjiChar){
  return `./images/meaning/${encodeURIComponent(kanjiChar)}.png`;
}

async function cacheGradeImages(grade, { onProgress } = {}){
  // Ensure data is loaded so we know which kanji are in the grade
  await ensureGradesLoaded([grade]);

  // Read the grade file indirectly via the loaded kanji map
  const chars = [...state.kanjiById.values()]
    .filter(k => k.grade === grade)
    .map(k => k.id);

  const urls = chars.map(meaningUrl);

  const cache = await caches.open(RUNTIME_CACHE);

  // Batch fetch+put so we can tolerate missing images and show progress
  let done = 0;
  let ok = 0;
  let fail = 0;

  const CONCURRENCY = 6;
  let i = 0;

  async function worker(){
    while(i < urls.length){
      const idx = i++;
      const url = urls[idx];

      try{
        const res = await fetch(url, { cache: "no-store" });
        if(res.ok){
          await cache.put(url, res.clone());
          ok++;
        } else {
          fail++;
        }
      } catch {
        fail++;
      }

      done++;
      onProgress?.({ done, total: urls.length, ok, fail });
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  return { total: urls.length, ok, fail };
}

function setDlStatus(grade, text){
  const el = document.getElementById(`dlStatusG${grade}`);
  if(el) el.textContent = text;
}

function setDlButtonVisible(grade, visible){
  const btn = document.getElementById(`btnDlG${grade}`);
  if(btn) btn.style.display = visible ? "" : "none";
}

function refreshDownloadUI(){
  const set = loadDownloadedGrades();

  for(const g of [1,2,3]){
    if(set.has(g)){
      setDlStatus(g, "Downloaded");
      setDlButtonVisible(g, false);
    } else {
      setDlStatus(g, "Not downloaded");
      setDlButtonVisible(g, true);
    }
  }
}

export function initSettingsUI(onSettingsChanged){
  const chkG1 = document.getElementById("chkG1");
  const chkG2 = document.getElementById("chkG2");
  const chkG3 = document.getElementById("chkG3");
  const chkCompound = document.getElementById("chkCompound");

  const resetBtn = document.getElementById("resetSettingsBtn");
  const clearOverridesBtn = document.getElementById("clearOverridesBtn");
  const openPickerBtn = document.getElementById("openKanjiPickerBtn");

  function updateOverridePill(){
    const pill = document.getElementById("overridePill");
    if(pill) pill.textContent = `Overrides: ${getOverrideCount()}`;
  }

  function sync(){
    if(chkG1) chkG1.checked = !!state.settings.enabledGrades[1];
    if(chkG2) chkG2.checked = !!state.settings.enabledGrades[2];
    if(chkG3) chkG3.checked = !!state.settings.enabledGrades[3];
    if(chkCompound) chkCompound.checked = !!state.settings.compoundEnabled;
    updateOverridePill();
    refreshDownloadUI();
  }

  chkG1?.addEventListener("change", () => { state.settings.enabledGrades[1]=chkG1.checked; saveSettings(); sync(); onSettingsChanged?.(); });
  chkG2?.addEventListener("change", () => { state.settings.enabledGrades[2]=chkG2.checked; saveSettings(); sync(); onSettingsChanged?.(); });
  chkG3?.addEventListener("change", () => { state.settings.enabledGrades[3]=chkG3.checked; saveSettings(); sync(); onSettingsChanged?.(); });

  chkCompound?.addEventListener("change", () => {
    state.settings.compoundEnabled = chkCompound.checked;
    saveSettings(); sync(); onSettingsChanged?.();
  });

  resetBtn?.addEventListener("click", () => {
    state.settings = structuredClone(DEFAULT_SETTINGS);
    saveSettings(); sync(); onSettingsChanged?.();
  });

  clearOverridesBtn?.addEventListener("click", () => {
    clearAllOverrides();
    saveSettings(); sync(); onSettingsChanged?.();
  });

  openPickerBtn?.addEventListener("click", () => window.__openKanjiPicker?.());

  // Download buttons
  for(const g of [1,2,3]){
    document.getElementById(`btnDlG${g}`)?.addEventListener("click", async () => {
      const btn = document.getElementById(`btnDlG${g}`);
      if(btn) btn.disabled = true;

      setDlStatus(g, "Starting…");

      try{
        const result = await cacheGradeImages(g, {
          onProgress: ({ done, total, ok, fail }) => {
            setDlStatus(g, `Downloading ${done}/${total} (ok:${ok} fail:${fail})`);
          }
        });

        const set = loadDownloadedGrades();
        set.add(g);
        saveDownloadedGrades(set);

        setDlStatus(g, `Downloaded (ok:${result.ok} fail:${result.fail})`);
        setDlButtonVisible(g, false);
      } catch (e){
        setDlStatus(g, `ERROR`);
      } finally {
        if(btn) btn.disabled = false;
      }
    });
  }

  sync();
}
