import fs from "node:fs";

const file = "src/agent/loop.ts";
let src = fs.readFileSync(file, "utf8");

if (!src.includes("NOVENS_AGENT402_COMPACT_CONTEXT_V1")) {
  const oldBlock = `      const inferenceTools = toolsToInferenceFormat(tools);
      const routerResult = await inferenceRouter.route(
        {
          messages: messages,
          taskType: "agent_turn",
          tier: survivalTier,
          sessionId: db.getKV("session_id") || "default",
          turnId: ulid(),
          tools: inferenceTools,
        },
        (msgs, opts) => inference.chat(msgs, { ...opts, tools: inferenceTools }),
      );`;

  const newBlock = `      let inferenceTools = toolsToInferenceFormat(tools);

      // NOVENS_AGENT402_COMPACT_CONTEXT_V1
      // Agent402 is a paid specialist, not the persistent control loop. Send it
      // only the active task, a tiny amount of verified recent work, and the
      // minimum tool surface needed to act. This prevents 70k+ character turns.
      if (process.env.NOVENS_AGENT402_ENABLED === "1") {
        const activeTask = db.raw.prepare(
          "SELECT id, title, description, status, priority FROM task_graph " +
          "WHERE assigned_to = ? AND status IN ('assigned','running') " +
          "ORDER BY priority DESC, created_at ASC LIMIT 1",
        ).get(identity.address) as
          | { id?: string; title?: string; description?: string; status?: string; priority?: number }
          | undefined;

        const essentialToolNames = new Set([
          "exec",
          "read_file",
          "write_file",
          "edit_own_file",
          "install_npm_package",
          "git_status",
          "git_diff",
          "git_commit",
          "git_push",
          "web_fetch",
          "x402_fetch",
          "check_usdc_balance",
          "create_goal",
          "get_plan",
          "complete_task",
          "orchestrator_status",
        ]);
        inferenceTools = inferenceTools.filter((tool) =>
          essentialToolNames.has(tool.function.name),
        );

        const recentWork = db.getRecentTurns(4)
          .slice(-4)
          .map((turn) => {
            const calls = (turn.toolCalls || [])
              .slice(0, 4)
              .map((tc) =>
                tc.name + ": " +
                String(tc.error || tc.result || "").replace(/\\s+/g, " ").slice(0, 700),
              )
              .join("\\n");
            const thought = String(turn.thinking || "")
              .replace(/\\s+/g, " ")
              .slice(0, 500);
            return [thought, calls].filter(Boolean).join("\\n");
          })
          .filter(Boolean)
          .join("\\n---\\n")
          .slice(-4_000);

        const compactSystem = [
          "You are the reasoning specialist inside NOVENS Automaton.",
          "Automaton remains the orchestrator and authority. You are invoked only when semantic reasoning is required.",
          "Make one concrete productive decision at a time and use a tool when execution is needed.",
          "The exec/read_file/write_file tools operate through NOVENS' Daytona-backed execution layer.",
          "Never fabricate execution, balances, files, deployments, or results; verify with tools.",
          "Preserve protected state, wallet material, credentials, constitution and safety controls.",
          "Do not spend money merely to create activity. Paid actions must serve the active task.",
          "Do not repeat a failed action unchanged. Inspect the error and choose a different corrective action.",
          "When the active task is genuinely complete, call complete_task with its real result.",
          "Prefer the smallest sufficient action and return no long essay when a tool call can advance the task."
        ].join(" ");

        const taskText = activeTask?.id
          ? [
              "ACTIVE AUTOMATON TASK",
              "id: " + String(activeTask.id),
              "status: " + String(activeTask.status || "assigned"),
              "priority: " + String(activeTask.priority ?? ""),
              "title: " + String(activeTask.title || "").slice(0, 1_500),
              "description: " + String(activeTask.description || "").slice(0, 4_500),
            ].join("\\n")
          : "No active self-assigned Automaton task was found. Do not invent one.";

        messages = [
          { role: "system", content: compactSystem },
          {
            role: "user",
            content:
              taskText +
              (recentWork ? "\\n\\nRECENT VERIFIED WORK\\n" + recentWork : "") +
              "\\n\\nChoose the next concrete action that advances this task.",
          },
        ];

        const compactMessageChars = messages.reduce(
          (sum, message) => sum + String(message.content ?? "").length,
          0,
        );
        const compactToolChars = JSON.stringify(inferenceTools).length;
        log(
          config,
          "[AGENT402 COMPACT] message_chars=" + compactMessageChars +
            " tools=" + inferenceTools.length +
            " tool_schema_chars=" + compactToolChars,
        );
      }

      const routerResult = await inferenceRouter.route(
        {
          messages: messages,
          taskType: "agent_turn",
          tier: survivalTier,
          sessionId: db.getKV("session_id") || "default",
          turnId: ulid(),
          tools: inferenceTools,
        },
        (msgs, opts) => inference.chat(msgs, { ...opts, tools: inferenceTools }),
      );`;

  if (!src.includes(oldBlock)) {
    throw new Error("Agent402 compact-context insertion target not found");
  }
  src = src.replace(oldBlock, newBlock);
  fs.writeFileSync(file, src);
}

console.log("[NOVENS CLOUD] Agent402 compact reasoning context applied.");
