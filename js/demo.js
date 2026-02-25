export const FILE_VERSION = "1.70";

/**
 * demo.js
 * Demo tab: Static sentence layout prototype (no drag/drop yet).
 *
 * Layout goal:
 * - Top 2 rows (spanning width): 2x4 answer tiles (8 tiles)
 * - Bottom row (spanning width): one large square prompt tile
 *
 * The CSS + HTML already set the board to the correct shape.
 */

function q(id) {
  return /** @type {HTMLElement|null} */ (document.getElementById(id));
}

const TEST_SENTENCE =
  "ある日、じいさまは\n" +
  "山へ　しばかりに、\n" +
  "ばあさまは　川へ\n" +
  "せんたくに　いきました";

const SENTENCE_KANJI = ["日", "山", "川"];

/**
 * Fallback grade-1-ish kanji list (only used if the app pool isn't available yet).
 * (Doesn't need to be complete; just needs enough variety for filler.)
 */
const FALLBACK_G1 = [
  "一","二","三","四","五","六","七","八","九","十",
  "上","下","左","右","中","大","小","月","火","水","木","金","土",
  "人","子","女","男","山","川","田","口","目","耳","手","足",
  "日","年","早","白","本","立","休","先","生","学","校",
  "国","円","千","万","百","正","気","空","天","雨"
];

function uniq(arr) {
  return Array.from(new Set(arr));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Try to pull grade 1 kanji from the current app pool, if available.
 * Falls back to a local list if state/pool not available.
 */
function getGrade1Candidates() {
  // "state" is in a module; we won't hard-import it here to keep demo robust.
  // But in many builds, state is on window. We'll use it if present.
  const pool = /** @type {any} */ (window).state?.pool;

  // If pool exists, it contains entries like {id, grade, ...}
  if (Array.isArray(pool) && pool.length) {
    const g1 = pool.filter((k) => k && k.grade === 1 && typeof k.id === "string").map((k) => k.id);
    if (g1.length >= 8) return uniq(g1);
  }

  return uniq(FALLBACK_G1);
}

function buildAnswerTiles() {
  const candidates = getGrade1Candidates().filter((k) => !SENTENCE_KANJI.includes(k));
  shuffle(candidates);

  const neededFill = Math.max(0, 8 - SENTENCE_KANJI.length);
  const fill = candidates.slice(0, neededFill);

  const tiles = shuffle([...SENTENCE_KANJI, ...fill]).slice(0, 8);
  return tiles;
}

function renderStatic() {
  const promptTextEl = q("demoPromptText");
  if (promptTextEl) {
    promptTextEl.textContent = TEST_SENTENCE;
  }

  const tiles = buildAnswerTiles();

  for (let i = 0; i < 8; i++) {
    const el = q(`demoChoice${i}Text`);
    if (el) el.textContent = tiles[i] || "？";
  }
}

export function initDemoUI() {
  const resetBtn = q("demoResetBtn");

  // Make sure prompt has the usual tile classes (same as game prompt)
  const prompt = q("demoPrompt");
  prompt?.classList.remove("correct", "wrong");

  renderStatic();

  resetBtn?.addEventListener("click", () => {
    renderStatic();
  });

  // No drag/click behavior yet—this is layout-only.
}
