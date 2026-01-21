/**
 * words.js
 *
 * Loads and indexes the external words file (CSV) that replaces embedded
 * "words" blocks in the grade JSON files.
 *
 * Default meaning: meaning_en_custom || meaning_en
 *
 * This module ALSO preserves the legacy API used by the quiz:
 *   - rebuildWordIndexForGrades(enabledGrades)
 *   - getEligibleCompoundWords(pool, opts)
 */

export const FILE_VERSION = "1.63";

let _loaded = false;
let _loadingPromise = null;

let _wordsAll = []; // Array<WordRow>
let _index = {
  byGrade: new Map(),  // Map<number, WordRow[]>
  byKanji: new Map(),  // Map<string, WordRow[]>
  byWord: new Map(),   // Map<string, WordRow>
};

let _enabledGrades = null; // number[] | null
let _eligibleCacheKey = "";
let _eligibleCache = [];

// Adjust this path if you store the CSV elsewhere.
const DEFAULT_WORDS_CSV_URL = "./data/words.v2.csv";

/**
 * @typedef {Object} WordSegment
 * @property {string} kanji
 * @property {string} reading
 */

/**
 * @typedef {Object} WordRow
 * @property {number} frequency
 * @property {string} word
 * @property {string} reading
 * @property {string} reading_segments
 * @property {string} meaning_en
 * @property {string} meaning_en_custom
 * @property {string} part
 * @property {number|null} frequency_band
 * @property {number|null} age_band
 * @property {number|null} grade
 * @property {string} meaning  // derived: meaning_en_custom || meaning_en
 * @property {string[]} kanjiChars // derived: kanji characters in word
 * @property {WordSegment[]} segments // derived: parsed reading_segments
 */

/* -------------------- Public: loading -------------------- */

export async function ensureWordsLoaded(url = DEFAULT_WORDS_CSV_URL) {
  if (_loaded) return;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) {
      throw new Error(`Failed to load words CSV (${res.status}): ${url}`);
    }

    const text = await res.text();
    const rows = parseCsv(text);

    // Expect header row
    if (!rows.length) {
      _wordsAll = [];
      _loaded = true;
      return;
    }

    const header = rows[0].map(h => (h || "").trim());
    const colIndex = {};
    header.forEach((name, i) => { colIndex[name] = i; });

    const required = ["frequency","word","reading","reading_segments","meaning_en","meaning_en_custom","part","frequency_band","age_band","grade"];
    for (const r of required) {
      if (!(r in colIndex)) {
        throw new Error(`Words CSV missing required column "${r}". Found: ${header.join(", ")}`);
      }
    }

    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;

      const word = getCell(r, colIndex.word).trim();
      const reading = getCell(r, colIndex.reading).trim();
      if (!word || !reading) continue;

      const row = /** @type {WordRow} */ ({
        frequency: toInt(getCell(r, colIndex.frequency), 0),
        word,
        reading,
        reading_segments: getCell(r, colIndex.reading_segments).trim(),
        meaning_en: getCell(r, colIndex.meaning_en).trim(),
        meaning_en_custom: getCell(r, colIndex.meaning_en_custom).trim(),
        part: getCell(r, colIndex.part).trim(),
        frequency_band: toFloatOrNull(getCell(r, colIndex.frequency_band)),
        age_band: toFloatOrNull(getCell(r, colIndex.age_band)),
        grade: toIntOrNull(getCell(r, colIndex.grade)),
        meaning: "",      // derived below
        kanjiChars: [],   // derived below
        segments: [],     // derived below
      });

      row.meaning = (row.meaning_en_custom || row.meaning_en || "").trim();

      row.kanjiChars = extractKanjiChars(row.word);
      row.segments = parseReadingSegments(row.reading_segments);

      out.push(row);
    }

    _wordsAll = out;
    buildIndexes(out);

    _loaded = true;
  })();

  return _loadingPromise;
}

/**
 * Optional helper, if you want to point at a different CSV path at runtime.
 */
export function setWordsCsvUrl(url) {
  // Reset caches so next ensureWordsLoaded fetches the new dataset.
  _loaded = false;
  _loadingPromise = null;
  _wordsAll = [];
  _index = { byGrade: new Map(), byKanji: new Map(), byWord: new Map() };
  _enabledGrades = null;
  _eligibleCacheKey = "";
  _eligibleCache = [];
  // Note: caller must pass url to ensureWordsLoaded(url) after this.
  // We keep DEFAULT_WORDS_CSV_URL constant.
}

/* -------------------- Public: queries -------------------- */

export function getWordsAll() {
  return _wordsAll;
}

export function getWordBySurface(surface) {
  return _index.byWord.get(surface) || null;
}

export function getWordsByGrade(grade) {
  return _index.byGrade.get(grade) || [];
}

export function getWordsForKanji(kanjiChar) {
  return _index.byKanji.get(kanjiChar) || [];
}

/* -------------------- Legacy API used by the quiz -------------------- */

/**
 * Legacy hook: called after grades are loaded / enabled.
 * We store enabled grades so we can optionally filter word candidates later.
 *
 * @param {number[]} enabledGrades
 */
export function rebuildWordIndexForGrades(enabledGrades) {
  _enabledGrades = Array.isArray(enabledGrades) ? enabledGrades.slice() : null;
  _eligibleCacheKey = "";
  _eligibleCache = [];
}

