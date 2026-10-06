import fs from "node:fs";

function replaceOnce(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error("NOVENS runtime-fingerprint patch target not found in " + file);
  fs.writeFileSync(file, src.replace(from, to));
}

replaceOnce(
  "src/index.ts",
  `  // Initialize database
  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  // Persist createdAt: only set if not already stored (never overwrite)
`,
  `  // Initialize database
  const dbPath = resolvePath(config.dbPath);
  const db = createDatabase(dbPath);

  // A materially changed cloud runtime/compute configuration invalidates a
  // stale VALUE HOLD exactly once. The fingerprint is durable, so restarting
  // the same code/configuration cannot bypass the hold.
  if (cloudMode) {
    const runtimeFingerprint = [
      process.env.RENDER_GIT_COMMIT || "",
      process.env.DAYTONA_TARGET || "",
      process.env.DAYTONA_API_KEY ? "daytona:on" : "daytona:off",
    ].join("|");
    const previousRuntimeFingerprint = db.getKV("value_guard.runtime_fingerprint");
    if (runtimeFingerprint && previousRuntimeFingerprint !== runtimeFingerprint) {
      db.setKV("value_guard.runtime_fingerprint", runtimeFingerprint);
      db.deleteKV("value_guard.hold_until");
      db.deleteKV("value_guard.reason");
      db.deleteKV("value_guard.economic_value_cents");
      db.setKV("value_guard.no_progress_turns", "0");
      db.setKV("value_guard.tokens_since_value", "0");
      logger.info(
        "[VALUE HOLD] Runtime code/compute configuration changed; stale hold cleared once.",
      );
    }
  }

  // Persist createdAt: only set if not already stored (never overwrite)
`
);

console.log("[NOVENS CLOUD] Runtime fingerprint hold-reset patch applied.");
