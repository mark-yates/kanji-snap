export const FILE_VERSION = "1.68";

/**
 * ui.js
 * Central tab/view switching.
 *
 * Supported tabs:
 * home, settings, dictionary, kanji, game, word, debug
 */

const KNOWN_TABS = ["home", "settings", "dictionary", "kanji", "game", "word", "demo", "debug"];

function cap(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getViewForTab(tab) {
  // Prefer explicit data-view mapping
  const byData = document.querySelector(`.view[data-view="${tab}"]`);
  if (byData) return byData;

  // Otherwise fall back to id convention: viewHome, viewSettings, ...
  return document.getElementById(`view${cap(tab)}`);
}

function getTabButtonsForTab(tab) {
  // Prefer explicit data-tab mapping
  const btns = Array.from(document.querySelectorAll(`.tabs [data-tab="${tab}"]`));
  if (btns.length) return btns;

  // Otherwise fall back to id convention: tabHome, tabSettings, ...
  const byId = document.getElementById(`tab${cap(tab)}`);
  return byId ? [byId] : [];
}

export function setActiveTab(tab) {
  // Normalize
  tab = (tab || "").toString().trim().toLowerCase();

  // If unknown, fall back to home (prevents blank screen)
  if (!KNOWN_TABS.includes(tab)) {
    console.warn(`setActiveTab: unknown tab "${tab}", falling back to "home"`);
    tab = "home";
  }

  // Hide all views
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.remove("active");
    v.style.display = "none";
  });

  // Deactivate all tab buttons
  document.querySelectorAll(".tabs .tab").forEach((b) => b.classList.remove("active"));

  // Activate the requested view
  const view = getViewForTab(tab);
  if (!view) {
    console.warn(`setActiveTab: missing view for tab "${tab}", falling back to "home"`);
    const homeView = getViewForTab("home");
    if (homeView) {
      homeView.classList.add("active");
      homeView.style.display = "block";
    }
    const homeBtns = getTabButtonsForTab("home");
    homeBtns.forEach((b) => b.classList.add("active"));
    return;
  }

  view.classList.add("active");
  view.style.display = "block";

  // Activate corresponding tab button(s)
  const btns = getTabButtonsForTab(tab);
  btns.forEach((b) => b.classList.add("active"));
}
