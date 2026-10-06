import fs from "node:fs";
import path from "node:path";

const MARKER = "NOVENS_SCROLL_PRESERVER";

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:ts|tsx|js|jsx|html)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

const candidates = [
  "src/dashboard/server.ts",
  ...walk("src/dashboard"),
  ...walk("ui"),
  ...walk("public"),
];

let target = null;
let source = "";

for (const file of [...new Set(candidates)]) {
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (text.includes(MARKER)) {
    console.log("[NOVENS CLOUD] Runtime log scroll preservation already applied.");
    process.exit(0);
  }
  if (
    text.includes("</body>") &&
    (
      text.includes("Suivi Automaton en direct") ||
      text.includes("runtime") ||
      file === "src/dashboard/server.ts"
    )
  ) {
    target = file;
    source = text;
    if (text.includes("Suivi Automaton en direct")) break;
  }
}

if (!target) {
  throw new Error("NOVENS scroll-preserver target not found");
}

const script = String.raw`
<script>
/* NOVENS_SCROLL_PRESERVER */
(function () {
  var STORAGE_KEY = "novens.runtimeLogScroll.v1";
  var desiredTop = null;
  var followBottom = true;
  var userActiveUntil = 0;

  function isScrollable(el) {
    if (!el || !el.style) return false;
    var style = window.getComputedStyle(el);
    var overflowY = style.overflowY;
    return (overflowY === "auto" || overflowY === "scroll") &&
      el.clientHeight >= 100 &&
      el.scrollHeight > el.clientHeight + 12;
  }

  function score(el) {
    var text = String(el.textContent || "");
    if (text.length > 16000) text = text.slice(-16000);
    var value = 0;
    if (text.indexOf("[THINK]") >= 0) value += 8;
    if (text.indexOf("[TOOL]") >= 0) value += 6;
    if (text.indexOf("[TOOL RESULT]") >= 0) value += 6;
    if (text.indexOf("[VALUE]") >= 0) value += 5;
    if (text.indexOf("INFO  loop") >= 0 || text.indexOf("INFO loop") >= 0) value += 4;
    if (text.indexOf("tokens") >= 0) value += 2;
    return value;
  }

  function findRuntimeLog() {
    var nodes = document.querySelectorAll("div,pre,section,article");
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!isScrollable(el)) continue;
      var s = score(el);
      if (s > bestScore) {
        best = el;
        bestScore = s;
      }
    }
    return best;
  }

  function loadState() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (typeof saved.top === "number" && isFinite(saved.top)) {
        desiredTop = Math.max(0, saved.top);
      }
      followBottom = saved.followBottom !== false;
    } catch (_) {}
  }

  function saveState(el) {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          top: desiredTop == null ? 0 : desiredTop,
          followBottom: followBottom,
          at: Date.now()
        })
      );
    } catch (_) {}
  }

  function captureUserPosition() {
    var el = findRuntimeLog();
    if (!el) return;
    desiredTop = el.scrollTop;
    followBottom =
      el.scrollHeight - el.clientHeight - el.scrollTop <= 36;
    saveState(el);
  }

  function markUserInteraction() {
    userActiveUntil = Date.now() + 1800;
    window.requestAnimationFrame(captureUserPosition);
    window.setTimeout(captureUserPosition, 80);
    window.setTimeout(captureUserPosition, 220);
  }

  function restorePosition() {
    if (Date.now() < userActiveUntil) return;
    var el = findRuntimeLog();
    if (!el) return;

    if (followBottom) {
      el.scrollTop = el.scrollHeight;
      desiredTop = el.scrollTop;
      return;
    }

    if (desiredTop == null) return;
    var maxTop = Math.max(0, el.scrollHeight - el.clientHeight);
    var target = Math.min(desiredTop, maxTop);

    if (Math.abs(el.scrollTop - target) > 2) {
      el.scrollTop = target;
    }
  }

  loadState();

  document.addEventListener("touchstart", markUserInteraction, {
    passive: true,
    capture: true
  });
  document.addEventListener("touchmove", markUserInteraction, {
    passive: true,
    capture: true
  });
  document.addEventListener("touchend", markUserInteraction, {
    passive: true,
    capture: true
  });
  document.addEventListener("wheel", markUserInteraction, {
    passive: true,
    capture: true
  });
  document.addEventListener("pointerdown", markUserInteraction, {
    passive: true,
    capture: true
  });
  document.addEventListener(
    "scroll",
    function () {
      if (Date.now() < userActiveUntil) captureUserPosition();
    },
    true
  );

  var observer = new MutationObserver(function () {
    window.requestAnimationFrame(restorePosition);
    window.setTimeout(restorePosition, 60);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener("load", function () {
    window.setTimeout(restorePosition, 0);
    window.setTimeout(restorePosition, 250);
  });

  // Guards against polling code that explicitly resets scrollTop without
  // replacing DOM nodes. It never moves the view while the user is touching it.
  window.setInterval(restorePosition, 700);
})();
</script>
`;

const index = source.lastIndexOf("</body>");
if (index < 0) {
  throw new Error("NOVENS scroll-preserver closing body not found in " + target);
}

source = source.slice(0, index) + script + source.slice(index);
fs.writeFileSync(target, source);

console.log("[NOVENS CLOUD] Runtime log scroll preservation applied to " + target);
