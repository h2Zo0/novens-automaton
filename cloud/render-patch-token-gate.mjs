import fs from "node:fs";

function replaceOnce(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(to)) return;
  if (!src.includes(from)) {
    throw new Error("NOVENS deterministic LLM gate target not found in " + file);
  }
  fs.writeFileSync(file, src.replace(from, to));
}

replaceOnce(
  "src/index.ts",
  `          const wakeEvent = consumeNextWakeEvent(db.raw);
          if (wakeEvent) {
            logger.info(
              \`[\${new Date().toISOString()}] Woken by \${wakeEvent.source}: \${wakeEvent.reason}\`,
            );
            db.deleteKV("sleep_until");
            break;
          }
`,
  `          const wakeEvent = consumeNextWakeEvent(db.raw);
          if (wakeEvent) {
            logger.info(
              \`[\${new Date().toISOString()}] Woken by \${wakeEvent.source}: \${wakeEvent.reason}\`,
            );
            // Preserve the semantic wake reason for the deterministic inference
            // gate. Repeated identical wake reasons do not by themselves justify
            // another LLM call when all decision-relevant state is unchanged.
            db.setKV(
              "llm_gate.last_wake_reason",
              \`\${wakeEvent.source}:\${wakeEvent.reason}\`,
            );
            db.deleteKV("sleep_until");
            break;
          }
`
);

replaceOnce(
  "src/agent/loop.ts",
  `      let toolsForInference = tools;
      if (valueMode && daytonaComputeEnabled) {
`,
  `      // Deterministic LLM gate.
      //
      // A wake-up with no new user/agent input and no change in the
      // decision-relevant runtime state must not spend another inference turn
      // merely to rediscover the same situation. This gate is intentionally
      // code-only: no model is consulted to decide whether a model is needed.
      //
      // Any new external message, goal/task transition, financial change,
      // meaningful wake reason, deployment revision, event-stream update, or
      // new non-idle tool result invalidates the fingerprint and inference
      // proceeds normally with the existing permissions and policies.
      let deterministicGateFingerprint = "";
      const gateEligible =
        !currentInput || currentInput.source === "wakeup";

      if (gateEligible) {
        const safeRows = (sql: string): unknown[] => {
          try {
            return db.raw.prepare(sql).all() as unknown[];
          } catch {
            return [];
          }
        };
        const safeRow = (sql: string): unknown => {
          try {
            return db.raw.prepare(sql).get() as unknown;
          } catch {
            return null;
          }
        };

        const recentForGate = db.getRecentTurns(8);
        const lastActionTurn = [...recentForGate]
          .reverse()
          .find((turn) =>
            turn.toolCalls.some((tc) => !isIdleOnlyTool(tc.name)),
          );

        const lastAction = lastActionTurn
          ? {
              id: lastActionTurn.id,
              tools: lastActionTurn.toolCalls
                .filter((tc) => !isIdleOnlyTool(tc.name))
                .map((tc) => ({
                  name: tc.name,
                  error: tc.error || null,
                  result: String(tc.result || "").slice(0, 512),
                })),
            }
          : null;

        const gateState = {
          deploy: process.env.RENDER_GIT_COMMIT || "",
          wakeReason: db.getKV("llm_gate.last_wake_reason") || "",
          upstreamHead: db.getKV("upstream_seen_remote_head") || "",
          financial: {
            creditsCents: financial.creditsCents,
            usdcBalance: financial.usdcBalance,
          },
          goals: safeRows(
            "SELECT id, status, expected_revenue_cents, actual_revenue_cents, deadline, completed_at FROM goals ORDER BY id",
          ),
          tasks: safeRows(
            "SELECT id, goal_id, status, assigned_to, retry_count, actual_cost_cents, completed_at FROM task_graph ORDER BY id",
          ),
          inbox: safeRow(
            "SELECT COUNT(*) AS pending FROM inbox_messages WHERE status IN ('received','in_progress')",
          ),
          latestEvent: safeRow(
            "SELECT id, type, goal_id, task_id, created_at FROM event_stream ORDER BY created_at DESC LIMIT 1",
          ),
          lastAction,
        };

        deterministicGateFingerprint = JSON.stringify(gateState);
        const previousFingerprint = db.getKV("llm_gate.last_fingerprint");

        if (
          previousFingerprint &&
          previousFingerprint === deterministicGateFingerprint
        ) {
          log(
            config,
            "[LLM GATE] Decision-relevant state unchanged; inference skipped (0 tokens).",
          );
          db.setKV(
            "sleep_until",
            new Date(Date.now() + 60_000).toISOString(),
          );
          db.setAgentState("sleeping");
          onStateChange?.("sleeping");
          running = false;
          break;
        }
      }

      let toolsForInference = tools;
      if (valueMode && daytonaComputeEnabled) {
`
);

replaceOnce(
  "src/agent/loop.ts",
  `      const routerResult = await inferenceRouter.route(
        {
          messages: messages,
          taskType: "agent_turn",
          tier: survivalTier,
          sessionId: db.getKV("session_id") || "default",
          turnId: ulid(),
          tools: inferenceTools,
        },
        (msgs, opts) => inference.chat(msgs, { ...opts, tools: inferenceTools }),
      );

      // Build a compatible response for the rest of the loop
`,
  `      const routerResult = await inferenceRouter.route(
        {
          messages: messages,
          taskType: "agent_turn",
          tier: survivalTier,
          sessionId: db.getKV("session_id") || "default",
          turnId: ulid(),
          tools: inferenceTools,
        },
        (msgs, opts) => inference.chat(msgs, { ...opts, tools: inferenceTools }),
      );

      // Record the pre-inference deterministic state only after inference
      // succeeds. A failed inference is therefore still retryable.
      if (deterministicGateFingerprint) {
        db.setKV("llm_gate.last_fingerprint", deterministicGateFingerprint);
      }

      // Build a compatible response for the rest of the loop
`
);

console.log("[NOVENS CLOUD] Deterministic LLM gate applied.");
