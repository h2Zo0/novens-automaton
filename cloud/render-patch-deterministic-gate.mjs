import fs from "node:fs";

function replaceOnce(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error("NOVENS deterministic-gate patch target not found in " + file);
  fs.writeFileSync(file, src.replace(from, to));
}

replaceOnce(
  "src/agent/loop.ts",
  `import path from "node:path";`,
  `import path from "node:path";
import { createHash } from "node:crypto";`
);

replaceOnce(
  "src/agent/loop.ts",
  `    // Declared outside try so the catch block can access for retry/failure handling
    let claimedMessages: InboxMessageRow[] = [];

    try {`,
  `    // Declared outside try so the catch block can access for retry/failure handling
    let claimedMessages: InboxMessageRow[] = [];
    // Snapshot used by the deterministic LLM gate. It is persisted only after
    // a successful turn so inference errors remain retryable.
    let llmGateFingerprint: string | null = null;

    try {`
);

replaceOnce(
  "src/agent/loop.ts",
  `      // Capture input before clearing
      const currentInput = pendingInput;

      // Clear pending input after use
      pendingInput = undefined;
`,
  `      // Deterministic LLM gate: automatic wakeups with no relevant state
      // change must not spend inference merely because the process is alive.
      // External/user/agent inputs always bypass this gate.
      llmGateFingerprint = buildLlmGateFingerprint(db, identity.address, financial);
      const automaticWake = !pendingInput || pendingInput.source === "wakeup";
      const previousInferenceState = db.getKV("llm_gate.last_inference_state");

      if (automaticWake && previousInferenceState === llmGateFingerprint) {
        const skipped = Number.parseInt(db.getKV("llm_gate.skipped") || "0", 10);
        db.setKV("llm_gate.skipped", String(Number.isFinite(skipped) ? skipped + 1 : 1));
        log(
          config,
          `[LLM GATE] Unchanged decision state. Skipping inference; runtime remains event-driven.`,
        );
        db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

      // Capture input before clearing
      const currentInput = pendingInput;

      // Clear pending input after use
      pendingInput = undefined;
`
);

replaceOnce(
  "src/agent/loop.ts",
  `      onTurnComplete?.(turn);

      // Phase 2.2: Post-turn memory ingestion (non-blocking)
`,
  `      onTurnComplete?.(turn);

      // Persist the exact deterministic state for which inference was just
      // performed. A later automatic wake can reuse this decision only while
      // all relevant state remains unchanged.
      if (llmGateFingerprint) {
        db.setKV("llm_gate.last_inference_state", llmGateFingerprint);
        const allowed = Number.parseInt(db.getKV("llm_gate.allowed") || "0", 10);
        db.setKV("llm_gate.allowed", String(Number.isFinite(allowed) ? allowed + 1 : 1));
      }

      // A successful non-idle tool call is concrete progress even when the
      // task row itself has not changed yet (for example a Daytona exec or
      // file write). Bump a deterministic sequence so the next reasoning step
      // is allowed to continue the same real task.
      if (
        turn.toolCalls.some(
          (tc) => !tc.error && !isIdleOnlyTool(tc.name),
        )
      ) {
        const previousProgress = Number.parseInt(
          db.getKV("llm_gate.progress_seq") || "0",
          10,
        );
        db.setKV(
          "llm_gate.progress_seq",
          String(Number.isFinite(previousProgress) ? previousProgress + 1 : 1),
        );
      }

      // Phase 2.2: Post-turn memory ingestion (non-blocking)
`
);

replaceOnce(
  "src/agent/loop.ts",
  `function log(_config: AutomatonConfig, message: string): void {
  logger.info(message);
}
`,
  `function buildLlmGateFingerprint(
  db: AutomatonDatabase,
  identityAddress: string,
  financial: FinancialState,
): string {
  const snapshot: Record<string, unknown> = {
    // A manual START/new runtime process must always be able to perform one
    // initial reasoning turn even if the persisted business state is unchanged.
    processPid: process.pid,
    identityAddress,
    creditsCents: financial.creditsCents,
    usdcCents: Math.round(financial.usdcBalance * 100),
    progressSeq: db.getKV("llm_gate.progress_seq") || "0",
    valueHoldUntil: db.getKV("value_guard.hold_until") || "",
    valueHoldReason: db.getKV("value_guard.reason") || "",
    economicValueCents: db.getKV("value_guard.economic_value_cents") || "",
    upstreamRemoteHead: db.getKV("upstream_seen_remote_head") || "",
  };

  try {
    snapshot.activeGoals = db.raw.prepare(
      `SELECT id, status, COALESCE(strategy, '') AS strategy
       FROM goals
       WHERE status = 'active'
       ORDER BY created_at ASC, id ASC`,
    ).all();
  } catch {
    snapshot.activeGoals = [];
  }

  try {
    snapshot.tasks = db.raw.prepare(
      `SELECT id, goal_id, status,
              COALESCE(assigned_to, '') AS assigned_to,
              retry_count,
              COALESCE(started_at, '') AS started_at,
              COALESCE(completed_at, '') AS completed_at,
              COALESCE(result, '') AS result
       FROM task_graph
       WHERE status IN ('pending', 'assigned', 'running', 'blocked', 'failed')
       ORDER BY goal_id ASC, id ASC`,
    ).all();
  } catch {
    snapshot.tasks = [];
  }

  return createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
}

function log(_config: AutomatonConfig, message: string): void {
  logger.info(message);
}
`
);

console.log("[NOVENS CLOUD] Deterministic LLM state gate applied.");
