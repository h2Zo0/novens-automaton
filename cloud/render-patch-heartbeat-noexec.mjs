import fs from "node:fs";

const file = "src/heartbeat/tasks.ts";
const src = fs.readFileSync(file, "utf8");
const marker = "[HEARTBEAT] metadata-only sandbox health check";

if (!src.includes(marker)) {
  const startNeedle = "  health_check: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {";
  const endNeedle = "  // === Phase 4.1: Metrics Reporting ===";
  const start = src.indexOf(startNeedle);
  const end = src.indexOf(endNeedle, start);

  if (start < 0 || end < 0) {
    throw new Error("NOVENS heartbeat no-exec patch target not found");
  }

  const replacement = `  health_check: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    // [HEARTBEAT] metadata-only sandbox health check.
    // A periodic heartbeat must not provision/execute compute merely to prove
    // that compute could execute. Actual exec failures are handled when a real
    // task requires exec.
    try {
      const sandboxId = String(taskCtx.identity.sandboxId || "").trim();

      if (sandboxId) {
        const sandboxes = await taskCtx.conway.listSandboxes();
        const sandbox = sandboxes.find((item) => item.id === sandboxId);

        if (!sandbox) {
          const prevStatus = taskCtx.db.getKV("health_check_status");
          if (prevStatus !== "failing") {
            taskCtx.db.setKV("health_check_status", "failing");
            return {
              shouldWake: true,
              message: "Health check failed: configured sandbox is not present",
            };
          }
          return { shouldWake: false };
        }

        const status = String(sandbox.status || "unknown").toLowerCase();
        const unhealthyStatuses = new Set([
          "failed",
          "error",
          "stopped",
          "deleted",
          "terminated",
        ]);

        if (unhealthyStatuses.has(status)) {
          const prevStatus = taskCtx.db.getKV("health_check_status");
          if (prevStatus !== "failing") {
            taskCtx.db.setKV("health_check_status", "failing");
            return {
              shouldWake: true,
              message: \`Health check failed: sandbox status=\${status}\`,
            };
          }
          return { shouldWake: false };
        }
      }

      taskCtx.db.setKV("health_check_status", "ok");
      taskCtx.db.setKV("last_health_check", new Date().toISOString());
      return { shouldWake: false };
    } catch (err: any) {
      const prevStatus = taskCtx.db.getKV("health_check_status");
      if (prevStatus !== "failing") {
        taskCtx.db.setKV("health_check_status", "failing");
        return {
          shouldWake: true,
          message: \`Health check failed: \${err.message}\`,
        };
      }
      return { shouldWake: false };
    }
  },

`;

  fs.writeFileSync(
    file,
    src.slice(0, start) + replacement + src.slice(end),
  );
}

console.log("[NOVENS CLOUD] Heartbeat sandbox health check made execution-free.");
