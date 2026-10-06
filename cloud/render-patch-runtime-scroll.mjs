import fs from "node:fs";
import path from "node:path";

const MARKER = "NOVENS_SCROLL_PRESERVER";
const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "cloud",
  ".pnpm-store",
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const script = String.raw`
<script>
/* NOVENS_SCROLL_PRESERVER */
(function () {
  var STORAGE_KEY = "novens.runtimeLogScroll.v2";
  var desiredTop = null;
  var followBottom = true;
  var userActiveUntil = 0;
  var cachedLog = null;

  function isScrollable(el) {
    if (!el || !el.isConnected) return false;
    var style = window.getComputedStyle(el);
    var overflowY = style.overflowY;
    return (overflowY === "auto" || overflowY === "scroll") &&
      el.clientHeight >= 100 &&
      el.scrollHeight > el.clientHeight + 12;
  }

  function score(el) {
    var text = String(el.textContent || "");
    if (text.length > 18000) text = text.slice(-18000);
    var value = 0;
    if (text.indexOf("[THINK]") >= 0) value += 9;
    if (text.indexOf("[TOOL]") >= 0) value += 7;
    if (text.indexOf("[TOOL RESULT]") >= 0) value += 7;
    if (text.indexOf("[VALUE]") >= 0) value += 6;
    if (text.indexOf("INFO  loop") >= 0 || text.indexOf("INFO loop") >= 0) value += 5;
    if (text.indexOf("tokens") >= 0) value += 2;
    return value;
  }

  function findRuntimeLog() {
    if (cachedLog && isScrollable(cachedLog) && score(cachedLog) > 0) {
      return cachedLog;
    }
    var nodes = document.querySelectorAll("pre,div,section,article");
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
    cachedLog = best;
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

  function saveState() {
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
    saveState();
  }

  function markUserInteraction() {
    userActiveUntil = Date.now() + 2200;
    window.requestAnimationFrame(captureUserPosition);
    window.setTimeout(captureUserPosition, 80);
    window.setTimeout(captureUserPosition, 240);
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

  ["touchstart","touchmove","touchend","wheel","pointerdown"].forEach(function (type) {
    document.addEventListener(type, markUserInteraction, {
      passive: true,
      capture: true
    });
  });

  document.addEventListener(
    "scroll",
    function () {
      if (Date.now() < userActiveUntil) captureUserPosition();
    },
    true
  );

  new MutationObserver(function () {
    if (cachedLog && !cachedLog.isConnected) cachedLog = null;
    window.requestAnimationFrame(restorePosition);
    window.setTimeout(restorePosition, 80);
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true
  });

  window.addEventListener("load", function () {
    window.setTimeout(restorePosition, 0);
    window.setTimeout(restorePosition, 250);
  });

  // Also catches polling code that changes scrollTop without replacing nodes.
  window.setInterval(restorePosition, 700);
})();
</script>
`;

const files = walk(".");
const htmlFiles = files.filter((file) => /\.html?$/i.test(file));
let patched = 0;

for (const file of htmlFiles) {
  let source;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (!source.includes("</body>") || source.includes(MARKER)) continue;
  const at = source.lastIndexOf("</body>");
  source = source.slice(0, at) + script + source.slice(at);
  fs.writeFileSync(file, source);
  patched++;
}

if (patched === 0) {
  // Some builds embed the whole HTML page in a TS/JS template.
  const embedded = files.filter((file) => /\.(?:ts|tsx|js|jsx|mjs)$/i.test(file));
  for (const file of embedded) {
    let source;
    try {
      const stat = fs.statSync(file);
      if (stat.size > 2_000_000) continue;
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (
      !source.includes("</body>") ||
      source.includes(MARKER) ||
      !(
        source.includes("runtime-control") ||
        source.includes("Automaton") ||
        source.includes("runtimeLines")
      )
    ) continue;

    const at = source.lastIndexOf("</body>");
    source = source.slice(0, at) + script + source.slice(at);
    fs.writeFileSync(file, source);
    patched++;
  }
}

if (patched === 0) {
  throw new Error("NOVENS scroll-preserver could not find any served HTML entry point");
}

console.log(
  "[NOVENS CLOUD] Runtime log scroll preservation applied to " +
  patched +
  " HTML entry point(s)."
);
