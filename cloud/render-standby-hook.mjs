import fs from "node:fs";
import path from "node:path";

// Render standby hook.
// When enabled, preserve all persistent NOVENS data but force the runtime
// desired state to STOPPED before the dashboard can auto-resume it.
if (process.env.NOVENS_RENDER_STANDBY === "1") {
  const stateDir =
    process.env.AUTOMATON_STATE_DIR ||
    "/opt/render/project/.automaton";

  try {
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      path.join(stateDir, "runtime-desired-state.json"),
      JSON.stringify(
        {
          desired: "stopped",
          updatedAt: new Date().toISOString(),
          reason: "render-standby",
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    console.log("[NOVENS RENDER] Standby mode: persistent runtime intent forced to STOPPED.");
  } catch (error) {
    console.error(
      "[NOVENS RENDER] Failed to enforce standby state:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
