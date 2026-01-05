import { state } from "./state.js";
import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import { getEnabledGrades } from "./settings.js";
import { setActiveTab, el, addKV } from "./ui.js";

let WIRED = false;

function normalizeQuery(q){
  return String(q ?? "").trim();
}

function matches(record, q){
  if(!q) return true;
  const hay = [
    record.id,
    record.meaningKey,
    ...(record.on || []),
    ...(record.kun || []),
    record.raw?.label || "",
    record.raw?.meaning_hira || "",
    record.raw?.meaning_en || ""
  ].join(" ");
  return hay.includes(q);
}

function renderListItem(record, onSelect){
  const btn = el("button", "dictRowBtn");
  btn.type = "button";

  const top = el("div", "dictRowTop");
  const k = el("div", "dictRowKanji", record.id);
  const meta = el("div", "dictRowMeta", `G${record.grade}`);
  top.appendChild(k);
  top.appendChild(meta);

  const sub = el("div", "dictRowSub", record.meaningKey);

  btn.appendChild(top);
  btn.appendChild(sub);

  btn.addEventListener("click", () => onSelect(record));
  return btn;
}

function renderDetail(record){
  const empty = document.getElementById("dictEmpty");
  const detail = document.getElementById("dictDetail");
  if(empty) empty.style.display = "none";
  if(detail) detail.style.display = "";

  const big = document.getElementById("dictBigKanji");
  if(big) big.textContent = record.id;

  const chips = document.getElementById("dictChips");
  if(chips){
    chips.innerHTML = "";
    chips.appendChild(el("div", "chipLight", `Grade G${record.grade}`));
    if(record.on?.length) chips.appendChild(el("div", "chipLight", `音: ${record.on.join("、")}`));
    if(record.kun?.length) chips.appendChild(el("div", "chipLight", `訓: ${record.kun.join("、")}`));
  }

  const rows = document.getElementById("dictRows");
  if(rows){
    rows.innerHTML = "";
    addKV(rows, "Meaning (hira)", record.meaningKey);
    if(record.raw?.meaning_en) addKV(rows, "Meaning (en)", String(record.raw.meaning_en));
    if(record.raw?.label) addKV(rows, "Label", String(record.raw.label));
    if(record.raw?.kyoiku_index != null) addKV(rows, "kyoiku_index", String(record.raw.kyoiku_index));
  }

  const raw = document.getElementById("dictRaw");
  if(raw) raw.textContent = JSON.stringify(record.raw, null, 2);
}

/* ---------- Word detail ---------- */

function renderWordDetail(wordMeta){
  state.lastWordDetail = wordMeta || null;

  const wordBig = document.getElementById("wordBig");
  const wordChips = document.getElementById("wordChips");
  const wordRows = document.getElementById("wordRows");
  const wordRaw = document.getElementById("wordRaw");

  if(wordBig) wordBig.textContent = wordMeta?.word || "—";

  if(wordChips){
    wordChips.innerHTML = "";
    if(wordMeta?.__effectiveGrade != null) wordChips.appendChild(el("div", "chipLight", `Grade G${wordMeta.__effectiveGrade}`));
    if(wordMeta?.band != null) wordChips.appendChild(el("div", "chipLight", `band ${wordMeta.band}`));
    if(wordMeta?.age_min != null) wordChips.appendChild(el("div", "chipLight", `age ${wordMeta.age_min}+`));
  }

  if(wordRows){
    wordRows.innerHTML = "";
    const add = (k,v) => addKV(wordRows, k, v);

    if(wordMeta?.word) add("word", String(wordMeta.word));
    if(wordMeta?.reading) add("reading", String(wordMeta.reading));
    if(wordMeta?.meaning_hira) add("meaning_hira", String(wordMeta.meaning_hira));
    if(wordMeta?.meaning_en) add("meaning_en", String(wordMeta.meaning_en));
    if(wordMeta?.band != null) add("band", String(wordMeta.band));
    if(wordMeta?.age_min != null) add("age_min", String(wordMeta.age_min));
    if(wordMeta?.grade != null) add("grade (explicit)", String(wordMeta.grade));
    if(wordMeta?.__effectiveGrade != null) add("effective grade", String(wordMeta.__effectiveGrade));
  }

  if(wordRaw) wordRaw.textContent = JSON.stringify(wordMeta || {}, null, 2);
}

