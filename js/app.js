// js/app.js

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
  const [{ state }, ui] = await Promise.all([
    import("./state.js"),
    import("./ui.js")
  ]);

  const settingsMod = await import("./settings.js");

  ui.registerServiceWorker();
  state.settings = settingsMod.loadSettings();

  // IMPORTANT: wire dictionary at startup so history taps always work
  try{
    const dict = await import("./dictionary.js");
    dict.wireDictionaryUI?.();
  } catch(e){ showFatal(e); }

  // Optional: wire kanji-picker at startup too (safe & avoids “blank page” issues)
  try{
    const picker = await import("./kanji-picker.js");
    picker.wireKanjiPickerUI?.();
  } catch(e){ /* keep silent; not required for game */ }

  function go(tab){ ui.setActiveTab(tab); }

  // Tabs
  byId("tabHome")?.addEventListener("click", () => go("home"));
  byId("tabSettings")?.addEventListener("click", () => go("settings"));
  byId("tabDictionary")?.addEventListener("click", () => {
    if(window.__openDictionary) window.__openDictionary();
    else go("dictionary");
  });
  byId("tabKanji")?.addEventListener("click", () => {
    if(window.__openKanjiPicker) window.__openKanjiPicker();
    else go("kanji");
  });
  byId("tabGame")?.addEventListener("click", () => go("game"));

  // Home buttons
  byId("goSettingsBtn")?.addEventListener("click", () => go("settings"));
  byId("goDictionaryBtn")?.addEventListener("click", () => window.__openDictionary?.() || go("dictionary"));
  byId("goKanjiBtn")?.addEventListener("click", () => window.__openKanjiPicker?.() || go("kanji"));

  // Back buttons
  byId("backHomeBtn")?.addEventListener("click", () => go("home"));
  byId("kanjiBackBtn")?.addEventListener("click", () => go("settings"));

  // Start game
  byId("startBtn")?.addEventListener("click", async () => {
    try{
      const game = await import("./game-quiz.js");
      game.wireGameUI?.();
      await game.startQuizGame?.();
    } catch(e){ showFatal(e); }
  });

  // Game over modal
  byId("gameOverOk")?.addEventListener("click", async () => {
    try{
      const ui2 = await import("./ui.js");
      ui2.hideGameOverModal?.();
      go("home");
    } catch(e){ showFatal(e); }
  });

  function updateHomePill(){
    const pill = byId("homePill");
    if(!pill) return;
    const enabled = settingsMod.getEnabledGrades().filter(g => g >= 1 && g <= 6);
    const gTxt = enabled.length ? enabled.map(g => `G${g}`).join("+") : "none";
    const ovCount = settingsMod.getOverrideCount?.() ?? 0;
    const comp = settingsMod.isCompoundEnabled?.() ? "compound:on" : "compound:off";
    pill.textContent = `Active: ${gTxt} • overrides:${ovCount} • ${comp}`;
  }

  // Wire settings (do NOT change tabs)
  try{
    settingsMod.initSettingsUI?.(() => {
      updateHomePill();
    });
  } catch(e){ showFatal(e); }

  updateHomePill();
  go("home");
}

boot().catch(showFatal);
