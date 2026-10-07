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

  if (!src.includes('import { isAgent402DailyCapExhausted } from "../conway/agent402-inference.js";')) {
    const importNeedle = 'import { isIdleOnlyTool } from "./idle-only-tools.js";';
    if (!src.includes(importNeedle)) throw new Error("Agent402 cap-gate import target missing");
    src = src.replace(
      importNeedle,
      importNeedle + '\nimport { isAgent402DailyCapExhausted } from "../conway/agent402-inference.js";',
    );
  }
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
    '            "ORDER BY CASE WHEN id = ? AND ? > ? THEN 1 ELSE 0 END ASC, priority DESC, created_at ASC LIMIT 1",',
    '          ).get(identity.address, db.getKV("reasoning_required.task_id") || "", Number(db.getKV("reasoning_required.backoff_until_ms") || "0"), Date.now()) as',
    "            | { id?: string; title?: string; description?: string }",
    "            | undefined;",
    "        } catch {",
    "          reasoningTask = undefined;",
    "        }",
    "",
    '        // NOVENS_COMMERCIAL_PIPELINE_V1: seed bounded, non-spam commercial discovery work once.',
    '        if (db.getKV("commercial.pipeline.version") !== "1") {',
    '          db.setKV("commercial.pipeline.version", "1");',
    '          db.setKV("commercial.pipeline.stage", "market_discovery");',
    '          db.setKV("commercial.pipeline.objective", "Find lawful public B2B opportunities, qualify them, prepare outreach, track replies and count revenue only after verified payment_received.");',
    '          db.setKV("commercial.pipeline.rules", "No bulk spam; no purchase; no wallet transfer; no fabricated lead or payment; prefer public professional contact data; external outreach requires an available authorized channel.");',
    '          db.setKV("commercial.pipeline.todo", JSON.stringify(["market-discovery","prospect-discovery","prospect-qualification","outreach-preparation","reply-followup","proposal","payment-verification"]));',
    '          log(config, "[COMMERCIAL] Pipeline seeded: market discovery -> prospects -> qualification -> outreach -> follow-up -> payment verification.");',
    '        }',
    "",
    '        const agent402Enabled = process.env.NOVENS_AGENT402_ENABLED === "1";',
    '        const agent402CapExhausted = agent402Enabled && isAgent402DailyCapExhausted();',
    '        const agent402Ready = agent402Enabled && !agent402CapExhausted;',
    '        const previousReasoningTask = db.getKV("reasoning_required.task_id");',
    '        const previousReasoningAt = Number(db.getKV("reasoning_required.at_ms") || "0");',
    "        const reasoningCooldownMs = agent402CapExhausted ? 300_000 : 15_000;",
    "        const duplicateReasoning = Boolean(",
    "          reasoningTask?.id && previousReasoningTask === String(reasoningTask.id) &&",
    "          Number.isFinite(previousReasoningAt) && Date.now() - previousReasoningAt < reasoningCooldownMs",
    "        );",
    "",
    "        if (reasoningTask?.id && agent402Ready && !duplicateReasoning) {",
    '          db.setKV("reasoning_required.task_id", String(reasoningTask.id));',
    '          db.setKV("reasoning_required.at_ms", String(Date.now()));',
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
    "          if (agent402CapExhausted && reasoningTask?.id) {",
    '            db.setKV("reasoning_required.task_id", String(reasoningTask.id));',
    '            db.setKV("reasoning_required.reason", "Agent402 daily cap exhausted; paid reasoning deferred until daily ledger reset.");',
    "            const capBackoffUntil = Date.now() + 300_000;",
    "            db.setKV(\"reasoning_required.at_ms\", String(Date.now()));",
    "            db.setKV(\"reasoning_required.backoff_until_ms\", String(capBackoffUntil));",
    "            log(config, \"[AGENT402 CAP] Daily inference cap exhausted. No paid request sent; task \" + reasoningTask.id + \" deferred for 5m.\");",
    "            db.setKV(\"execution_priority\", \"daytona\");",
    "            db.setKV(\"daytona_fallback_reason\", \"Agent402 cap exhausted; deterministic revenue work preferred.\");",
    "            log(config, \"[DAYTONA PRIORITY] Agent402 unavailable; Daytona deterministic work preferred.\");",
    "            try {",
    "              const queueVersion = \"2\";",
    "              if (db.getKV(\"revenue_daytona.queue_version\") !== queueVersion) { db.setKV(\"revenue_daytona.queue_version\", queueVersion); db.setKV(\"revenue_daytona.cursor\", \"0\"); }",
    "              const cursor = Math.max(0, Number(db.getKV(\"revenue_daytona.cursor\") || \"0\"));",
    "              const ids = [\"offer-audit-kit\", \"lead-magnet-kit\", \"automation-service-kit\"];",
    "              const commands = [\"mkdir -p revenue/offer-audit-kit && echo Revenue-audit-deliverable > revenue/offer-audit-kit/OFFER.md\", \"mkdir -p revenue/lead-magnet-kit && echo Lead-generation-deliverable > revenue/lead-magnet-kit/DELIVERABLE.md\", \"mkdir -p revenue/automation-service-kit && echo Automation-service-deliverable > revenue/automation-service-kit/SERVICE.md\"];",
    "              const idx = cursor;",
    "              if (idx >= ids.length) { db.setKV(\"revenue_daytona.queue_state\", \"exhausted\"); log(config, \"[REVENUE QUEUE] Queue exhausted; no Daytona execution.\"); } else { log(config, \"[REVENUE QUEUE] Executing Daytona mission \" + ids[idx] + \" without paid reasoning.\");",
    "              const execResult = await conway.exec(commands[idx], 120000);",
    "              db.setKV(\"revenue_daytona.cursor\", String(cursor + 1));",
    "              if (execResult.exitCode === 0) {",
    "                db.setKV(\"revenue_daytona.done.\" + ids[idx], \"1\");",
    "                db.setKV(\"revenue_daytona.last_success\", ids[idx]);",
    "                log(config, \"[REVENUE QUEUE] Daytona mission \" + ids[idx] + \" completed; revenue remains zero until external payment is verified.\");",
    "              } else {",
    "                db.setKV(\"revenue_daytona.last_failure\", ids[idx] + \":\" + String(execResult.exitCode));",
    "                log(config, \"[REVENUE QUEUE] Daytona mission failed; rotating.\");",
    "              }",
    "              }",
    "            } catch (daytonaRevenueError) {",
    "              db.setKV(\"revenue_daytona.last_error\", String(daytonaRevenueError));",
    "              log(config, \"[REVENUE QUEUE] Daytona execution unavailable; rotating.\");",
    "            }",
    "          }",
    "          if (duplicateReasoning && reasoningTask?.id) {",
    '            log(config, "[AGENT402 GATE] Recent reasoning already purchased for task " + reasoningTask.id + "; deterministic cooldown.");',
    "            const cooldownRemainingMs = Math.max(250, reasoningCooldownMs - (Date.now() - previousReasoningAt));",
    '            db.setKV("sleep_until", new Date(Date.now() + cooldownRemainingMs).toISOString());',
    '            log(config, "[AGENT402 GATE] Yielding until reasoning cooldown expires in " + cooldownRemainingMs + "ms.");',
    "          }",
    "          if (reasoningTask?.id) {",
    '            db.setKV("reasoning_required.task_id", String(reasoningTask.id));',
    "            db.setKV(",
    '              "reasoning_required.reason",',
    '              agent402CapExhausted',
    '                ? "Agent402 daily cap exhausted; paid reasoning deferred until daily ledger reset."',
    '                : "Parent task needs semantic/generative execution; no self-funded inference route is enabled.",',
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
    "          if (!duplicateReasoning) db.deleteKV(\"sleep_until\");",
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
