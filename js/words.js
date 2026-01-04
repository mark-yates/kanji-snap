import { state } from "./state.js";

/**
 * Build eligible 2-kanji compounds from words embedded in kanji entries.
 * Word block format example:
 *  { word:"学校", reading:"がっこう", band:1000, meaning_hira:"がっこう", grade:1, age_min:8, ... }
 *
 * Grade is optional in the word block:
 * - if absent, inherit grade from containing kanji entry
 * - if present, use that
 */

let wordIndex = []; // rebuilt per enabled grades

function isTwoKanji(s){
  if(typeof s !== "string") return false;
  if(s.length !== 2) return false;
  // crude: exclude kana/ascii/numbers
  return !/[ぁ-んァ-ヶa-zA-Z0-9]/.test(s);
}

export function rebuildWordIndexForGrades(enabledGrades){
  const enabledSet = new Set(enabledGrades);
  const out = [];
  const seen = new Set(); // dedupe by word+reading

  for(const k of state.kanjiById.values()){
    if(!enabledSet.has(k.grade)) continue;

    const words = k.raw?.words;
    if(!Array.isArray(words)) continue;

    for(const w of words){
      if(!w || typeof w.word !== "string" || typeof w.reading !== "string") continue;
      if(!isTwoKanji(w.word)) continue;

      const effectiveGrade = Number.isFinite(Number(w.grade)) ? Number(w.grade) : k.grade;
      if(!enabledSet.has(effectiveGrade)) continue;

      const key = `${w.word}::${w.reading}`;
      if(seen.has(key)) continue;
      seen.add(key);

      out.push({
        kanji: w.word,
        kana: w.reading,
        kanjiChars: [w.word[0], w.word[1]],
        // keep the original block + our derived grade for word-detail screen
        meta: { ...w, __effectiveGrade: effectiveGrade }
      });
    }
  }

  wordIndex = out;
}

/**
 * Filter compound words down to those whose two kanji are currently present in the selected pool.
 * pool is the *active* kanji list for the current game.
 */
export function getEligibleCompoundWords(pool){
  const poolSet = new Set((pool || []).map(k => k.id));
  return wordIndex.filter(w =>
    poolSet.has(w.kanjiChars[0]) && poolSet.has(w.kanjiChars[1])
  );
}
