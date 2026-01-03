import { ensureGradesLoaded, buildPoolForGrades } from "./data.js";
import { getEnabledGrades } from "./settings.js";
import { setActiveTab, el, addKV } from "./ui.js";

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
    if(record.raw?.meaning_hira) addKV(rows, "meaning_hira", String(record.raw.meaning_hira));
    if(record.on?.length) addKV(rows, "onyomi", record.on.join("、"));
    if(record.kun?.length) addKV(rows, "kunyomi", record.kun.join("、"));

    if(record.raw?.kyoiku_index != null) addKV(rows, "kyoiku_index", String(record.raw.kyoiku_index));
  }

  const rawPre = document.getElementById("dictRaw");
  if(rawPre) rawPre.textContent = JSON.stringify(record.raw, null, 2);
}

export function wireDictionaryUI(){
  const searchEl = document.getElementById("dictSearch");
  const listEl = document.getElementById("dictList");
  const countEl = document.getElementById("dictCount");
  const statusPill = document.getElementById("dictStatusPill");

  async function refresh(){
    const enabledGrades = getEnabledGrades();

    if(enabledGrades.length === 0){
      if(statusPill) statusPill.textContent = "Enable grades in Settings";
      if(listEl) listEl.innerHTML = "";
      if(countEl) countEl.textContent = "0 results";
      const empty = document.getElementById("dictEmpty");
      const detail = document.getElementById("dictDetail");
      if(empty) empty.style.display = "";
      if(detail) detail.style.display = "none";
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

    if(q && results.length === 1){
      renderDetail(results[0]);
    }

    return results;
  }

  async function openDictionary(){
    setActiveTab("dictionary");
    searchEl?.focus();
    await refresh();
  }

  async function openDictionaryWithQuery(query){
    setActiveTab("dictionary");
    if(searchEl) searchEl.value = String(query ?? "");
    searchEl?.focus();
    const results = await refresh();

    // If query is exactly a single kanji and it exists in results, auto-open it
    const q = normalizeQuery(query);
    if(q.length === 1){
      const hit = results.find(r => r.id === q);
      if(hit) renderDetail(hit);
    }
  }

  window.__openDictionary = openDictionary;
  window.__openDictionaryWithQuery = openDictionaryWithQuery;

  document.getElementById("dictBackBtn")?.addEventListener("click", () => setActiveTab("home"));

  searchEl?.addEventListener("input", () => refresh().catch(err => alert(String(err))));

  document.getElementById("dictClearBtn")?.addEventListener("click", () => {
    if(searchEl) searchEl.value = "";
    refresh().catch(err => alert(String(err)));
    searchEl?.focus();
  });

  if(statusPill) statusPill.textContent = "…";
  if(countEl) countEl.textContent = "0 results";
}
