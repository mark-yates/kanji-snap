export const FILE_VERSION = "1.00";

/**
 * demo.js
 * Simple prototype for Drag & Drop mechanics using the word 女の子.
 *
 * Segments format example: "女:おんな|の|子:こ"
 */

function parseSegments(segmentsStr) {
  const rawTokens = (segmentsStr || "").split("|").filter((t) => t.length > 0);

  /** @type {Array<{type:'kana', text:string} | {type:'zone', kanji:string, reading:string, id:number}>} */
  const tokens = [];

  let nextId = 0;
  for (const raw of rawTokens) {
    const i = raw.indexOf(":");
    if (i !== -1) {
      const kanji = raw.slice(0, i);
      const reading = raw.slice(i + 1);
      tokens.push({ type: "zone", kanji, reading, id: nextId++ });
    } else {
      tokens.push({ type: "kana", text: raw });
    }
  }

  return tokens;
}

function q(id) {
  return /** @type {HTMLElement|null} */ (document.getElementById(id));
}

export function initDemoUI() {
  const promptEl = q("demoPrompt");
  const promptTextEl = q("demoPromptText");
  const choicesEl = q("demoChoices");
  const resetBtn = q("demoResetBtn");

  if (!promptEl || !promptTextEl || !choicesEl) return;

  // Hard-coded test word: 女の子
  const segments = "女:おんな|の|子:こ";

  /** @type {Map<number, {id:number, kanji:string, el:HTMLSpanElement, filled:boolean}>} */
  let zones = new Map();

  function render() {
    // Clear
    promptEl.classList.remove("correct", "wrong");
    promptTextEl.textContent = "";
    zones = new Map();

    // Reset choice overlays
    for (const btn of choicesEl.querySelectorAll("button.choice")) {
      btn.classList.remove("correct", "wrong", "selected");
      // Better touch behaviour while dragging
      btn.style.touchAction = "none";
    }

    // Render tokens
    const tokens = parseSegments(segments);

    for (const t of tokens) {
      if (t.type === "kana") {
        const span = document.createElement("span");
        span.textContent = t.text;
        promptTextEl.appendChild(span);
      } else {
        const span = document.createElement("span");
        span.className = "dd-zone";
        span.dataset.zoneId = String(t.id);
        span.dataset.kanji = t.kanji;
        span.textContent = t.reading;
        promptTextEl.appendChild(span);

        zones.set(t.id, { id: t.id, kanji: t.kanji, el: span, filled: false });
      }
    }
  }

  /** Drag state */
  const drag = {
    active: false,
    pointerId: null,
    kanji: "",
    originBtn: /** @type {HTMLButtonElement|null} */ (null),
    dragEl: /** @type {HTMLElement|null} */ (null),
    hoveredZoneId: /** @type {number|null} */ (null),
  };

  function clearHover() {
    if (drag.hoveredZoneId == null) return;
    const z = zones.get(drag.hoveredZoneId);
    z?.el.classList.remove("hover");
    drag.hoveredZoneId = null;
  }

  function setHover(zoneId) {
    if (drag.hoveredZoneId === zoneId) return;
    clearHover();
    if (zoneId == null) return;

    const z = zones.get(zoneId);
    if (!z || z.filled) return;

    z.el.classList.add("hover");
    drag.hoveredZoneId = zoneId;
  }

  /** @returns {number|null} */
  function hitTestZone(clientX, clientY) {
    let el = document.elementFromPoint(clientX, clientY);
    while (el && el !== document.body) {
      if (el instanceof HTMLSpanElement && el.classList.contains("dd-zone")) {
        const id = Number(el.dataset.zoneId);
        return Number.isFinite(id) ? id : null;
      }
      el = el.parentElement;
    }
    return null;
  }

  function allFilled() {
    for (const z of zones.values()) {
      if (!z.filled) return false;
    }
    return true;
  }

  function beginDrag(btn, kanji, e) {
    // If finished, don't start new drags (keeps the demo simple).
    if (promptEl.classList.contains("correct")) return;

    drag.active = true;
    drag.pointerId = e.pointerId;
    drag.kanji = kanji;
    drag.originBtn = btn;

    // Floating glyph
    const ghost = document.createElement("div");
    ghost.className = "dd-drag";
    ghost.textContent = kanji;
    document.body.appendChild(ghost);
    drag.dragEl = ghost;

    // Initial position
    moveDrag(e);

    window.addEventListener("pointermove", moveDrag, { passive: false });
    window.addEventListener("pointerup", endDrag, { passive: false });
    window.addEventListener("pointercancel", endDrag, { passive: false });

    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function moveDrag(e) {
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    e.preventDefault();

    if (drag.dragEl) {
      drag.dragEl.style.left = `${e.clientX}px`;
      drag.dragEl.style.top = `${e.clientY}px`;
    }

    const zoneId = hitTestZone(e.clientX, e.clientY);
    setHover(zoneId);
  }

  function flashWrong() {
    promptEl.classList.remove("correct");
    promptEl.classList.add("wrong");
    drag.originBtn?.classList.add("wrong");

    window.setTimeout(() => {
      promptEl.classList.remove("wrong");
      drag.originBtn?.classList.remove("wrong");
    }, 650);
  }

  function placeCorrect(zoneId) {
    const z = zones.get(zoneId);
    if (!z || z.filled) return;

    z.filled = true;
    z.el.classList.remove("hover");
    z.el.classList.add("filled");
    z.el.textContent = z.kanji;

    if (allFilled()) {
      promptEl.classList.remove("wrong");
      promptEl.classList.add("correct");
    }
  }

  function endDrag(e) {
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    e.preventDefault();

    window.removeEventListener("pointermove", moveDrag);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);

    const zoneId = drag.hoveredZoneId;

    // Drop logic
    if (zoneId != null) {
      const z = zones.get(zoneId);
      if (z && !z.filled) {
        if (drag.kanji === z.kanji) {
          placeCorrect(zoneId);
        } else {
          flashWrong();
        }
      }
    }

    // Cleanup
    clearHover();

    drag.dragEl?.remove();
    drag.dragEl = null;
    drag.active = false;
    drag.pointerId = null;
    drag.kanji = "";
    drag.originBtn = null;
  }

  function wireChoices() {
    for (const btn of choicesEl.querySelectorAll("button.choice")) {
      const kanji = btn.querySelector(".choiceKanji")?.textContent?.trim();
      if (!kanji) continue;

      btn.addEventListener("pointerdown", (e) => {
        // Left mouse or touch/pen
        if (e.button != null && e.button !== 0) return;
        beginDrag(/** @type {HTMLButtonElement} */ (btn), kanji, e);
      });
    }
  }

  resetBtn?.addEventListener("click", () => {
    render();
  });

  // Init
  render();
  wireChoices();
}
