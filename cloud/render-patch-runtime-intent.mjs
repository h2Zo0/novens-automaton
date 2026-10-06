import fs from "node:fs";

const file = "src/dashboard/server.ts";
const marker = "NOVENS_RUNTIME_INTENT_V1";
let src = fs.readFileSync(file, "utf8");

if (!src.includes(marker)) {
  const runtimeDecl = "  let runtimeChild: ChildProcessWithoutNullStreams | null = null;";
  const runtimeAt = src.indexOf(runtimeDecl);
  if (runtimeAt < 0) {
    throw new Error("NOVENS runtime intent patch: runtime child declaration not found");
  }

  const runtimeHelpers = `
  // NOVENS_RUNTIME_INTENT_V1
  // Persist the operator's START/STOP intent on the mounted state disk.
  // Internal sleeping/hold states never change this intent.
  const runtimeIntentFile = path.join(
    path.dirname(options.configFile),
    "runtime-desired-state.json",
  );
  const readRuntimeIntent = (): "running" | "stopped" | "unset" => {
    try {
      const parsed = JSON.parse(fs.readFileSync(runtimeIntentFile, "utf8")) as {
        desired?: string;
      };
      return parsed.desired === "running"
        ? "running"
        : parsed.desired === "stopped"
          ? "stopped"
          : "unset";
    } catch {
      return "unset";
    }
  };
  const writeRuntimeIntent = (desired: "running" | "stopped"): void => {
    fs.mkdirSync(path.dirname(runtimeIntentFile), { recursive: true });
    fs.writeFileSync(
      runtimeIntentFile,
      JSON.stringify(
        {
          desired,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\\n",
      { mode: 0o600 },
    );
  };
`;

  const runtimeEnd = runtimeAt + runtimeDecl.length;
  src = src.slice(0, runtimeEnd) + runtimeHelpers + src.slice(runtimeEnd);

  const startMatch = /if\s*\(\s*action\s*===\s*['"]start['"]\s*\)\s*\{/g.exec(src);
  if (!startMatch) {
    throw new Error("NOVENS runtime intent patch: START action not found");
  }

  const startBlockStart = startMatch.index + startMatch[0].length;
  const projectNeedle = "const projectDir=path.resolve(options.publicDir,'../..');";
  const projectAt = src.indexOf(projectNeedle, startBlockStart);
  if (projectAt < 0) {
    throw new Error("NOVENS runtime intent patch: START spawn point not found");
  }

  src =
    src.slice(0, projectAt) +
    "writeRuntimeIntent('running');\n            " +
    src.slice(projectAt);

  const stopRegex = /((?:else\s+)?if\s*\(\s*action\s*===\s*['"]stop['"]\s*\)\s*\{)/;
  const stopMatch = stopRegex.exec(src);
  if (!stopMatch) {
    throw new Error("NOVENS runtime intent patch: STOP action not found");
  }

  const stopInsertAt = stopMatch.index + stopMatch[1].length;
  src =
    src.slice(0, stopInsertAt) +
    "\n            writeRuntimeIntent('stopped');" +
    src.slice(stopInsertAt);

  const listenerNeedle = "  server.on('listening'";
  const listenerAt = src.indexOf(listenerNeedle);
  if (listenerAt < 0) {
    throw new Error("NOVENS runtime intent patch: listening hook not found");
  }

  const autoResume = `
  let runtimeAutoResumeBusy = false;
  let runtimeAutoResumeLastAttempt = 0;

  const autoResumeRuntime = async (reason: string): Promise<void> => {
    if (!cloudMode) return;
    if (readRuntimeIntent() !== "running") return;
    if (runtimeChild && !runtimeChild.killed) return;
    if (runtimeAutoResumeBusy) return;

    const now = Date.now();
    if (now - runtimeAutoResumeLastAttempt < 60_000) return;

    runtimeAutoResumeBusy = true;
    runtimeAutoResumeLastAttempt = now;

    try {
      const address = server.address();
      const port =
        typeof address === "object" && address
          ? address.port
          : Number(process.env.PORT || 10000);

      const basic = Buffer.from(uiUser + ":" + uiPassword).toString("base64");
      const response = await fetch(
        "http://127.0.0.1:" + port + "/api/runtime-control",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: "Basic " + basic,
          },
          body: JSON.stringify({ action: "start" }),
        },
      );

      if (!response.ok) {
        console.warn(
          "[NOVENS RUNTIME] Auto-resume failed (" +
            reason +
            "): HTTP " +
            response.status,
        );
      } else {
        console.log(
          "[NOVENS RUNTIME] Persistent START intent restored (" + reason + ").",
        );
      }
    } catch (error) {
      console.warn(
        "[NOVENS RUNTIME] Auto-resume error (" +
          reason +
          "): " +
          (error instanceof Error ? error.message : String(error)),
      );
    } finally {
      runtimeAutoResumeBusy = false;
    }
  };

  server.on("listening", () => {
    if (readRuntimeIntent() === "running") {
      setTimeout(() => {
        void autoResumeRuntime("service restart/deploy");
      }, 1500);
    }
  });

  const runtimeIntentWatchdog = setInterval(() => {
    if (
      readRuntimeIntent() === "running" &&
      (!runtimeChild || runtimeChild.killed)
    ) {
      void autoResumeRuntime("unexpected runtime exit");
    }
  }, 15_000);
  runtimeIntentWatchdog.unref?.();

`;

  src = src.slice(0, listenerAt) + autoResume + src.slice(listenerAt);
}

fs.writeFileSync(file, src);
console.log("[NOVENS CLOUD] Persistent runtime START/STOP intent applied.");
