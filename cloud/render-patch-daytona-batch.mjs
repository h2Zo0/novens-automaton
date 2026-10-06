import { execFileSync } from "node:child_process";
execFileSync("git", ["apply", "--whitespace=nowarn", "cloud/daytona-batch-fix.patch"], {
  stdio: "inherit",
  timeout: 15_000,
});
console.log("[NOVENS CLOUD] Daytona multi-issue batch fix applied.");
