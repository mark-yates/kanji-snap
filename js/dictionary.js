import { state } from "./state.js";
import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import { getEnabledGrades } from "./settings.js";
import { setActiveTab, el, addKV } from "./ui.js";

function normalizeQuery(q){
  return String(q ?? "").trim();
}

function matches(record, q){
  if(!q) return true;

  // basic search fields (expand later)
  const hay = [
    record.id,
    record.meaningKey,
    ...(record.on || []),
    ...(record.kun || []),
    record.raw?.label || "",
    record.raw?.meaning_hira || "",
  ].join(" ");

  return hay.includes(q);
}

function renderListItem(record, onSelect){
  const btn = el("button", "dictRowBtn");
  btn.type = "button";

  const top = el("div", "dictRowTop");

  const left = el("div", "dictRowKanji", record.id);
  const right = el("div", "dictRowMeta", `G${record.grade}`);

  top.appendChild(left);
  top.appendChild(right);

  const sub = el("div", "dictRowSub", record.meaningKey);

  btn.appendChild(top);
  btn.appendChild(sub);

  btn.addEventListener("click", () => onSelect(record));
  return btn;
}

function renderDetail(record){
  const empty = document.getElementById("dictEmpty");
  const detail = document.getElementById("dictDetail");
  empty.style.display = "none";
  detail.style.display = "";

  document.getElementById("dictBigKanji").textContent = record.id;

  const chips = document.getElementById("dictChips");
  chips.innerHTML = "";
  chips.appendChild(el("div", "chipLight", `Grade G${record.grade}`));
  if(record.on?.length) chips.appendChild(el("div", "chipLight", `音: ${record.on.join("、")}`));
  if(record.kun?.length) chips.appendChild(el("div", "chipLight", `訓: ${record.kun.join("、")}`));

  const rows = document.getElementById("dictRows");
  rows.innerHTML = "";
  addKV(rows, "Meaning", record.meaningKey);
  if(record.raw?.label) addKV(rows, "Label", String(record.raw.label));
  if(record.raw?.meaning_hira) addKV(rows, "meaning_hira", String(record.raw.meaning_hira));
  if(record.on?.length) addKV(rows, "onyomi", record.on.join("、"));
  if(record.kun?.length) addKV(rows, "kunyomi", record.kun.join("、"));

  document.getElementById("dictRaw").textContent = JSON.stringify(record.raw, null, 2);
}

export function wireDictionaryUI(){
  const searchEl = document.getElementById("dictSearch");
  const listEl = document.getElementById("dictList");
  const countEl = document.getElementById("dictCount");
  const statusPill = document.getElementById("dictStatusPill");

  let currentResults = [];

  async function refresh(){
    const enabledGrades = getEnabledGrades();
    if(enabledGrades.length === 0){
      statusPill.textContent = "Enable grades in Settings";
      listEl.innerHTML = "";
      countEl.textContent = "0 results";
      document.getElementById("dictEmpty").style.display = "";
      document.getElementById("dictDetail").style.display = "none";
      return;
    }

    statusPill.textContent = "Loading…";
    await ensureGradesLoaded(enabledGrades);

    const pool = buildPoolForGrades(enabledGrades);
    const q = normalizeQuery(searchEl.value);
    const q2 = q; // intentionally simple; kana/katakana normalization later

    currentResults = pool.filter(r => matches(r, q2));

    // If query looks like kanji and is 1 char, prefer exact-first
    if(q2.length === 1){
      currentResults.sort((a,b) => (a.id === q2 ? -1 : 0) - (b.id === q2 ? -1 : 0));
    }

    listEl.innerHTML = "";
    currentResults.forEach(rec => {
      listEl.appendChild(renderListItem(rec, renderDetail));
    });

    countEl.textContent = `${currentResults.length} results`;
    statusPill.textContent = `Grades: ${enabledGrades.map(g=>"G"+g).join("+")}`;

    // If exactly one result and the query is non-empty, auto-open it
    if(q2 && currentResults.length === 1){
      renderDetail(currentResults[0]);
    } else if(!document.getElementById("dictDetail").style.display || document.getElementById("dictDetail").style.display === "none"){
      // keep empty state
      document.getElementById("dictEmpty").style.display = "";
    }
  }

  // public hooks
  async function openDictionary(){
    setActiveTab("dictionary");
    searchEl.focus();
    await refresh();
  }

  // wire UI
  document.getElementById("dictBackBtn").addEventListener("click", () => setActiveTab("home"));
  document.getElementById("goDictionaryBtn")?.addEventListener("click", openDictionary);

  searchEl.addEventListener("input", () => refresh().catch(err => alert(String(err))));
  document.getElementById("dictClearBtn").addEventListener("click", () => {
    searchEl.value = "";
    refresh().catch(err => alert(String(err)));
    searchEl.focus();
  });

  // expose method via window for app.js (simple, no framework)
  window.__openDictionary = openDictionary;

  // initial status
  statusPill.textContent = "…";
  countEl.textContent = "0 results";
}
