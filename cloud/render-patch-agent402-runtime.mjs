import fs from "node:fs";

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, content) { fs.writeFileSync(file, content); }

// Main turn router: account for the wallet-paid quote instead of stale OpenAI pricing.
{
  const file = "src/inference/router.ts";
  let src = read(file);

  if (!src.includes("NOVENS_AGENT402_ROUTER_COST_V1")) {
    const oldEstimate = [
      "    const estimatedCostCents = Math.ceil(",
      "      (estimatedTokens / 1000) * model.costPer1kInput / 100 +",
      "      (request.maxTokens || 1000) / 1000 * model.costPer1kOutput / 100,",
      "    );"
    ].join("\n");
    const newEstimate = [
      "    // NOVENS_AGENT402_ROUTER_COST_V1",
      "    const estimatedCostCents =",
      '      process.env.NOVENS_AGENT402_ENABLED === "1"',
      '        ? Math.ceil(Number(process.env.NOVENS_AGENT402_MAX_CALL_CENTS || "25"))',
      "        : Math.ceil(",
      "            (estimatedTokens / 1000) * model.costPer1kInput / 100 +",
      "            (request.maxTokens || 1000) / 1000 * model.costPer1kOutput / 100,",
      "          );"
    ].join("\n");
    if (!src.includes(oldEstimate)) throw new Error("Agent402 router estimate target missing");
    src = src.replace(oldEstimate, newEstimate);

    const oldActual = [
      "    const actualCostCents = Math.ceil(",
      "      (inputTokens / 1000) * model.costPer1kInput / 100 +",
      "      (outputTokens / 1000) * model.costPer1kOutput / 100,",
      "    );"
    ].join("\n");
    const newActual = [
      "    const paidWalletCost = Number((response as any).walletCostCents);",
      "    const actualCostCents =",
      '      process.env.NOVENS_AGENT402_ENABLED === "1" && Number.isFinite(paidWalletCost)',
      "        ? Math.max(0, paidWalletCost)",
      "        : Math.ceil(",
      "            (inputTokens / 1000) * model.costPer1kInput / 100 +",
      "            (outputTokens / 1000) * model.costPer1kOutput / 100,",
      "          );"
    ].join("\n");
    if (!src.includes(oldActual)) throw new Error("Agent402 router actual-cost target missing");
    src = src.replace(oldActual, newActual);

    const oldResult = [
      "      content: response.message?.content || \"\",",
      "      model: model.modelId,",
      "      provider: model.provider,"
    ].join("\n");
    const newResult = [
      "      content: response.message?.content || \"\",",
      "      model:",
      '        process.env.NOVENS_AGENT402_ENABLED === "1"',
      '          ? String((response as any).model || process.env.NOVENS_AGENT402_MODEL || model.modelId)',
      "          : model.modelId,",
      "      provider:",
      '        process.env.NOVENS_AGENT402_ENABLED === "1" ? "other" : model.provider,'
    ].join("\n");
    if (!src.includes(oldResult)) throw new Error("Agent402 router result target missing");
    src = src.replace(oldResult, newResult);
  }

  write(file, src);
}

