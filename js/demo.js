export const FILE_VERSION = "1.01";

/**
 * demo.js
 * Simple prototype for Drag & Drop mechanics using the word 女の子.
 *
 * Segments format example: "女:おんな|の|子:こ"
 *
 * Change in 1.01:
 * - ALL segments (including kana-only) are rendered as visible drop-zones.
 * - Kana-only zones will highlight on hover, but any drop onto them is treated as WRONG.
 * - Hover + drop hit-testing is based on the dragged glyph position (not the finger).
 */

// NOTE: You no longer need DRAG_OFFSET_Y because the lift is handled in CSS (.dd-drag transform).
// Keeping this file free of JS offsets makes glyph-based hit-testing exact.
function parseSegments(segmentsStr) {
  const rawTokens = (segmentsStr || "").split("|").filter((t) => t.length > 0);

  /**
   * Returns tokens where every token becomes a "zone" with:
   * - displayText: what is shown in the prompt initially (hiragana / kana)
   * - expectedKanji: kanji that must be dropped here, OR null for kana-only zones (always wrong if dropped on)
   */
  /** @type {Array<{type:'zone', id:number, displayText:string, expectedKanji:string|null}>} */
  const tokens = [];

  let nextId = 0;
  for (const raw of rawTokens) {
    const i = raw.indexOf(":");
    if (i !== -1) {
      const kanji = raw.slice(0, i);
      const reading = raw.slice(i + 1);
      tokens.push({ type: "zone", id: nextId++, displayText: reading, expectedKanji: kanji });
    } else {
      // kana-only segment becomes a zone with no expected kanji
      tokens.push({ type: "zone", id: nextId++, displayText: raw, expectedKanji: null });
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

  /**
   * Zone model:
   * - expectedKanji: string|null
   *   - string => correct tile is that kanji
   *   - null   => kana-only zone; dropping anything is WRONG
   */
  /** @type {Map<number, {id:number, expectedKanji:string|null, el:HTMLSpanElement, filled:boolean, originalText:string}>} */
  let zones = new Map();

  function render() {
    // Clear prompt feedback
    promptEl.classList.remove("correct", "wrong");
    promptTextEl.textContent = "";
    zones = new Map();

    // Reset choice overlays
    for (const btn of choicesEl.querySelectorAll("button.choice")) {
      btn.classList.remove("correct", "wrong", "selected");
      btn.style.touchAction = "none";
    }

    // Render tokens (ALL become zones now)
    const tokens = parseSegments(segments);

    for (const t of tokens) {
      const span = document.createElement("span");
      span.className = "dd-zone";
      span.dataset.zoneId = String(t.id);
      span.dataset.expectedKanji = t.expectedKanji ?? ""; // empty means kana-only
      span.textContent = t.displayText;
      promptTextEl.appendChild(span);

      zones.set(t.id, {
        id: t.id,
        expectedKanji: t.expectedKanji,
        el: span,
        filled: false,
        originalText: t.displayText,
      });
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
    // Only "real" kanji zones count towards completion (expectedKanji != null)
    for (const z of zones.values()) {
      if (z.expectedKanji != null && !z.filled) return false;
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

    // Use the dragged glyph position (rendered), not the finger
    if (drag.dragEl) {
      const r = drag.dragEl.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const zoneId = hitTestZone(x, y);
      setHover(zoneId);
    } else {
      setHover(null);
    }
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

    // Only kanji zones can ever be correct
    if (z.expectedKanji == null) return;

    z.filled = true;
    z.el.classList.remove("hover");
    z.el.classList.add("filled");
    z.el.textContent = z.expectedKanji;

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

    // Decide drop target based on the dragged glyph's rendered position
    let zoneId = null;
    if (drag.dragEl) {
      const r = drag.dragEl.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      zoneId = hitTestZone(x, y);
    }

    // Drop logic
    if (zoneId != null) {
      const z = zones.get(zoneId);

      if (z && !z.filled) {
        // Kana-only zones: ANY drop here is wrong
        if (z.expectedKanji == null) {
          flashWrong();
        } else {
          // Kanji zone: correct only if matching expected kanji
          if (drag.kanji === z.expectedKanji) {
            placeCorrect(zoneId);
          } else {
            flashWrong();
          }
        }
      }
      // If zone is filled, treat like outside: snap-back (no-op)
    }
    // else dropped outside any zone: snap-back (no-op)

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
