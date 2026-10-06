import fs from "node:fs";

function replaceOnce(file, from, to, marker) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(marker)) return;
  if (!src.includes(from)) throw new Error("NOVENS validation telemetry target missing in " + file);
  fs.writeFileSync(file, src.replace(from, to));
}

// Mirror only control-plane / validation lines from the child runtime into
// Render logs so end-to-end behavior can be verified without exposing prompts.
replaceOnce(
  "src/dashboard/server.ts",
  `  const pushRuntimeLine = (stream:'stdout'|'stderr'|'system', line:string) => {
    runtimeLines.push({at:new Date().toISOString(),stream,line});
    if(runtimeLines.length>300) runtimeLines.splice(0,runtimeLines.length-300);
    if(process.env.NOVENS_PAPER_AUTOSTART==='1' || process.env.NOVENS_PAPER_MODE==='1') {
      console.log(\`[NOVENS RUNTIME][\${stream}] \${line}\`);
    }
  };`,
  `  const pushRuntimeLine = (stream:'stdout'|'stderr'|'system', line:string) => {
    runtimeLines.push({at:new Date().toISOString(),stream,line});
    if(runtimeLines.length>300) runtimeLines.splice(0,runtimeLines.length-300);

    const validationLine =
      stream === 'system' ||
      stream === 'stderr' ||
      /\\[AGENT402(?:\\]| )/.test(line) ||
      /\\[DAYTONA(?:\\]| )/.test(line) ||
      /\\[TOOL(?: RESULT)?\\]/.test(line) ||
      /\\[(?:DETERMINISTIC|NOVENS KEEPALIVE|NOVENS COOLDOWN|THINK|LOOP END)\\]/.test(line) ||
      /\\b(?:ERROR|WARN)\\b/.test(line);

    if(
      process.env.NOVENS_PAPER_AUTOSTART==='1' ||
      process.env.NOVENS_PAPER_MODE==='1' ||
      validationLine
    ) {
      console.log(\`[NOVENS RUNTIME][\${stream}] \${line}\`);
    }
  };`,
  "const validationLine =",
);

// Emit coarse Daytona execution proof without logging command contents.
{
  const file = "src/compute/daytona-client.ts";
  let src = fs.readFileSync(file, "utf8");

  if (!src.includes("[DAYTONA EXEC] start")) {
    src = src.replace(
      `    const result = await sandbox.process.executeCommand(
      command,
      undefined,
      undefined,
      timeoutSeconds(timeout),
    );`,
      `    console.log("[DAYTONA EXEC] start sandbox=" + id);
    const result = await sandbox.process.executeCommand(
      command,
      undefined,
      undefined,
      timeoutSeconds(timeout),
    );
    console.log(
      "[DAYTONA EXEC] done sandbox=" + id +
      " exit=" + String(result.exitCode ?? "unknown"),
    );`
    );
  }

  if (!src.includes("[DAYTONA FILE] write")) {
    src = src.replace(
      `    await sandbox.fs.uploadFile(
      Buffer.from(content, "utf8"),
      daytonaWorkspacePath(remotePath, workspace),
    );`,
      `    await sandbox.fs.uploadFile(
      Buffer.from(content, "utf8"),
      daytonaWorkspacePath(remotePath, workspace),
    );
    console.log("[DAYTONA FILE] write sandbox=" + id);`
    );
  }

  if (!src.includes("[DAYTONA FILE] read")) {
    src = src.replace(
      `    const data = await sandbox.fs.downloadFile(daytonaWorkspacePath(remotePath, workspace));
    return data.toString("utf8");`,
      `    const data = await sandbox.fs.downloadFile(daytonaWorkspacePath(remotePath, workspace));
    console.log("[DAYTONA FILE] read sandbox=" + id);
    return data.toString("utf8");`
    );
  }

  fs.writeFileSync(file, src);
}

console.log("[NOVENS CLOUD] Validation telemetry enabled.");
