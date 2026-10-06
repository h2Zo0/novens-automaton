import fs from "node:fs";

const file = "src/agent/loop.ts";
let src = fs.readFileSync(file, "utf8");

if (!src.includes("NOVENS_AGENT402_WORKING_CONTEXT_V1")) {
  const marker = "      const inferenceTools = toolsToInferenceFormat(tools);";
  const at = src.indexOf(marker);
  if (at < 0) throw new Error("Agent402 working-context marker not found");

  const block = `      // NOVENS_AGENT402_WORKING_CONTEXT_V1
      // The paid model is stateless. Give it the active Automaton task and the
      // latest persisted action/result so it can advance instead of repeating
      // a successful command on every paid turn.
      if (process.env.NOVENS_AGENT402_ENABLED === "1") {
        let activeTask:
          | { id?: string; title?: string; description?: string; status?: string }
          | undefined;
        try {
          activeTask = db.raw.prepare(
            "SELECT id, title, description, status FROM task_graph " +
            "WHERE assigned_to = ? AND status IN ('assigned','running') " +
            "ORDER BY priority DESC, created_at ASC LIMIT 1",
          ).get(identity.address) as
            | { id?: string; title?: string; description?: string; status?: string }
            | undefined;
        } catch {
          activeTask = undefined;
        }

        const persisted = db.getRecentTurns(2);
        const previousTurn = persisted.length > 0
          ? persisted[persisted.length - 1]
          : undefined;
        const previousActions = previousTurn?.toolCalls
          ?.slice(-4)
          .map((tc) => {
            const outcome = tc.error
              ? "ERROR: " + tc.error
              : String(tc.result || "").slice(0, 900);
            return tc.name + "(" + JSON.stringify(tc.arguments || {}).slice(0, 500) + ") => " + outcome;
          })
          .join("\\n");

        const continuity = [
          "AUTOMATON ACTIVE TASK:",
          activeTask?.id ? "id=" + String(activeTask.id) : "id=unknown",
          activeTask?.title ? "title=" + String(activeTask.title).slice(0, 1200) : "",
          activeTask?.description ? "description=" + String(activeTask.description).slice(0, 3500) : "",
          "",
          previousActions
            ? "LAST PERSISTED ACTIONS/RESULTS:\\n" + previousActions
            : "No previous persisted tool result is available.",
          "",
          "Continue from these results. Never repeat a successful action merely because context was compacted. " +
          "If the previous action failed, diagnose that exact failure and choose a different corrective action."
        ].filter(Boolean).join("\\n");

        messages.push({ role: "user", content: continuity });
      }

`;

  src = src.slice(0, at) + block + src.slice(at);
}

if (!src.includes("[PERSIST] turn=")) {
  const marker = "      onTurnComplete?.(turn);";
  const at = src.indexOf(marker);
  if (at < 0) throw new Error("turn persistence marker not found");
  const replacement = `      onTurnComplete?.(turn);
      if (process.env.NOVENS_AGENT402_ENABLED === "1") {
        log(
          config,
          "[PERSIST] turn=" + turn.id +
            " tools=" + turn.toolCalls.length +
            " state=" + db.getAgentState(),
        );
      }`;
  src = src.replace(marker, replacement);
}

fs.writeFileSync(file, src);
console.log("[NOVENS CLOUD] Agent402 working continuity + persistence telemetry applied.");
