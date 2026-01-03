import { state } from "./state.js";
import { isKanjiEnabled } from "./settings.js";

export const GRADE_FILES = {
  1: "./grade-1.json",
  2: "./grade-2.json",
  3: "./grade-3.json"
  // add 4..6 later
};

export function normalizeKanjiEntry(raw){
  const id = raw.kanji;
  const grade = Number(raw.grade);

  const on  = Array.isArray(raw.onyomi) ? raw.onyomi : [];
  const kun = Array.isArray(raw.kunyomi) ? raw.kunyomi : [];

  // Placeholder meaning fallback:
  let meaningKey = (raw.meaning_hira || "").trim();
  if(!meaningKey){
    const label = (raw.label || "").trim();
    if(label) meaningKey = label;
  }
  if(!meaningKey && kun.length){
    meaningKey = String(kun[0]).replace(/\[|\]/g, "").replace(/\./g, "").trim();
  }
  if(!meaningKey) meaningKey = "みてい";

  return { id, grade, on, kun, meaningKey, raw };
}

export async function loadGrade(grade){
  if(state.loadedGrades.has(grade)) return;
  const url = GRADE_FILES[grade];
  if(!url) return;

  const res = await fetch(url);
  if(!res.ok) throw new Error(`Fetch failed: ${url} (HTTP ${res.status})`);

  const arr = await res.json();
  if(!Array.isArray(arr)) throw new Error(`${url} is not a JSON array`);

  for(const raw of arr){
    if(!raw || !raw.kanji) continue;
    const norm = normalizeKanjiEntry(raw);
    state.kanjiById.set(norm.id, norm);
  }
  state.loadedGrades.add(grade);
}

export async function ensureGradesLoaded(grades){
  for(const g of grades) await loadGrade(g);
}

/**
 * Pool now respects individual overrides:
 * - include if isKanjiEnabled(id, grade) is true
 */
export function buildPoolForGrades(grades){
  const enabledGrades = new Set(grades);
  return [...state.kanjiById.values()].filter(k =>
    enabledGrades.has(k.grade) && isKanjiEnabled(k.id, k.grade)
  );
}

/**
 * Utility for kanji picker: get all kanji for a grade, ordered by kyoiku_index then kanji.
 */
export function getKanjiForGradeSorted(grade){
  const items = [...state.kanjiById.values()].filter(k => k.grade === grade);
  items.sort((a,b) => {
    const ai = Number(a.raw?.kyoiku_index ?? 1e9);
    const bi = Number(b.raw?.kyoiku_index ?? 1e9);
    if(ai !== bi) return ai - bi;
    return a.id.localeCompare(b.id);
  });
  return items;
}
