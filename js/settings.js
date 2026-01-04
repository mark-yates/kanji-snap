import { state } from "./state.js";
import { GRADE_FILES } from "./data.js";

const SETTINGS_KEY = "kanjiSnap.settings.v9";

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
    .filter(g => state.settings.enabledGrades[g] && !!GRADE_FILES[g]);
}

export function getOverrideCount(){
  return Object.keys(state.settings.kanjiOverrides || {}).length;
}

export function isCompoundEnabled(){
  return !!state.settings.compoundEnabled;
}

/**
 * Effective enabled rule:
 * - if override exists => use it
 * - else => inherits grade checkbox
 */
export function isKanjiEnabled(kanjiId, grade){
  const ov = state.settings.kanjiOverrides?.[kanjiId];
  if(typeof ov === "boolean") return ov;
  return !!state.settings.enabledGrades[grade];
}

export function setKanjiOverride(kanjiId, value){
  if(!state.settings.kanjiOverrides) state.settings.kanjiOverrides = {};
  state.settings.kanjiOverrides[kanjiId] = !!value;
}

export function clearKanjiOverride(kanjiId){
  if(!state.settings.kanjiOverrides) return;
  delete state.settings.kanjiOverrides[kanjiId];
}

export function clearAllOverrides(){
  state.settings.kanjiOverrides = {};
}

export function initSettingsUI(onSettingsChanged){
  const chkG1 = document.getElementById("chkG1");
  const chkG2 = document.getElementById("chkG2");
  const chkG3 = document.getElementById("chkG3");
  const chkCompound = document.getElementById("chkCompound");

  const resetBtn = document.getElementById("resetSettingsBtn");
  const clearOverridesBtn = document.getElementById("clearOverridesBtn");
  const openPickerBtn = document.getElementById("openKanjiPickerBtn");

  function sync(){
    if(chkG1) chkG1.checked = !!state.settings.enabledGrades[1];
    if(chkG2) chkG2.checked = !!state.settings.enabledGrades[2];
    if(chkG3) chkG3.checked = !!state.settings.enabledGrades[3];
    if(chkCompound) chkCompound.checked = !!state.settings.compoundEnabled;
    updateOverridePill();
  }

  function updateOverridePill(){
    const pill = document.getElementById("overridePill");
    if(!pill) return;
    pill.textContent = `Overrides: ${getOverrideCount()}`;
  }

  chkG1?.addEventListener("change", () => { state.settings.enabledGrades[1]=chkG1.checked; saveSettings(); sync(); onSettingsChanged?.(); });
  chkG2?.addEventListener("change", () => { state.settings.enabledGrades[2]=chkG2.checked; saveSettings(); sync(); onSettingsChanged?.(); });
  chkG3?.addEventListener("change", () => { state.settings.enabledGrades[3]=chkG3.checked; saveSettings(); sync(); onSettingsChanged?.(); });

  chkCompound?.addEventListener("change", () => {
    state.settings.compoundEnabled = chkCompound.checked;
    saveSettings();
    sync();
    onSettingsChanged?.();
  });

  resetBtn?.addEventListener("click", () => {
    state.settings = structuredClone(DEFAULT_SETTINGS);
    saveSettings();
    sync();
    onSettingsChanged?.();
  });

  clearOverridesBtn?.addEventListener("click", () => {
    clearAllOverrides();
    saveSettings();
    sync();
    onSettingsChanged?.();
  });

  openPickerBtn?.addEventListener("click", () => {
    if(window.__openKanjiPicker) window.__openKanjiPicker();
  });

  sync();
}
