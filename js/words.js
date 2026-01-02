import { state } from "./state.js";

/**
 * Extract compound candidates directly from your kanji JSON schema:
 *   raw.words = [{ word:"学校", reading:"がっこう", grade?:1, band:..., age_min:..., ... }, ...]
 *
 * Accept words where:
 * - word is exactly 2 kanji characters
 * - reading exists (hiragana prompt)
 *
 * Word grade rule:
 * - if word.grade exists, use it
 * - else inherit the containing kanji's grade (rec.grade)
 *
 * Eligible compounds (later):
 * - both kanji exist in the current pool
 * - effectiveGrade is enabled via the same grade selectors
 */

function isLikelyKanjiChar(ch){
  const code = ch.codePointAt(0);
  return (
    (code >= 0x4E00 && code <= 0x9FFF) ||
    (code >= 0x3400 && code <= 0x4DBF)
  );
}

function twoKanjiOnly(str){
  const chars = Array.from(String(str || ""));
  if(chars.length !== 2) return null;
  if(!isLikelyKanjiChar(chars[0]) || !isLikelyKanjiChar(chars[1])) return null;
  return chars;
}

function norm(s){
  return String(s ?? "").trim();
}

function toFiniteInt(x){
  const n = Number(x);
  if(!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export function rebuildWordIndexForGrades(enabledGrades){
  const key = enabledGrades.slice().sort((a,b)=>a-b).join(",");
  if(state.wordsIndexBuiltForGradesKey === key) return;

  state.wordsIndexBuiltForGradesKey = key;
  state.compoundWords = [];
  state.compoundByKanji = new Map();

  for(const rec of state.kanjiById.values()){
    const raw = rec.raw;
    const words = raw?.words;
    if(!Array.isArray(words)) continue;

    for(const w of words){
      if(!w || typeof w !== "object") continue;

      const kanji = norm(w.word);
      const kana  = norm(w.reading);
      if(!kanji || !kana) continue;

      const chars = twoKanjiOnly(kanji);
      if(!chars) continue;

      // Effective grade: explicit word.grade, else inherit from the containing kanji
      const explicitGrade = toFiniteInt(w.grade);
      const inheritedGrade = toFiniteInt(rec.grade);
      const effectiveGrade = explicitGrade ?? inheritedGrade;

      const meta = {
        ...w,
        __fromKanji: rec.id,
        __fromKanjiGrade: rec.grade,
        __effectiveGrade: effectiveGrade
      };

      const entry = { kanji, kana, kanjiChars: chars, meta };

      state.compoundWords.push(entry);

      for(const kch of chars){
        if(!state.compoundByKanji.has(kch)) state.compoundByKanji.set(kch, []);
        state.compoundByKanji.get(kch).push(entry);
      }
    }
  }

  // Deduplicate by (kanji|kana) pair (same word may appear under both component kanji)
  const seen = new Set();
  state.compoundWords = state.compoundWords.filter(e => {
    const sig = `${e.kanji}|${e.kana}`;
    if(seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/**
 * Eligible compounds:
 * - both kanji are present in the current pool
 * - effectiveGrade is enabled in Settings (same checkboxes)
 */
export function getEligibleCompoundWords(pool){
  const enabledGrades = new Set(
    state.wordsIndexBuiltForGradesKey
      .split(",")
      .filter(Boolean)
      .map(Number)
  );

  const poolSet = new Set(pool.map(k => k.id));

  return state.compoundWords.filter(w => {
    const [k1,k2] = w.kanjiChars;
    if(!poolSet.has(k1) || !poolSet.has(k2)) return false;

    const g = Number(w.meta?.__effectiveGrade);
    if(!Number.isFinite(g)) return false;

    return enabledGrades.has(g);
  });
}
