import fs from "node:fs";

const file = "ui/app.ts";
const marker = "NOVENS_RUNTIME_SCROLL_V3";

if (!fs.existsSync(file)) {
  throw new Error("NOVENS runtime scroll patch: ui/app.ts not found");
}

let src = fs.readFileSync(file, "utf8");

if (!src.includes(marker)) {
  src += `

// NOVENS_RUNTIME_SCROLL_V3
// Preserve the operator's reading position while the live UI rerenders.
// When the operator is at the bottom, continue following new lines.
let novensRuntimeScrollTop: number | null = null;
let novensRuntimeFollowBottom = true;
let novensRuntimeUserScrollingUntil = 0;
let novensRuntimeLogElement: HTMLElement | null = null;

function novensRuntimeLogScore(el: HTMLElement): number {
  let text = el.textContent || "";
  if (text.length > 20000) text = text.slice(-20000);
  let score = 0;
  if (text.includes("[THINK]")) score += 10;
  if (text.includes("[TOOL]")) score += 8;
  if (text.includes("[TOOL RESULT]")) score += 8;
  if (text.includes("[VALUE]")) score += 7;
  if (text.includes("INFO  loop") || text.includes("INFO loop")) score += 6;
  if (text.includes("Turn ") && text.includes("tokens")) score += 4;
  return score;
}

function novensFindRuntimeLog(): HTMLElement | null {
  if (
    novensRuntimeLogElement &&
    novensRuntimeLogElement.isConnected &&
    novensRuntimeLogScore(novensRuntimeLogElement) > 0
  ) {
    return novensRuntimeLogElement;
  }

  let best: HTMLElement | null = null;
  let bestScore = 0;

  for (const node of Array.from(
    document.querySelectorAll<HTMLElement>("pre,div,section,article"),
  )) {
    const style = window.getComputedStyle(node);
    const scrollable =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      node.clientHeight >= 100 &&
      node.scrollHeight > node.clientHeight + 8;

    if (!scrollable) continue;

    const score = novensRuntimeLogScore(node);
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  }

  novensRuntimeLogElement = best;
  return best;
}

function novensCaptureRuntimeScroll(): void {
  const el = novensFindRuntimeLog();
  if (!el) return;

  novensRuntimeScrollTop = el.scrollTop;
  novensRuntimeFollowBottom =
    el.scrollHeight - el.clientHeight - el.scrollTop <= 40;

  try {
    sessionStorage.setItem(
      "novens.runtime.scroll.v3",
      JSON.stringify({
        top: novensRuntimeScrollTop,
        followBottom: novensRuntimeFollowBottom,
      }),
    );
  } catch {
    // Session storage is optional.
  }
}

function novensRestoreRuntimeScroll(): void {
  if (Date.now() < novensRuntimeUserScrollingUntil) return;

  const el = novensFindRuntimeLog();
  if (!el) return;

  if (novensRuntimeFollowBottom) {
    el.scrollTop = el.scrollHeight;
    novensRuntimeScrollTop = el.scrollTop;
    return;
  }

  if (novensRuntimeScrollTop === null) return;

  const maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
  const wanted = Math.min(novensRuntimeScrollTop, maxTop);
  if (Math.abs(el.scrollTop - wanted) > 1) {
    el.scrollTop = wanted;
  }
}

function novensMarkRuntimeUserScroll(): void {
  novensRuntimeUserScrollingUntil = Date.now() + 2500;
  requestAnimationFrame(novensCaptureRuntimeScroll);
  setTimeout(novensCaptureRuntimeScroll, 80);
  setTimeout(novensCaptureRuntimeScroll, 220);
}

try {
  const saved = JSON.parse(
    sessionStorage.getItem("novens.runtime.scroll.v3") || "null",
  ) as { top?: number; followBottom?: boolean } | null;

  if (saved && Number.isFinite(saved.top)) {
    novensRuntimeScrollTop = Math.max(0, Number(saved.top));
  }
  if (saved?.followBottom === false) {
    novensRuntimeFollowBottom = false;
  }
} catch {
  // Ignore stale/invalid storage.
}

for (const eventName of [
  "touchstart",
  "touchmove",
  "touchend",
  "wheel",
  "pointerdown",
] as const) {
  document.addEventListener(eventName, novensMarkRuntimeUserScroll, {
    passive: true,
    capture: true,
  });
}

document.addEventListener(
  "scroll",
  () => {
    if (Date.now() < novensRuntimeUserScrollingUntil) {
      novensCaptureRuntimeScroll();
    }
  },
  true,
);

new MutationObserver(() => {
  if (novensRuntimeLogElement && !novensRuntimeLogElement.isConnected) {
    novensRuntimeLogElement = null;
  }
  requestAnimationFrame(novensRestoreRuntimeScroll);
  setTimeout(novensRestoreRuntimeScroll, 50);
  setTimeout(novensRestoreRuntimeScroll, 180);
}).observe(document.documentElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

window.addEventListener("load", () => {
  setTimeout(novensRestoreRuntimeScroll, 0);
  setTimeout(novensRestoreRuntimeScroll, 250);
});

// The UI currently polls every few seconds. This catches a direct scrollTop
// reset even when the DOM node itself is reused rather than replaced.
setInterval(novensRestoreRuntimeScroll, 500);
`;
}

fs.writeFileSync(file, src);
console.log("[NOVENS CLOUD] Runtime log scroll preservation patched in ui/app.ts.");
