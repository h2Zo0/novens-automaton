import fs from "node:fs";

function replaceOnce(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error("NOVENS Daytona-focus patch target not found in " + file);
  fs.writeFileSync(file, src.replace(from, to));
}

replaceOnce(
  "src/agent/loop.ts",
  `        if (activeGoalCount === 0) {
          const blockedIdleInspection = new Set([
            "list_goals",
            "orchestrator_status",
            "get_plan",
            "check_usdc_balance",
          ]);
          toolsForInference = tools.filter(
            (tool) => !blockedIdleInspection.has(tool.name),
          );
        }
`,
  `        const blockedInspection = new Set([
          "list_goals",
          "orchestrator_status",
          "get_plan",
          "check_usdc_balance",
        ]);
        if (activeGoalCount > 0) {
          blockedInspection.add("create_goal");
        }
        toolsForInference = tools.filter(
          (tool) => !blockedInspection.has(tool.name),
        );
`
);

console.log("[NOVENS CLOUD] Daytona execution-focus patch applied.");
