import fs from "node:fs";

const file = "src/index.ts";
let src = fs.readFileSync(file, "utf8");

if (!src.includes("NOVENS_OPERATOR_ONLY_STOP_V1")) {
  const preferred = "      // NOVENS_RESPECT_COOLDOWN_V1";
  const fallback = "      // Agent loop exited (sleeping or dead)";
  const at = src.indexOf(preferred) >= 0
    ? src.indexOf(preferred)
    : src.indexOf(fallback);

  if (at < 0) {
    throw new Error("NOVENS operator-only-stop insertion point not found");
  }

  const block = `      // NOVENS_OPERATOR_ONLY_STOP_V1
      // START is an operator intent, not a single agent turn. While the
      // dashboard-controlled runtime is armed, internal sleep/cooldown/idle
      // states must never terminate the process. The dashboard STOP action
      // remains authoritative because it terminates this child externally.
      if (process.env.NOVENS_UI_CONTROLLED === "1") {
        const operatorState = db.getAgentState();

        if (operatorState !== "dead") {
          const sleepUntilRaw = db.getKV("sleep_until");
          const sleepUntilMs = sleepUntilRaw
            ? Date.parse(sleepUntilRaw)
            : Number.NaN;

          if (
            operatorState === "sleeping" &&
            Number.isFinite(sleepUntilMs) &&
            sleepUntilMs > Date.now()
          ) {
            const waitMs = Math.max(
              250,
              Math.min(60_000, sleepUntilMs - Date.now()),
            );
            logger.info(
              \`[NOVENS KEEPALIVE] Internal cooldown \${Math.ceil(waitMs / 1000)}s; runtime stays alive.\`,
            );
            await sleep(waitMs);
          } else if (operatorState === "sleeping") {
            // Sleeping means "nothing useful to do this instant", not STOP.
            await sleep(1_000);
          }

          const afterWait = db.getAgentState();
          if (afterWait === "sleeping") {
            db.deleteKV("sleep_until");
            db.setAgentState("waking");
          }

          logger.info(
            "[NOVENS KEEPALIVE] START intent still active; continuing without process exit.",
          );
          continue;
        }
      }

`;

  src = src.slice(0, at) + block + src.slice(at);
}

fs.writeFileSync(file, src);
console.log("[NOVENS CLOUD] Operator-only STOP runtime keepalive applied.");
