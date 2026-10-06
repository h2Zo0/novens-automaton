import fs from "node:fs";

const file = "src/agent/loop.ts";
let src = fs.readFileSync(file, "utf8");

if (!src.includes("NOVENS_CREATOR_ORDER_V1")) {
  const anchor = "  // Initialize inference router (Phase 2.3)";
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error("Creator order insertion point not found");

  const block = `
  // NOVENS_CREATOR_ORDER_V1
  // Accept a creator order as a one-shot orchestrator goal. The order is
  // consumed only after it has actually been created, so a restart cannot lose it.
  {
    const creatorOrder = String(process.env.NOVENS_CREATOR_ORDER || "").trim();
    if (creatorOrder) {
      const previousOrder = db.getKV("novens.creator_order.last") || "";
      if (previousOrder !== creatorOrder) {
        let activeGoalCount = 0;
        try {
          const row = db.raw
            .prepare("SELECT COUNT(*) AS c FROM goals WHERE status = 'active'")
            .get() as { c?: number } | undefined;
          activeGoalCount = Number(row?.c || 0);
        } catch {
          activeGoalCount = 0;
        }

        if (activeGoalCount === 0) {
          const { createGoal } = await import("../orchestration/task-graph.js");
          const title =
            String(process.env.NOVENS_CREATOR_ORDER_TITLE || "").trim() ||
            "Creator order";
          const strategy =
            String(process.env.NOVENS_CREATOR_ORDER_STRATEGY || "").trim() ||
            "Minimize downside risk and unnecessary spend. Prefer genuine value creation, verify results, and stop or wait when expected value is not favorable.";

          const goal = createGoal(
            db.raw,
            title.slice(0, 180),
            creatorOrder.slice(0, 6000),
            strategy.slice(0, 2500),
          );
          db.setKV("novens.creator_order.last", creatorOrder);
          log(
            config,
            "[CREATOR ORDER] Accepted goal " + goal.id + ": " + goal.title,
          );
        } else {
          log(
            config,
            "[CREATOR ORDER] Waiting for current active goal to finish before accepting new order.",
          );
        }
      }
    }
  }

`;

  src = src.slice(0, at) + block + src.slice(at);
  fs.writeFileSync(file, src);
}


{
  const plannerFile = "src/orchestration/planner.ts";
  let planner = fs.readFileSync(plannerFile, "utf8");
  if (!planner.includes("NOVENS_PLANNER_JSON_COMPAT_V1")) {
    const needle = "function parsePlannerResponse(content: string): unknown {";
    const at = planner.indexOf(needle);
    const end = planner.indexOf("\nfunction validateCustomRole", at);
    if (at < 0 || end < 0) throw new Error("Planner parser target missing");
    const block = [
      "function parsePlannerResponse(content: string): unknown {",
      "  // NOVENS_PLANNER_JSON_COMPAT_V1",
      "  const trimmed = content.trim();",
      "  if (!trimmed) throw new Error(\"Planner returned an empty response\");",
      "  const candidates = [trimmed];",
      "  const first = trimmed.indexOf(\"{\");",
      "  const last = trimmed.lastIndexOf(\"}\");",
      "  if (first >= 0 && last > first) candidates.push(trimmed.slice(first, last + 1));",
      "  let failure = \"unknown parse error\";",
      "  for (const candidate of candidates) {",
      "    try { return JSON.parse(candidate); } catch (error) { failure = error instanceof Error ? error.message : String(error); }",
      "  }",
      "  throw new Error(\"Planner returned invalid JSON: \" + failure);",
      "}",
      ""
    ].join("\\n");
    planner = planner.slice(0, at) + block + planner.slice(end);
    fs.writeFileSync(plannerFile, planner);
  }
}

console.log("[NOVENS CLOUD] One-shot creator order bridge applied.");
