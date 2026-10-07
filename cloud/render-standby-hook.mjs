import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { syncBuiltinESMExports } from "node:module";

const stateDir =
  process.env.AUTOMATON_STATE_DIR ||
  "/opt/render/project/.automaton";

// Render standby hook.
// Preserve persistent data, but force the cloud runtime to STOPPED before
// the dashboard's persistent START auto-resume logic can run.
if (process.env.NOVENS_RENDER_STANDBY === "1") {
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

// Temporary authenticated state export used only for the Mac-primary migration.
// It is disabled unless NOVENS_RENDER_EXPORT=1 and requires a one-time token.
// Only the SQLite state database and its WAL/SHM companions are exposed.
if (process.env.NOVENS_RENDER_EXPORT === "1") {
  const originalCreateServer = http.createServer.bind(http);

  http.createServer = function (...args) {
    const index = typeof args[0] === "function" ? 0 : 1;
    const originalListener = args[index];

    if (typeof originalListener === "function") {
      args[index] = function (req, res) {
        try {
          if ((req.url || "").split("?")[0] === "/__novens_state_export") {
            const expected = process.env.NOVENS_MIGRATION_TOKEN || "";
            const supplied = String(req.headers["x-novens-migration-token"] || "");

            if (!expected || supplied !== expected) {
              res.writeHead(403, {
                "Content-Type": "application/json",
                "Cache-Control": "no-store",
              });
              res.end(JSON.stringify({ error: "forbidden" }));
              return;
            }

            const names = ["state.db", "state.db-wal", "state.db-shm"];
            const files = {};

            for (const name of names) {
              const file = path.join(stateDir, name);
              if (!fs.existsSync(file)) continue;

              const stat = fs.statSync(file);
              if (!stat.isFile() || stat.size > 32 * 1024 * 1024) continue;

              files[name] = {
                size: stat.size,
                data: fs.readFileSync(file).toString("base64"),
              };
            }

            res.writeHead(200, {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            });
            res.end(
              JSON.stringify({
                exportedAt: new Date().toISOString(),
                files,
              }),
            );
            return;
          }
        } catch (error) {
          res.writeHead(500, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
          );
          return;
        }

        return originalListener(req, res);
      };
    }

    return originalCreateServer(...args);
  };

  syncBuiltinESMExports();
}
