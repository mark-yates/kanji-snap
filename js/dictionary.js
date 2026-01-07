import { state } from "./state.js";
import { setActiveTab } from "./ui.js";

/**
 * Self-contained dictionary UI:
 * - Creates its own DOM inside the dictionary tab container if needed
 * - Exposes globals used by history clicks:
 *     window.__openDictionaryWithQuery(query, returnToGame)
 *     window.__openWordDetail(wordMeta)
 */

function findDictionaryContainer() {
  // Try a bunch of likely IDs
  const ids = [
    "dictionary",
    "dictionaryTab",
    "dictionaryPage",
    "pageDictionary",
    "tab-dictionary",
    "viewDictionary",
    "dictionaryView",
    "dictionaryPane",
    "dictionaryContent"
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) return el;
  }

  // Try data attributes (common in tab systems)
  const dataTabs = [
    '[data-tab-content="dictionary"]',
    '[data-tab="dictionary"]',
    '[data-page="dictionary"]',
    '[data-view="dictionary"]'
  ];
  for (const sel of dataTabs) {
    const el = document.querySelector(sel);
    if (el) return el;
  }

  // As a last resort, try any element whose id contains "dictionary"
  const fuzzy = [...document.querySelectorAll("[id]")].find((e) =>
    String(e.id).toLowerCase().includes("dictionary")
  );
  if (fuzzy) return fuzzy;

  // Ultimate fallback (won’t be pretty, but you’ll see something)
  return document.body;
}

function ensureUI() {
  if (state._dictUI?.root && document.contains(state._dictUI.root)) return state._dictUI;

  const host = findDictionaryContainer();

  // Create a dedicated root inside the dictionary container (so we don’t wipe your layout)
  const root = document.createElement("div");
  root.id = "dictAutoRoot";
  root.style.padding = "12px";
  root.style.maxWidth = "900px";
  root.style.margin = "0 auto";

  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.gap = "10px";
  topRow.style.alignItems = "center";
  topRow.style.marginBottom = "10px";

  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.textContent = "Back";
  backBtn.id = "dictAutoBack";
  backBtn.style.padding = "10px 12px";
  backBtn.style.borderRadius = "10px";

  const title = document.createElement("div");
  title.id = "dictAutoTitle";
  title.textContent = "Dictionary";
  title.style.fontSize = "18px";
  title.style.fontWeight = "600";

  topRow.appendChild(backBtn);
  topRow.appendChild(title);

  const pre = document.createElement("pre");
  pre.id = "dictAutoPre";
  pre.textContent = "";
  pre.style.whiteSpace = "pre-wrap";
  pre.style.wordBreak = "break-word";
  pre.style.padding = "12px";
  pre.style.borderRadius = "12px";
  pre.style.background = "rgba(0,0,0,0.06)";
  pre.style.margin = "0";

  root.appendChild(topRow);
  root.appendChild(pre);

  // Insert without destroying existing content:
  // - If host is body, append.
  // - If host already has our root, replace it.
  // - Otherwise append root at end.
  const existing = host.querySelector?.("#dictAutoRoot");
  if (existing) existing.remove();
  host.appendChild(root);

  backBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const target = state._dictionaryBackTarget || "home";
    state._dictionaryBackTarget = "home";
    setActiveTab(target);
  });

  state._dictUI = { host, root, backBtn, title, pre };
  return state._dictUI;
}

function getKanjiRecordByChar(ch) {
  if (state.kanjiById?.get) return state.kanjiById.get(ch) || null;
  return state.kanjiById?.[ch] || null;
}

function show(titleText, obj) {
  const ui = ensureUI();
  ui.title.textContent = titleText || "Dictionary";
  ui.pre.textContent = JSON.stringify(obj, null, 2);
}

function openDictionaryWithQuery(query, returnToGame = false) {
  const q = String(query || "").trim();
  if (!q) return;

  state._dictionaryBackTarget = returnToGame ? "game" : "home";

  if (q.length === 1) {
    const rec = getKanjiRecordByChar(q);
    show(`Kanji: ${q}`, rec?.raw || rec || { kanji: q, error: "Kanji not found in loaded grades." });
  } else {
    show(`Query: ${q}`, {
      query: q,
      note: "Multi-character dictionary lookup is not fully implemented here yet.",
      hint: "History compound clicks should use __openWordDetail(wordBlock)."
    });
  }

  setActiveTab("dictionary");
}

function openWordDetail(wordMeta) {
  state._dictionaryBackTarget = "game";
  show(
    `Word: ${wordMeta?.word || wordMeta?.reading || "word"}`,
    wordMeta || { error: "No word meta provided." }
  );
  setActiveTab("dictionary");
}

export function initDictionaryUI() {
  // Build UI once so it exists even before first open
  ensureUI();

  // Expose globals for history clicks
  window.__openDictionaryWithQuery = openDictionaryWithQuery;
  window.__openWordDetail = openWordDetail;

  // Default back target
  if (!state._dictionaryBackTarget) state._dictionaryBackTarget = "home";
}
