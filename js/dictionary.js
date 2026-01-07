import { state } from "./state.js";
import { setActiveTab } from "./ui.js";

/**
 * This file provides a simple dictionary UI AND, critically, exposes:
 *   window.__openDictionaryWithQuery(query, returnToGame)
 *   window.__openWordDetail(wordMeta)
 *
 * game-quiz.js history clicks rely on those globals.
 */

function $(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
}

function safeString(x) {
  if (x == null) return "";
  if (typeof x === "string") return x;
  try { return JSON.stringify(x); } catch { return String(x); }
}

function getKanjiRecordByChar(ch) {
  // state.kanjiById is a Map in our project
  if (state.kanjiById?.get) return state.kanjiById.get(ch) || null;

  // fallback if it’s an object
  return state.kanjiById?.[ch] || null;
}

function renderJson(preEl, obj) {
  if (!preEl) return;
  preEl.textContent = JSON.stringify(obj, null, 2);
}

function showDictionaryPane({ title, bodyObj }) {
  const titleEl = $("dictTitle", "dictionaryTitle");
  const preEl = $("dictPre", "dictDetail", "dictionaryPre", "dictionaryDetailPre");

  if (titleEl) titleEl.textContent = title || "Dictionary";
  if (preEl) renderJson(preEl, bodyObj);

  // If you have a generic container, make sure it is visible
  const panel = $("dictPanel", "dictionaryPanel", "dictionaryContent");
  if (panel) panel.style.display = "";
}

function setBackTarget(targetTab) {
  state._dictionaryBackTarget = targetTab; // "game" | "home" | "settings" etc.
  const backBtn = $("dictBackBtn", "dictionaryBackBtn", "backFromDictBtn");
  if (backBtn) backBtn.style.display = "";
}

function goBackFromDictionary() {
  const target = state._dictionaryBackTarget || "home";
  state._dictionaryBackTarget = "home";
  setActiveTab(target);
}

/* ---------------- Public API used by game history ---------------- */

function openDictionaryWithQuery(query, returnToGame = false) {
  const q = (query || "").trim();
  if (!q) return;

  setBackTarget(returnToGame ? "game" : "home");

  // If query is a single kanji, show kanji record
  if (q.length === 1) {
    const rec = getKanjiRecordByChar(q);
    showDictionaryPane({
      title: `Kanji: ${q}`,
      bodyObj: rec?.raw || rec || { kanji: q, error: "Kanji not found in loaded grades." }
    });
  } else {
    // For now, show a simple object (you can enrich later)
    showDictionaryPane({
      title: `Query: ${q}`,
      bodyObj: { query: q, note: "Multi-character lookup not yet implemented here." }
    });
  }

  setActiveTab("dictionary");
}

function openWordDetail(wordMeta) {
  // wordMeta is expected to be a "word block" (from your kanji JSON words array),
  // or at minimum { word, reading, ... }
  setBackTarget("game");
  showDictionaryPane({
    title: `Word: ${safeString(wordMeta?.word || wordMeta?.reading || "word")}`,
    bodyObj: wordMeta || { error: "No word meta provided." }
  });
  setActiveTab("dictionary");
}

/* ---------------- Init UI (search box etc.) ---------------- */

export function initDictionaryUI() {
  // Expose globals for game history
  window.__openDictionaryWithQuery = openDictionaryWithQuery;
  window.__openWordDetail = openWordDetail;

  // Wire back button (support multiple possible IDs)
  const backBtn = $("dictBackBtn", "dictionaryBackBtn", "backFromDictBtn");
  backBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    goBackFromDictionary();
  });

  // Optional search UI, if present
  const input = $("dictSearchInput", "dictionarySearchInput", "dictSearch", "dictionarySearch");
  const goBtn = $("dictSearchBtn", "dictionarySearchBtn", "dictGoBtn", "dictionaryGoBtn");

  function runSearch() {
    const q = (input?.value || "").trim();
    if (!q) return;
    openDictionaryWithQuery(q, false);
  }

  goBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    runSearch();
  });

  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSearch();
    }
  });

  // Default back target
  if (!state._dictionaryBackTarget) state._dictionaryBackTarget = "home";
}
