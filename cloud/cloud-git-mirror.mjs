import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoUrl = process.env.NOVENS_UPSTREAM_URL || "https://github.com/h2Zo0/novens-automaton.git";
const branch = process.env.NOVENS_UPSTREAM_BRANCH || "cloud-migration-20261005";
const stateDir = process.env.AUTOMATON_STATE_DIR || "/opt/render/project/.automaton";
const target = process.env.NOVENS_GIT_REPO_DIR || path.join(stateDir, "git", "novens-runtime");
const deployedCommit = process.env.RENDER_GIT_COMMIT || "";

function git(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

fs.mkdirSync(path.dirname(target), { recursive: true });

if (!fs.existsSync(path.join(target, ".git"))) {
  execFileSync("git", ["clone", "--branch", branch, "--single-branch", repoUrl, target], {
    encoding: "utf8",
    timeout: 120000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  console.log(`[NOVENS GIT] Persistent cloud clone created at ${target}`);
} else {
  git(["remote", "set-url", "origin", repoUrl], target);
  git(["fetch", "origin", branch, "--quiet"], target);
  console.log(`[NOVENS GIT] Persistent cloud clone reused at ${target}`);
}

git(["fetch", "origin", branch, "--quiet"], target);

if (/^[0-9a-f]{40}$/i.test(deployedCommit)) {
  try {
    git(["cat-file", "-e", deployedCommit + "^{commit}"], target);
    git(["checkout", "-B", branch, deployedCommit], target);
  } catch {
    git(["checkout", "-B", branch, `origin/${branch}`], target);
  }
} else {
  const current = git(["rev-parse", "--abbrev-ref", "HEAD"], target);
  if (current !== branch) git(["checkout", "-B", branch, `origin/${branch}`], target);
}

const head = git(["rev-parse", "--short=12", "HEAD"], target);
const remote = git(["rev-parse", "--short=12", `origin/${branch}`], target);
console.log(`[NOVENS GIT] branch=${branch} deployed=${head} remote=${remote}`);
