import fs from "node:fs";

function replaceOnce(file, from, to, marker = to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(marker)) return;
  if (!src.includes(from)) {
    throw new Error("NOVENS runnable-work hold patch target not found in " + file);
  }
  fs.writeFileSync(file, src.replace(from, to));
}

// 1) A persisted VALUE HOLD must immediately yield if productive parent work
// still exists. This also releases stale holds left by previous deployments.
replaceOnce(
  "src/index.ts",
  `      const valueHoldUntilRaw = db.getKV("value_guard.hold_until");
      if (valueHoldUntilRaw) {
        const holdUntilMs = Date.parse(valueHoldUntilRaw);
`,
  `      const valueHoldUntilRaw = db.getKV("value_guard.hold_until");
      if (valueHoldUntilRaw) {
        let runnableProductiveWork = false;
        try {
          const parentTask = db.raw.prepare(
            "SELECT 1 FROM task_graph t " +
            "JOIN goals g ON g.id = t.goal_id " +
            "WHERE g.status = 'active' " +
            "AND t.status IN ('pending','assigned','running') " +
            "AND (t.assigned_to IS NULL OR t.assigned_to = '' OR t.assigned_to = ?) " +
            "LIMIT 1",
          ).get(identity.address);

          const goalNeedsPlanning = db.raw.prepare(
            "SELECT 1 FROM goals g " +
            "WHERE g.status = 'active' " +
            "AND NOT EXISTS (" +
              "SELECT 1 FROM task_graph t " +
              "WHERE t.goal_id = g.id " +
              "AND t.status IN ('pending','assigned','running')" +
            ") LIMIT 1",
          ).get();

          runnableProductiveWork = Boolean(parentTask || goalNeedsPlanning);
        } catch {
          runnableProductiveWork = false;
        }

        if (runnableProductiveWork) {
          db.deleteKV("value_guard.hold_until");
          db.deleteKV("value_guard.reason");
          db.deleteKV("value_guard.economic_value_cents");
          logger.info(
            "[VALUE CONTINUE] Runnable parent work exists; stale VALUE HOLD released.",
          );
        } else {
          const holdUntilMs = Date.parse(valueHoldUntilRaw);
`,
  "[VALUE CONTINUE] Runnable parent work exists; stale VALUE HOLD released.",
);

replaceOnce(
  "src/index.ts",
  `        db.deleteKV("value_guard.hold_until");
        db.deleteKV("value_guard.reason");
        db.deleteKV("value_guard.economic_value_cents");
      }

      // Reload skills`,
  `          db.deleteKV("value_guard.hold_until");
          db.deleteKV("value_guard.reason");
          db.deleteKV("value_guard.economic_value_cents");
        }
      }

      // Reload skills`,
  "// Reload skills",
);

// 2) When the no-value budget is reached but runnable work remains, do not
// enter the long economic HOLD. Cool down for 60s, keep the task intact, and
// retry. This limits token burn while preserving autonomous progress.
replaceOnce(
  "src/agent/loop.ts",
  `          if (noValueTurns >= maxNoValueTurns || tokensSinceValue >= maxTokensWithoutValue) {
            const holdMs = nextValueHoldMs(valueHoldCount);
            valueHoldCount += 1;
            const holdUntil = new Date(Date.now() + holdMs).toISOString();
            db.setKV("value_guard.hold_count", String(valueHoldCount));
            db.setKV("value_guard.hold_until", holdUntil);
            db.setKV("value_guard.reason", progress.reason);
            db.setKV(
              "value_guard.economic_value_cents",
              String(economyAfter?.economicValueCents ?? 0n),
            );
            db.setKV("value_guard.no_progress_turns", "0");
            noValueTurns = 0;
            log(
              config,
              \`[VALUE HOLD] No verified progress. Inference paused until \${holdUntil}; Git/economic checks continue without LLM calls.\`,
            );
            running = false;
            break;
          }
`,
  `          if (noValueTurns >= maxNoValueTurns || tokensSinceValue >= maxTokensWithoutValue) {
            let runnableProductiveWork = false;
            try {
              const parentTask = db.raw.prepare(
                "SELECT 1 FROM task_graph t " +
                "JOIN goals g ON g.id = t.goal_id " +
                "WHERE g.status = 'active' " +
                "AND t.status IN ('pending','assigned','running') " +
                "AND (t.assigned_to IS NULL OR t.assigned_to = '' OR t.assigned_to = ?) " +
                "LIMIT 1",
              ).get(identity.address);

              const goalNeedsPlanning = db.raw.prepare(
                "SELECT 1 FROM goals g " +
                "WHERE g.status = 'active' " +
                "AND NOT EXISTS (" +
                  "SELECT 1 FROM task_graph t " +
                  "WHERE t.goal_id = g.id " +
                  "AND t.status IN ('pending','assigned','running')" +
                ") LIMIT 1",
              ).get();

              runnableProductiveWork = Boolean(parentTask || goalNeedsPlanning);
            } catch {
              runnableProductiveWork = false;
            }

            if (runnableProductiveWork) {
              const retryAt = new Date(Date.now() + 60_000).toISOString();
              db.deleteKV("value_guard.hold_until");
              db.deleteKV("value_guard.reason");
              db.deleteKV("value_guard.economic_value_cents");
              db.setKV("sleep_until", retryAt);
              db.setAgentState("sleeping");
              onStateChange?.("sleeping");
              log(
                config,
                \`[VALUE CONTINUE] Runnable work remains. No long HOLD; 60s zero-token cooldown before the next reasoning opportunity.\`,
              );
              running = false;
              break;
            }

            const holdMs = nextValueHoldMs(valueHoldCount);
            valueHoldCount += 1;
            const holdUntil = new Date(Date.now() + holdMs).toISOString();
            db.setKV("value_guard.hold_count", String(valueHoldCount));
            db.setKV("value_guard.hold_until", holdUntil);
            db.setKV("value_guard.reason", progress.reason);
            db.setKV(
              "value_guard.economic_value_cents",
              String(economyAfter?.economicValueCents ?? 0n),
            );
            db.setKV("value_guard.no_progress_turns", "0");
            noValueTurns = 0;
            log(
              config,
              \`[VALUE HOLD] No runnable productive work and no verified progress. Inference paused until \${holdUntil}; deterministic checks continue without LLM calls.\`,
            );
            running = false;
            break;
          }
`,
  "[VALUE CONTINUE] Runnable work remains.",
);

// 3) The deterministic inference gate already throttles active parent work.
// Align its retry bucket with the 60s productive cooldown rather than 5min.
replaceOnce(
  "src/agent/loop.ts",
  `    activeWorkRetryBucket:
      activeParentWork && !valueHoldActive
        ? Math.floor(Date.now() / 300_000)
        : 0,`,
  `    activeWorkRetryBucket:
      activeParentWork && !valueHoldActive
        ? Math.floor(Date.now() / 60_000)
        : 0,`,
  "Math.floor(Date.now() / 60_000)",
);

console.log("[NOVENS CLOUD] VALUE HOLD now yields to runnable productive work.");
