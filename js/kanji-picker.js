import { ensureGradesLoaded, getKanjiForGradeSorted } from "./data.js";
import { getEnabledGrades, isKanjiEnabled, setKanjiOverride, clearKanjiOverride, saveSettings, getOverrideCount } from "./settings.js";
import { setActiveTab } from "./ui.js";

function updateStatus(){
  const pill = document.getElementById("kanjiPickerStatus");
  if(!pill) return;

  const enabledGrades = getEnabledGrades();
  pill.textContent = enabledGrades.length
    ? `Grades enabled: ${enabledGrades.map(g => "G" + g).join("+")} • Overrides: ${getOverrideCount()}`
    : `Grades enabled: none • Overrides: ${getOverrideCount()}`;
}

function renderKanjiButton(rec){
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "kanjiBtn";
  btn.textContent = rec.id;

  const effectiveOn = isKanjiEnabled(rec.id, rec.grade);
  btn.classList.add(effectiveOn ? "on" : "off");

  const ov = window.__settings?.kanjiOverrides?.[rec.id];
  if(typeof ov === "boolean") btn.classList.add("override");

  btn.addEventListener("click", () => {
    // Toggle behavior:
    // - if currently enabled => create/keep override false
    // - if currently disabled => create/keep override true
    const nowOn = isKanjiEnabled(rec.id, rec.grade);
    setKanjiOverride(rec.id, !nowOn);
    saveSettings();
    render(); // re-render to update styling
  });

  return btn;
}

function renderGroup(grade){
  const group = document.createElement("div");
  group.className = "kanjiGroup";

  const header = document.createElement("div");
  header.className = "kanjiGroupHeader";

  const title = document.createElement("div");
  title.className = "kanjiGroupTitle";
  title.textContent = `Grade ${grade}`;

  const sub = document.createElement("div");
  sub.className = "kanjiGroupSub";
  sub.textContent = "Tap to toggle • Blue dot = override";

  const left = document.createElement("div");
  left.appendChild(title);
  left.appendChild(sub);

  const actions = document.createElement("div");
  actions.className = "kanjiGroupActions";

  const selectAll = document.createElement("button");
  selectAll.type = "button";
  selectAll.className = "btn btnSmall";
  selectAll.textContent = "Select all";
  selectAll.addEventListener("click", () => {
    const list = getKanjiForGradeSorted(grade);
    for(const rec of list) setKanjiOverride(rec.id, true);
    saveSettings();
    render();
  });

  const selectNone = document.createElement("button");
  selectNone.type = "button";
  selectNone.className = "btn btnSmall";
  selectNone.textContent = "Select none";
  selectNone.addEventListener("click", () => {
    const list = getKanjiForGradeSorted(grade);
    for(const rec of list) setKanjiOverride(rec.id, false);
    saveSettings();
    render();
  });

  const clearOverrides = document.createElement("button");
  clearOverrides.type = "button";
  clearOverrides.className = "btn btnSmall";
  clearOverrides.textContent = "Clear overrides";
  clearOverrides.addEventListener("click", () => {
    const list = getKanjiForGradeSorted(grade);
    for(const rec of list) clearKanjiOverride(rec.id);
    saveSettings();
    render();
  });

  actions.appendChild(selectAll);
  actions.appendChild(selectNone);
  actions.appendChild(clearOverrides);

  header.appendChild(left);
  header.appendChild(actions);

  const grid = document.createElement("div");
  grid.className = "kanjiGrid";

  const list = getKanjiForGradeSorted(grade);
  for(const rec of list){
    grid.appendChild(renderKanjiButton(rec));
  }

  group.appendChild(header);
  group.appendChild(grid);
  return group;
}

export async function openKanjiPicker(){
  setActiveTab("kanji");

  // Store settings ref for quick override lookup in render
  // (kept simple for this draft)
  window.__settings = window.__settings || {};
  window.__settings.kanjiOverrides = (JSON.parse(localStorage.getItem("kanjiSnap.settings.v8")) || {}).kanjiOverrides || {};

  document.getElementById("kanjiPickerStatus").textContent = "Loading…";

  // Load all grades we have in the project (1–3 for now)
  await ensureGradesLoaded([1,2,3]);

  render();
}

export function wireKanjiPickerUI(){
  window.__openKanjiPicker = openKanjiPicker;

  document.getElementById("kanjiBackBtn")?.addEventListener("click", () => {
    setActiveTab("settings");
  });

  document.getElementById("kanjiPickerRefreshBtn")?.addEventListener("click", () => {
    render();
  });
}

function render(){
  updateStatus();

  // refresh cached overrides reference
  window.__settings = window.__settings || {};
  window.__settings.kanjiOverrides = (JSON.parse(localStorage.getItem("kanjiSnap.settings.v8")) || {}).kanjiOverrides || {};

  const host = document.getElementById("kanjiGroups");
  if(!host) return;

  host.innerHTML = "";
  host.appendChild(renderGroup(1));
  host.appendChild(renderGroup(2));
  host.appendChild(renderGroup(3));
}