// Deterministic-only still blocks gratuitous reasoning, but a concrete self-assigned
// task is allowed to buy one reasoning turn through Agent402.
{
  const file = "src/agent/loop.ts";
  let src = read(file);
  const start = src.indexOf("      // NOVENS_DETERMINISTIC_ONLY_GATE_V1");
  const end = src.indexOf("      // ── Inference Call (via router when available) ──", start);
  if (start < 0 || end < 0) throw new Error("Agent402 deterministic gate markers missing");

  const replacement = [
    "      // NOVENS_DETERMINISTIC_ONLY_GATE_V2",
    '      if (process.env.NOVENS_DETERMINISTIC_ONLY === "1") {',
    "        let reasoningTask: { id?: string; title?: string; description?: string } | undefined;",
    "        try {",
    "          reasoningTask = db.raw.prepare(",
    '            "SELECT id, title, description FROM task_graph " +',
    '            "WHERE assigned_to = ? AND status IN (\'assigned\',\'running\') " +',
    '            "ORDER BY priority DESC, created_at ASC LIMIT 1",',
    "          ).get(identity.address) as",
    "            | { id?: string; title?: string; description?: string }",
    "            | undefined;",
    "        } catch {",
    "          reasoningTask = undefined;",
    "        }",
    "",
    '        const agent402Ready = process.env.NOVENS_AGENT402_ENABLED === "1";
        const previousReasoningTask = db.getKV("reasoning_required.task_id");
        const previousReasoningAt = Number(db.getKV("reasoning_required.at_ms") || "0");
        const reasoningCooldownMs = 15_000;
        const duplicateReasoning = Boolean(
          reasoningTask?.id && previousReasoningTask === String(reasoningTask.id) &&
          Number.isFinite(previousReasoningAt) && Date.now() - previousReasoningAt < reasoningCooldownMs
        );',
    "",
    "        if (reasoningTask?.id && agent402Ready && !duplicateReasoning) {",
    '          db.setKV("reasoning_required.task_id", String(reasoningTask.id));
          db.setKV("reasoning_required.at_ms", String(Date.now()));',
    "          db.setKV(",
    '            "reasoning_required.reason",',
    '            "Parent task needs semantic/generative execution; route through self-funded Agent402.",',
    "          );",
    "          log(",
    "            config,",
    '            "[AGENT402] Task " + reasoningTask.id + " requires reasoning. Using NOVENS wallet-funded inference.",',
    "          );",
    "          // Continue into the normal inference/tool path.",
    "        } else {",
    "          if (duplicateReasoning && reasoningTask?.id) {
            log(config, "[AGENT402 GATE] Recent reasoning already purchased for task " + reasoningTask.id + "; deterministic cooldown.");
          }
          if (reasoningTask?.id) {",
    '            db.setKV("reasoning_required.task_id", String(reasoningTask.id));',
    "            db.setKV(",
    '              "reasoning_required.reason",',
    '              "Parent task needs semantic/generative execution; no self-funded inference route is enabled.",',
    "            );",
    "          } else {",
    '            db.deleteKV("reasoning_required.task_id");',
    '            db.deleteKV("reasoning_required.reason");',
    "          }",
    "          log(",
    "            config,",
    "            reasoningTask?.id",
    '              ? "[DETERMINISTIC] Task " + reasoningTask.id + " requires reasoning; no paid inference route enabled."',
    '              : "[DETERMINISTIC] Scheduler/orchestrator tick complete. No LLM inference call made.",',
    "          );",
    '          db.deleteKV("sleep_until");',
    '          db.setAgentState("running");',
    '          onStateChange?.("running");',
    '          log(config, "[NOVENS CONTINUE] No parent reasoning task yet; keep deterministic orchestration runnable.");',
    "          running = false;",
    "          break;",
    "        }",
    "      }",
    "",
  ].join("\n");

  src = src.slice(0, start) + replacement + src.slice(end);

  const oldLog = '      log(config, `[THINK] Routing inference (tier: ${survivalTier}, model: ${inference.getDefaultModel()})...`);';
  if (src.includes(oldLog)) {
    const newLog = [
      "      const visibleInferenceModel =",
      '        process.env.NOVENS_AGENT402_ENABLED === "1"',
      '          ? (process.env.NOVENS_AGENT402_MODEL || "deepseek/deepseek-chat")',
      "          : inference.getDefaultModel();",
      '      log(config, "[THINK] Routing inference (tier: " + survivalTier + ", model: " + visibleInferenceModel + ")...");'
    ].join("\n");
    src = src.replace(oldLog, newLog);
  }

  write(file, src);
}

console.log("[NOVENS CLOUD] Agent402 deterministic reasoning gate and accounting applied.");
