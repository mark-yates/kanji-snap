// js/app.js
// Robust bootloader: uses dynamic imports so one failing module can't break all buttons.
// Also shows a visible on-screen error if something goes wrong.

function showFatal(err){
  console.error(err);
  const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);

  let box = document.getElementById("fatalBox");
  if(!box){
    box = document.createElement("div");
    box.id = "fatalBox";
    box.style.position = "fixed";
    box.style.left = "12px";
    box.style.right = "12px";
    box.style.bottom = "12px";
    box.style.zIndex = "9999";
    box.style.padding = "12px";
    box.style.borderRadius = "12px";
    box.style.border = "1px solid rgba(233,238,252,.25)";
    box.style.background = "rgba(239,68,68,.18)";
    box.style.color = "#e9eefc";
    box.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial";
    box.style.whiteSpace = "pre-wrap";

    const title = document.createElement("div");
    title.textContent = "App error (tap to dismiss)";
    title.style.fontWeight = "900";
    title.style.marginBottom = "6px";

    const body = document.createElement("div");
    body.id = "fatalBody";
    body.style.fontSize = "12.5px";
    body.textContent = msg;

    box.appendChild(title);
    box.appendChild(body);
    box.addEventListener("click", () => box.remove());

    document.body.appendChild(box);
  } else {
    const body = document.getElementById("fatalBody");
    if(body) body.textContent = msg;
  }
}

function byId(id){ return document.getElementById(id); }

async function boot(){
  // Load ui + state first (small core)
  const [{ state }, ui] = await Promise.all([
    import("./state.js"),
    import("./ui.js")
  ]);

  // Settings (dynamic)
  const settingsMod = await import("./settings.js");

  // Register SW early
  ui.registerServiceWorker();

  // Init settings state
  state.settings = settingsMod.loadSettings();

  // --- Navigation helpers ---
  function go(tab){
    ui.setActiveTab(tab);
  }

  // Tabs
  byId("tabHome")?.addEventListener("click", () => go("home"));
  byId("tabSettings")?.addEventListener("click", () => go("settings"));
  byId("tabDictionary")?.addEventListener("click", async () => {
    try{
      // Dictionary module is optional until needed
      const dict = await import("./dictionary.js");
      dict.wireDictionaryUI?.();
      // open dictionary
      if(window.__openDictionary) window.__openDictionary();
      else go("dictionary");
    } catch(e){ showFatal(e); }
  });
  byId("tabKanji")?.addEventListener("click", async () => {
    try{
      const picker = await import("./kanji-picker.js");
      picker.wireKanjiPickerUI?.();
      if(window.__openKanjiPicker) window.__openKanjiPicker();
      else go("kanji");
    } catch(e){ showFatal(e); }
  });
  byId("tabGame")?.addEventListener("click", () => go("game"));

  // Home buttons
  byId("goSettingsBtn")?.addEventListener("click", () => go("settings"));
  byId("goDictionaryBtn")?.addEventListener("click", async () => {
    try{
      const dict = await import("./dictionary.js");
      dict.wireDictionaryUI?.();
      if(window.__openDictionary) window.__openDictionary();
      else go("dictionary");
    } catch(e){ showFatal(e); }
  });
  byId("goKanjiBtn")?.addEventListener("click", async () => {
    try{
      const picker = await import("./kanji-picker.js");
      picker.wireKanjiPickerUI?.();
      if(window.__openKanjiPicker) window.__openKanjiPicker();
      else go("kanji");
    } catch(e){ showFatal(e); }
  });

  // Back buttons
  byId("backHomeBtn")?.addEventListener("click", () => go("home"));
  byId("kanjiBackBtn")?.addEventListener("click", () => go("settings")); // typical flow
  // dictBackBtn + wordBackBtn are wired inside dictionary.js; but keep safe fallbacks:
  byId("dictBackBtn")?.addEventListener("click", () => go("home"));
  byId("wordBackBtn")?.addEventListener("click", () => go("game"));

  // Start game
  byId("startBtn")?.addEventListener("click", async () => {
    try{
      const game = await import("./game-quiz.js");
      game.wireGameUI?.();      // safe if called multiple times
      await game.startQuizGame?.();
    } catch(e){ showFatal(e); }
  });

  // Game over modal button (basic)
  byId("gameOverOk")?.addEventListener("click", async () => {
    try{
      const ui2 = await import("./ui.js");
      ui2.hideGameOverModal?.();
      // reset tab vis will happen via setActiveTab + game state
      go("home");
    } catch(e){ showFatal(e); }
  });

  // Wire settings UI
  try{
    settingsMod.initSettingsUI?.(() => {
      // update home pill and game tab visibility
      updateHomePill();
      ui.setActiveTab(document.querySelector(".view.active")?.id === "viewGame" ? "game" : "home");
    });
  } catch(e){ showFatal(e); }

  function updateHomePill(){
    const pill = byId("homePill");
    if(!pill) return;
    const enabled = settingsMod.getEnabledGrades().filter(g => g >= 1 && g <= 6);
    const gTxt = enabled.length ? enabled.map(g => `G${g}`).join("+") : "none";
    const ovCount = settingsMod.getOverrideCount?.() ?? 0;
    const comp = settingsMod.isCompoundEnabled?.() ? "compound:on" : "compound:off";
    pill.textContent = `Active: ${gTxt} • overrides:${ovCount} • ${comp}`;
  }

  updateHomePill();

  // Default view
  go("home");
}

boot().catch(showFatal);