/**
 * Returns eligible compound words given the currently enabled kanji pool.
 *
 * Your existing quiz code likely calls:
 *   getEligibleCompoundWords(state.pool)
 *
 * where state.pool is a list of kanji objects with id/kanji, or strings.
 *
 * @param {Array<any>} pool - enabled kanji pool (objects with .id or .kanji, or strings)
 * @param {Object} [opts]
 * @param {number} [opts.minKanji=2] - minimum kanji chars in the word
 * @param {number} [opts.maxKanji=2] - maximum kanji chars in the word (keep 2 for classic 2-pick gameplay)
 * @param {boolean} [opts.requireSegments=false] - if true, only include words that have parsed segments
 * @returns {Array<{kanji:string,kana:string,kanjiChars:string[],meaning:string,meta:any}>}
 */
export function getEligibleCompoundWords(pool, opts = {}) {
  const minKanji = typeof opts.minKanji === "number" ? opts.minKanji : 2;
  const maxKanji = typeof opts.maxKanji === "number" ? opts.maxKanji : 2;
  const requireSegments = !!opts.requireSegments;

  const allowed = new Set();
  for (const item of (pool || [])) {
    if (typeof item === "string") allowed.add(item);
    else if (item && typeof item.id === "string") allowed.add(item.id);
    else if (item && typeof item.kanji === "string") allowed.add(item.kanji);
  }

  // Cache key: enabled set + enabled grades (optional) + options
  const allowedKey = [...allowed].sort().join("");
  const gradesKey = Array.isArray(_enabledGrades) ? _enabledGrades.slice().sort((a,b)=>a-b).join(",") : "";
  const key = `${allowedKey}::${gradesKey}::${minKanji}-${maxKanji}-${requireSegments}`;

  if (key === _eligibleCacheKey) return _eligibleCache;

  // Optional grade filter: if enabled grades are known, we can restrict words by grade.
  // (We keep it permissive: if a word row has no grade, we allow it.)
  const enabledGradesSet = Array.isArray(_enabledGrades) ? new Set(_enabledGrades) : null;

  const eligible = [];
  for (const w of _wordsAll) {
    const n = w.kanjiChars.length;
    if (n < minKanji || n > maxKanji) continue;

    if (enabledGradesSet && w.grade != null && !enabledGradesSet.has(w.grade)) {
      // This is optional; if you'd rather allow cross-grade words, remove this block.
      continue;
    }

    if (requireSegments && (!w.segments || w.segments.length === 0)) continue;

    let ok = true;
    for (const k of w.kanjiChars) {
      if (!allowed.has(k)) { ok = false; break; }
    }
    if (!ok) continue;

    eligible.push({
      kanji: w.word,
      kana: w.reading,
      kanjiChars: w.kanjiChars.slice(),
      meaning: w.meaning,
      meta: {
        word: w.word,
        reading: w.reading,
        reading_segments: w.reading_segments,
        meaning: w.meaning,
        meaning_en: w.meaning_en,
        meaning_en_custom: w.meaning_en_custom,
        part: w.part,
        frequency: w.frequency,
        frequency_band: w.frequency_band,
        age_band: w.age_band,
        grade: w.grade,
      }
    });
  }

  _eligibleCacheKey = key;
  _eligibleCache = eligible;
  return eligible;
}

/* -------------------- Internals -------------------- */

function buildIndexes(words) {
  _index.byGrade.clear();
  _index.byKanji.clear();
  _index.byWord.clear();

  for (const w of words) {
    _index.byWord.set(w.word, w);

    if (w.grade != null) {
      if (!_index.byGrade.has(w.grade)) _index.byGrade.set(w.grade, []);
      _index.byGrade.get(w.grade).push(w);
    }

    for (const k of w.kanjiChars) {
      if (!_index.byKanji.has(k)) _index.byKanji.set(k, []);
      _index.byKanji.get(k).push(w);
    }
  }
}

function getCell(row, idx) {
  if (idx < 0) return "";
  return (row[idx] ?? "").toString();
}

function toInt(v, fallback = 0) {
  const n = parseInt((v ?? "").toString(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function toIntOrNull(v) {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloatOrNull(v) {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract kanji characters from the word surface form.
 * We treat "kanji" as characters in common CJK ranges.
 */
function extractKanjiChars(word) {
  const out = [];
  for (const ch of (word || "")) {
    // CJK Unified Ideographs + Extension A (basic coverage)
    const code = ch.codePointAt(0);
    const isKanji =
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0x3400 && code <= 0x4DBF);
    if (isKanji) out.push(ch);
  }
  return out;
}

/**
 * Parse your "reading_segments" format:
 *   日:に | 本:ほん
 *   問:もん | 題:だい
 *   考:かんが | え   (allowed: kana tail segments without kanji)
 *
 * We return structured segments of the form {kanji, reading}.
 * For segments without a kanji (e.g. "え"), we store kanji="".
 */
function parseReadingSegments(s) {
  const raw = (s || "").trim();
  if (!raw) return [];

  const parts = raw.split("|").map(x => x.trim()).filter(Boolean);
  const out = [];

  for (const p of parts) {
    // "日:に" or just "え"
    const idx = p.indexOf(":");
    if (idx === -1) {
      out.push({ kanji: "", reading: p.trim() });
      continue;
    }

    const k = p.slice(0, idx).trim();
    const r = p.slice(idx + 1).trim();
    out.push({ kanji: k, reading: r });
  }

  return out;
}

/**
 * CSV parser that supports:
 * - commas
 * - quoted fields with commas/newlines
 * - double quotes escaped as ""
 *
 * Returns: string[][]
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      continue;
    }

    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (c === "\r") {
      // ignore CR; handle newline on \n
      continue;
    }

    if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      continue;
    }

    field += c;
  }

  // last field/row
  row.push(field);
  rows.push(row);

  // trim any trailing empty rows
  while (rows.length && rows[rows.length - 1].every(x => (x || "").trim() === "")) {
    rows.pop();
  }

  return rows;
}

