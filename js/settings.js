import { state } from "./state.js";
import { GRADE_FILES } from "./data.js";

const SETTINGS_KEY = "kanjiSnap.settings.v7";

export const DEFAULT_SETTINGS = {
  enabledGrades: { 1:true, 2:false, 3:false, 4:false, 5:false, 6:false }
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

export function initSettingsUI(onSettingsChanged){
  const chkG1 = document.getElementById("chkG1");
  const chkG2 = document.getElementById("chkG2");
  const chkG3 = document.getElementById("chkG3");
  const resetBtn = document.getElementById("resetSettingsBtn");

  function sync(){
    if(chkG1) chkG1.checked = !!state.settings.enabledGrades[1];
    if(chkG2) chkG2.checked = !!state.settings.enabledGrades[2];
    if(chkG3) chkG3.checked = !!state.settings.enabledGrades[3];
  }

  chkG1?.addEventListener("change", () => { state.settings.enabledGrades[1]=chkG1.checked; saveSettings(); onSettingsChanged?.(); });
  chkG2?.addEventListener("change", () => { state.settings.enabledGrades[2]=chkG2.checked; saveSettings(); onSettingsChanged?.(); });
  chkG3?.addEventListener("change", () => { state.settings.enabledGrades[3]=chkG3.checked; saveSettings(); onSettingsChanged?.(); });

  resetBtn?.addEventListener("click", () => {
    state.settings = structuredClone(DEFAULT_SETTINGS);
    saveSettings();
    sync();
    onSettingsChanged?.();
  });

  sync();
}