/* ---------- Main wiring ---------- */

export function wireDictionaryUI(){
  if(WIRED) return;
  WIRED = true;

  const searchEl = document.getElementById("dictSearch");
  const listEl = document.getElementById("dictList");
  const countEl = document.getElementById("dictCount");
  const statusPill = document.getElementById("dictStatusPill");

  async function refresh(){
    try{
      const enabledGrades = getEnabledGrades();

      if(enabledGrades.length === 0){
        if(statusPill) statusPill.textContent = "Enable grades in Settings";
        if(listEl) listEl.innerHTML = "";
        if(countEl) countEl.textContent = "0 results";
        document.getElementById("dictEmpty").style.display = "";
        document.getElementById("dictDetail").style.display = "none";
        return [];
      }

      if(statusPill) statusPill.textContent = "Loading…";
      await ensureGradesLoaded(enabledGrades);

      const pool = buildPoolForGrades(enabledGrades);
      const q = normalizeQuery(searchEl?.value);

      const results = pool.filter(r => matches(r, q));

      if(listEl){
        listEl.innerHTML = "";
        results.forEach(rec => listEl.appendChild(renderListItem(rec, renderDetail)));
      }

      if(countEl) countEl.textContent = `${results.length} results`;
      if(statusPill) statusPill.textContent = `Grades: ${enabledGrades.map(g => "G" + g).join("+")}`;

      return results;
    } catch(err){
      const msg = (err && (err.message || err.toString())) ? (err.message || String(err)) : "Unknown error";
      if(statusPill) statusPill.textContent = `ERROR: ${msg}`;
      if(listEl) listEl.innerHTML = "";
      if(countEl) countEl.textContent = "0 results";
      document.getElementById("dictEmpty").style.display = "";
      document.getElementById("dictDetail").style.display = "none";
      throw err;
    }
  }

  async function openDictionary(){
    state.returnTo = null;
    setActiveTab("dictionary");
    await refresh();
    searchEl?.focus();
  }

  async function openDictionaryWithQuery(query, returnToGame=false){
    state.returnTo = returnToGame ? "game" : null;
    setActiveTab("dictionary");

    const q = normalizeQuery(query);
    if(searchEl) searchEl.value = q;

    const results = await refresh();

    // Force exact kanji selection when query is a single character
    if(q.length === 1){
      const hit = results.find(r => r.id === q);
      if(hit) renderDetail(hit);
    } else if(results.length === 1){
      renderDetail(results[0]);
    }

    searchEl?.focus();
  }

  async function openWordDetail(wordMeta){
    state.returnTo = "game";
    renderWordDetail(wordMeta);
    setActiveTab("word");
  }

  window.__openDictionary = openDictionary;
  window.__openDictionaryWithQuery = openDictionaryWithQuery;
  window.__openWordDetail = openWordDetail;

  document.getElementById("dictBackBtn")?.addEventListener("click", () => {
    if(state.returnTo === "game"){
      state.returnTo = null;
      setActiveTab("game");
    } else {
      setActiveTab("home");
    }
  });

  document.getElementById("wordBackBtn")?.addEventListener("click", () => {
    state.returnTo = null;
    setActiveTab("game");
  });

  searchEl?.addEventListener("input", () => { refresh().catch(()=>{}); });
  document.getElementById("dictClearBtn")?.addEventListener("click", () => {
    if(searchEl) searchEl.value = "";
    refresh().catch(()=>{});
    searchEl?.focus();
  });

  if(statusPill) statusPill.textContent = "…";
  if(countEl) countEl.textContent = "0 results";
}
