import { execFileSync } from "node:child_process";
execFileSync("git", ["apply", "--whitespace=nowarn", "cloud/daytona-batch-fix.patch"], {
  stdio: "inherit",
  timeout: 15_000,
});
console.log("[NOVENS CLOUD] Daytona multi-issue batch fix applied.");

import fs from "node:fs";
function replaceGuidance(file, before, after) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(after)) return;
  if (!src.includes(before)) throw new Error("Workspace guidance source mismatch: " + file);
  fs.writeFileSync(file, src.replace(before, after));
}
replaceGuidance(
  "src/agent/value-system-prompt.ts",
  "Daytona compute is available. The exec/write_file/read_file tools operate on an isolated Daytona workspace for the parent. Use that workspace to build, run and test real code. Do not merely plan work that can be executed there. Child creation remains governed by the economic gate.",
  "Daytona compute is available. exec/write_file/read_file run in a separate Daytona user workspace, not the Render host. The ~/.automaton directory, wallet, state DB, and Git mirror exist on Render only; do NOT cd into ~/.automaton or /root in Daytona. Never infer wallet balances from files inside Daytona and never read paths such as /home/automaton/.novens/usdc_balance.txt. Financial state must come only from NOVENS runtime context or an explicit wallet/balance tool when one is available; if no authoritative balance source is exposed, continue non-financial productive work instead of fabricating a filesystem source. Use pwd to locate the Daytona working directory and relative paths matching write_file, e.g. x402-microservice/server.js; run builds/tests from that project directory. After a failed command, change strategy rather than repeating it. Child creation remains governed by the economic gate."
);
replaceGuidance(
  "src/agent/tools.ts",
  "Execute a shell command in your sandbox. Returns stdout, stderr, and exit code.",
  "Run a shell command inside Daytona's isolated workspace (not Render). Do not use ~/.automaton or /root; use pwd and relative project paths. Returns stdout, stderr and exit code."
);
console.log("[NOVENS CLOUD] Daytona workspace navigation guidance applied.");
