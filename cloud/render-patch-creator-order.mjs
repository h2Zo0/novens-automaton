import fs from "node:fs";

const file = "src/agent/loop.ts";
let src = fs.readFileSync(file, "utf8");

if (!src.includes("NOVENS_CREATOR_ORDER_V2")) {
  const anchor = "  // Initialize inference router (Phase 2.3)";
  const at = src.indexOf(anchor);
  if (at < 0) throw new Error("Creator order insertion point not found");

  const block = `
  // NOVENS_CREATOR_ORDER_V2
  // Keep the creator order productive while START is active. Create exactly one\n  // goal only when no active goal exists; never multiply goals just to stay busy.
  {
    const creatorOrder = String(process.env.NOVENS_CREATOR_ORDER || "").trim();
    if (creatorOrder) {
      {
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
          db.setKV("novens.creator_order.last", creatorOrder);\n          db.setKV("novens.creator_order.active_goal_id", String(goal.id));
          log(
            config,
            "[CREATOR ORDER] Accepted goal " + goal.id + ": " + goal.title,
          );
        } else {
          log(
            config,
            "[CREATOR ORDER] Active goal already exists; no duplicate goal created.",
          );
        }
      }
    }
  }

`;

  src = src.slice(0, at) + block + src.slice(at);
  fs.writeFileSync(file, src);
}


console.log("[NOVENS CLOUD] One-shot creator order bridge applied.");
