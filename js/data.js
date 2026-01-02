import { state } from "./state.js";

export const GRADE_FILES = {
  1: "./grade-1.json",
  2: "./grade-2.json",
  3: "./grade-3.json"
  // 4: "./grade-4.json",
  // 5: "./grade-5.json",
  // 6: "./grade-6.json",
};

export function normalizeKanjiEntry(raw){
  const id = raw.kanji;
  const grade = Number(raw.grade);

  const on  = Array.isArray(raw.onyomi) ? raw.onyomi : [];
  const kun = Array.isArray(raw.kunyomi) ? raw.kunyomi : [];

  // Placeholder meaning fallback:
  // meaning_hira > label > kunyomi[0] (sanitized) > みてい
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

export function buildPoolForGrades(grades){
  const enabled = new Set(grades);
  return [...state.kanjiById.values()].filter(k => enabled.has(k.grade));
}
