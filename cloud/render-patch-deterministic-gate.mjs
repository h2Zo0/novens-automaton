import fs from "node:fs";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content);
}

function insertBeforeOnce(file, needle, insertion, marker) {
  const src = read(file);
  if (src.includes(marker)) return;
  const index = src.indexOf(needle);
  if (index < 0) throw new Error("NOVENS deterministic-gate insertion target not found in " + file);
  write(file, src.slice(0, index) + insertion + src.slice(index));
}

function insertAfterOnce(file, needle, insertion, marker) {
  const src = read(file);
  if (src.includes(marker)) return;
  const index = src.indexOf(needle);
  if (index < 0) throw new Error("NOVENS deterministic-gate insertion target not found in " + file);
  const end = index + needle.length;
  write(file, src.slice(0, end) + insertion + src.slice(end));
}

function replaceOnce(file, from, to, marker) {
  const src = read(file);
  if (src.includes(marker || to)) return;
  if (!src.includes(from)) throw new Error("NOVENS deterministic-gate replacement target not found in " + file);
  write(file, src.replace(from, to));
}

// Hashing is local and deterministic; it never invokes an LLM.
replaceOnce(
  "src/agent/loop.ts",
  'import path from "node:path";',
  'import path from "node:path";\nimport { createHash } from "node:crypto";',
  'import { createHash } from "node:crypto";',
);

// Keep one reusable fingerprint variable in the existing loop scope.
insertAfterOnce(
  "src/agent/loop.ts",
  "  let idleToolTurns = 0;",
  '\n  let llmGateFingerprint = "";',
  'let llmGateFingerprint = "";',
);

// Preserve meaningful wake reasons so the gate cannot hide a genuine new event.
replaceOnce(
  "src/index.ts",
  `            logger.info(
              \`[\${new Date().toISOString()}] Woken by \${wakeEvent.source}: \${wakeEvent.reason}\`,
            );
            db.deleteKV("sleep_until");
`,
  `            logger.info(
              \`[\${new Date().toISOString()}] Woken by \${wakeEvent.source}: \${wakeEvent.reason}\`,
            );
            db.setKV(
              "llm_gate.last_wake_reason",
              \`\${wakeEvent.source}:\${wakeEvent.reason}\`,
            );
            db.deleteKV("sleep_until");
`,
  '"llm_gate.last_wake_reason"',
);

// Gate only automatic wakeups. User/agent/system inputs keep their existing path.
insertBeforeOnce(
  "src/agent/loop.ts",
  "      // Capture input before clearing\n",
  `      // Deterministic LLM gate: being alive is not by itself a reason to
      // spend inference. New external input always bypasses this gate.
      llmGateFingerprint = buildLlmGateFingerprint(
        db,
        identity.address,
        financial,
      );
      const automaticWake =
        !pendingInput || pendingInput.source === "wakeup";
      const previousInferenceState =
        db.getKV("llm_gate.last_inference_state");

      if (
        automaticWake &&
        previousInferenceState === llmGateFingerprint
      ) {
        const skipped = Number.parseInt(
          db.getKV("llm_gate.skipped") || "0",
          10,
        );
        db.setKV(
          "llm_gate.skipped",
          String(Number.isFinite(skipped) ? skipped + 1 : 1),
        );
        log(
          config,
          "[LLM GATE] Unchanged decision state. Skipping inference; runtime remains event-driven.",
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

`,
  "[LLM GATE] Unchanged decision state.",
);

// Persist only after a completed inference turn. Any non-idle tool result,
// including an error, is new information and permits a follow-up reasoning step.
insertAfterOnce(
  "src/agent/loop.ts",
  "      onTurnComplete?.(turn);",
  `

      if (llmGateFingerprint) {
        db.setKV(
          "llm_gate.last_inference_state",
          llmGateFingerprint,
        );
        const allowed = Number.parseInt(
          db.getKV("llm_gate.allowed") || "0",
          10,
        );
        db.setKV(
          "llm_gate.allowed",
          String(Number.isFinite(allowed) ? allowed + 1 : 1),
        );
      }

      if (
        turn.toolCalls.some(
          (tc) => !isIdleOnlyTool(tc.name),
        )
      ) {
        const previousProgress = Number.parseInt(
          db.getKV("llm_gate.progress_seq") || "0",
          10,
        );
        db.setKV(
          "llm_gate.progress_seq",
          String(
            Number.isFinite(previousProgress)
              ? previousProgress + 1
              : 1
          ),
        );
      }
`,
  '"llm_gate.last_inference_state"',
);

insertBeforeOnce(
  "src/agent/loop.ts",
  "function log(_config: AutomatonConfig, message: string): void {",
  `function buildLlmGateFingerprint(
  db: AutomatonDatabase,
  identityAddress: string,
  financial: FinancialState,
): string {
  const holdUntil = db.getKV("value_guard.hold_until") || "";
  const holdUntilMs = holdUntil ? Date.parse(holdUntil) : Number.NaN;

  const snapshot: Record<string, unknown> = {
    renderCommit: process.env.RENDER_GIT_COMMIT || "",
    paperMode: process.env.NOVENS_PAPER_MODE === "1",
    daytonaConfigured: !!process.env.DAYTONA_API_KEY,
    daytonaTarget: process.env.DAYTONA_TARGET || "",
    identityAddress,
    creditsCents: financial.creditsCents,
    usdcCents: Math.round(financial.usdcBalance * 100),
    progressSeq: db.getKV("llm_gate.progress_seq") || "0",
    wakeReason: db.getKV("llm_gate.last_wake_reason") || "",
    valueHoldUntil: holdUntil,
    valueHoldExpired:
      Number.isFinite(holdUntilMs) && Date.now() >= holdUntilMs,
    valueHoldReason: db.getKV("value_guard.reason") || "",
    economicValueCents:
      db.getKV("value_guard.economic_value_cents") || "",
    upstreamRemoteHead:
      db.getKV("upstream_seen_remote_head") || "",
  };

  try {
    snapshot.activeGoals = db.raw.prepare(
      "SELECT id, status, COALESCE(strategy, '') AS strategy, " +
      "expected_revenue_cents, actual_revenue_cents, " +
      "COALESCE(deadline, '') AS deadline " +
      "FROM goals WHERE status = 'active' " +
      "ORDER BY created_at ASC, id ASC",
    ).all();
  } catch {
    snapshot.activeGoals = [];
  }

  try {
    snapshot.tasks = db.raw.prepare(
      "SELECT id, goal_id, status, " +
      "COALESCE(assigned_to, '') AS assigned_to, " +
      "retry_count, estimated_cost_cents, actual_cost_cents, " +
      "COALESCE(started_at, '') AS started_at, " +
      "COALESCE(completed_at, '') AS completed_at, " +
      "COALESCE(result, '') AS result " +
      "FROM task_graph WHERE status IN " +
      "('pending', 'assigned', 'running', 'blocked', 'failed') " +
      "ORDER BY goal_id ASC, id ASC",
    ).all();
  } catch {
    snapshot.tasks = [];
  }

  return createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
}

`,
  "function buildLlmGateFingerprint(",
);

console.log("[NOVENS CLOUD] Deterministic LLM state gate applied.");
