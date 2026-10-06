import fs from "node:fs";

const file = "src/orchestration/orchestrator.ts";
let src = fs.readFileSync(file, "utf8");
const marker = "[LLM GATE] Goal complexity classified deterministically";

if (!src.includes(marker)) {
  const startNeedle = "  private async classifyComplexity(goal: GoalRow): Promise<{ requiresPlanMode: boolean; estimatedSteps: number }> {";
  const endNeedle = "\n  private findBusyAgentForReassign";
  const start = src.indexOf(startNeedle);
  const end = src.indexOf(endNeedle, start);
  if (start < 0 || end < 0) {
    throw new Error("NOVENS deterministic complexity target not found");
  }

  const replacement = `  private async classifyComplexity(
    goal: GoalRow,
  ): Promise<{ requiresPlanMode: boolean; estimatedSteps: number }> {
    // This phase only needs a routing decision (>3 steps), not generative text.
    // Reuse the project's existing deterministic fallback instead of spending
    // an inference call whose reason/outline output was never consumed.
    const estimatedSteps = heuristicStepEstimate(goal);
    const skipped = Number.parseInt(
      (this.params.db.prepare("SELECT value FROM kv WHERE key = ?")
        .get("llm_gate.complexity_skipped") as { value?: string } | undefined)?.value || "0",
      10,
    );
    this.params.db.prepare(
      "INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, datetime('now'))",
    ).run(
      "llm_gate.complexity_skipped",
      String(Number.isFinite(skipped) ? skipped + 1 : 1),
    );
    logger.info("[LLM GATE] Goal complexity classified deterministically", {
      goalId: goal.id,
      estimatedSteps,
      requiresPlanMode: estimatedSteps > 3,
    });
    return {
      estimatedSteps,
      requiresPlanMode: estimatedSteps > 3,
    };
  }
`;

  src = src.slice(0, start) + replacement + src.slice(end);
  fs.writeFileSync(file, src);
}

console.log("[NOVENS CLOUD] Goal complexity classification made deterministic.");
