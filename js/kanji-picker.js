import { state } from "./state.js";
import { ensureGradesLoaded } from "./data.js";
import { setActiveTab } from "./ui.js";
import { isKanjiEnabled, hasKanjiOverride, setKanjiOverride, clearKanjiOverride, saveSettings, getOverrideCount } from "./settings.js";

export const FILE_VERSION = "1.63";

let WIRED = false;

function setStatus(text){
  const el = document.getElementById("kanjiPickerStatus");
  if(el) el.textContent = text;
}

function updateOverridePill(){
  const pill = document.getElementById("overridePill");
  if(pill) pill.textContent = `Overrides: ${getOverrideCount()}`;
}

function sortByKyoiku(a, b){
  const ai = a.raw?.kyoiku_index ?? 9999;
  const bi = b.raw?.kyoiku_index ?? 9999;
  if(ai !== bi) return ai - bi;
  return a.id.localeCompare(b.id);
}

function render(){
  const host = document.getElementById("kanjiGroups");
  if(!host) return;

  host.innerHTML = "";

  const grades = [1,2,3];
  for(const g of grades){
    const items = [...state.kanjiById.values()].filter(k => k.grade === g).sort(sortByKyoiku);

    const section = document.createElement("div");
    section.className = "settingsCard";

    const header = document.createElement("div");
    header.className = "row";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";

    const left = document.createElement("div");
    left.innerHTML = `<div class="sectionTitle">Grade ${g}</div><div class="muted">${items.length} kanji</div>`;

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    right.style.alignItems = "center";

    const btnAllOn = document.createElement("button");
    btnAllOn.type = "button";
    btnAllOn.className = "btn btnSmall";
    btnAllOn.textContent = "Select all";
    btnAllOn.addEventListener("click", () => {
      for(const k of items) setKanjiOverride(k.id, true);
      saveSettings();
      updateOverridePill();
      render();
    });

    const btnAllOff = document.createElement("button");
    btnAllOff.type = "button";
    btnAllOff.className = "btn btnSmall";
    btnAllOff.textContent = "Deselect all";
    btnAllOff.addEventListener("click", () => {
      for(const k of items) setKanjiOverride(k.id, false);
      saveSettings();
      updateOverridePill();
      render();
    });

    right.appendChild(btnAllOn);
    right.appendChild(btnAllOff);

    header.appendChild(left);
    header.appendChild(right);
    section.appendChild(header);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(8, 1fr)";
    grid.style.gap = "6px";
    grid.style.marginTop = "10px";

    for(const k of items){
      const enabled = isKanjiEnabled(k.id, k.grade);
      const overridden = hasKanjiOverride(k.id);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.style.minHeight = "56px";
      btn.style.borderRadius = "6px";

      // Show selection state clearly:
      // enabled => light green tint; disabled => light red tint
      btn.style.background = enabled ? "rgba(34,197,94,.18)" : "rgba(239,68,68,.18)";
      btn.style.border = overridden ? "2px solid rgba(233,238,252,.25)" : "1px solid rgba(233,238,252,.10)";

      const t = document.createElement("div");
      t.className = "choiceKanji";
      t.textContent = k.id;
      t.style.fontSize = "28px";
      btn.appendChild(t);

      btn.addEventListener("click", () => {
        const newVal = !enabled;
        setKanjiOverride(k.id, newVal);
        saveSettings();
        updateOverridePill();
        // update just this tile (fast) by rerendering whole section for now
        render();
      });

      grid.appendChild(btn);
    }

    section.appendChild(grid);
    host.appendChild(section);
  }
}

export function wireKanjiPickerUI(){
  if(WIRED) return;
  WIRED = true;

  // Define global opener used by Settings button
  window.__openKanjiPicker = async () => {
    setActiveTab("kanji");
    try{
      setStatus("Loading…");
      await ensureGradesLoaded([1,2,3]);
      setStatus("Ready");
      render();
    } catch (e){
      console.error(e);
      setStatus("ERROR loading kanji data");
    }
  };

  document.getElementById("kanjiPickerRefreshBtn")?.addEventListener("click", async () => {
    await window.__openKanjiPicker?.();
  });

  // If user directly taps the Kanji tab, open as well
  // (tab is wired in app.js, but this ensures we still work if not)
}

