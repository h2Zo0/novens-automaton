import fs from "node:fs";

function replaceOnce(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  if (s.includes(to)) return;
  if (!s.includes(from)) throw new Error("Pattern not found in " + file);
  fs.writeFileSync(file, s.replace(from, to));
}

const bootstrap = "scripts/cloud-bootstrap.mjs";
replaceOnce(
  bootstrap,
  "  console.log('[NOVENS CLOUD] Persistent state already present; bootstrap skipped.');\n  process.exit(0);",
  "  console.log('[NOVENS CLOUD] Persistent state already present; bootstrap skipped.');\n  await import('../cloud/cloud-git-mirror.mjs');\n  process.exit(0);"
);
replaceOnce(
  bootstrap,
  "console.log('[NOVENS CLOUD] Encrypted persistent state restored.');",
  "console.log('[NOVENS CLOUD] Encrypted persistent state restored.');\nawait import('../cloud/cloud-git-mirror.mjs');"
);

const upstream = "src/self-mod/upstream.ts";
replaceOnce(
  upstream,
  'const REPO_ROOT = process.cwd();',
  'const REPO_ROOT = process.env.NOVENS_GIT_REPO_DIR || process.cwd();\nconst UPSTREAM_BRANCH = process.env.NOVENS_UPSTREAM_BRANCH || "main";'
);
replaceOnce(
  upstream,
  '  git(["fetch", "origin", "main", "--quiet"]);\n  const log = git(["log", "HEAD..origin/main", "--oneline"]);',
  '  git(["fetch", "origin", UPSTREAM_BRANCH, "--quiet"]);\n  const log = git(["log", `HEAD..origin/${UPSTREAM_BRANCH}`, "--oneline"]);'
);
replaceOnce(
  upstream,
  '  const log = git(["log", "HEAD..origin/main", "--format=%H %an|||%s"]);',
  '  const log = git(["log", `HEAD..origin/${UPSTREAM_BRANCH}`, "--format=%H %an|||%s"]);'
);

const hb = "src/heartbeat/tasks.ts";
replaceOnce(
  hb,
  'message: `${upstream.behind} new commit(s) on origin/main. Review with review_upstream_changes, then cherry-pick what you want with pull_upstream.`,',
  'message: `${upstream.behind} new commit(s) on origin/${repo.branch}. Review with review_upstream_changes before any deployment action.`,'
);

const tools = "src/agent/tools.ts";
replaceOnce(
  tools,
  '        if (status.behind === 0) return "Already up to date with origin/main.";',
  '        if (status.behind === 0) { const repo = getRepoInfo(); return `Already up to date with origin/${repo.branch}.`; }'
);
replaceOnce(
  tools,
  '        const { getUpstreamDiffs, checkUpstream } =\n          await import("../self-mod/upstream.js");',
  '        const { getUpstreamDiffs, checkUpstream, getRepoInfo } =\n          await import("../self-mod/upstream.js");'
);
replaceOnce(
  tools,
  '      execute: async (args, ctx) => {\n        const commit = args.commit as string | undefined;',
  '      execute: async (args, ctx) => {\n        if (process.env.NOVENS_CLOUD_MODE === "1") {\n          return "Cloud Git mirror is inspection-only at runtime. Review commits here; code changes must go through the GitHub/Render deployment pipeline.";\n        }\n        const commit = args.commit as string | undefined;'
);

console.log("[NOVENS CLOUD] Persistent Git mirror integration patch applied.");
