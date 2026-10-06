import fs from "node:fs";

function replaceOnce(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error("Pattern not found in " + file);
  fs.writeFileSync(file, src.replace(from, to));
}

const compute = "src/compute/daytona-client.ts";
replaceOnce(
  compute,
  `  const daytona = new Daytona({
    apiKey,
    apiUrl: process.env.DAYTONA_API_URL || "https://app.daytona.io/api",
    target: process.env.DAYTONA_TARGET || "us",
  });
`,
  `  const daytonaConfig: Record<string, string> = { apiKey };
  if (process.env.DAYTONA_API_URL) daytonaConfig.apiUrl = process.env.DAYTONA_API_URL;
  if (process.env.DAYTONA_TARGET) daytonaConfig.target = process.env.DAYTONA_TARGET;
  const daytona = new Daytona(daytonaConfig);
`
);

let computeSrc = fs.readFileSync(compute, "utf8");
if (!computeSrc.includes("export async function runDaytonaSmokeTest")) {
  computeSrc += `

export async function runDaytonaSmokeTest(): Promise<{
  ok: boolean;
  output: string;
  sandboxId: string;
  deleted: boolean;
}> {
  const apiKey = String(process.env.DAYTONA_API_KEY || "").trim();
  if (!apiKey) throw new Error("DAYTONA_API_KEY is not configured");

  const daytonaConfig: Record<string, string> = { apiKey };
  if (process.env.DAYTONA_API_URL) daytonaConfig.apiUrl = process.env.DAYTONA_API_URL;
  if (process.env.DAYTONA_TARGET) daytonaConfig.target = process.env.DAYTONA_TARGET;
  const daytona = new Daytona(daytonaConfig);

  let sandbox: any;
  let output = "";
  let ok = false;
  let sandboxId = "";
  let deleted = false;

  try {
    sandbox = await daytona.create({
      name: \`novens-smoke-\${Date.now()}\`,
      user: "root",
      language: "typescript",
      image: "node:22-bookworm",
      resources: { cpu: 1, memory: 1, disk: 5 },
      labels: { novens: "true", role: "smoke-test" },
      autoStopInterval: 15,
      autoDeleteInterval: -1,
    }, { timeout: 120 });

    sandboxId = String(sandbox.id);
    const result = await sandbox.process.executeCommand(
      "printf NOVENS_DAYTONA_OK",
      "/root",
      undefined,
      30,
    );
    output = String(result.result || result.artifacts?.stdout || "").trim();
    ok = result.exitCode === 0 && output === "NOVENS_DAYTONA_OK";
  } finally {
    if (sandbox) {
      try {
        await daytona.delete(sandbox, 60, true);
        deleted = true;
      } catch {
        deleted = false;
      }
    }
  }

  return { ok, output, sandboxId, deleted };
}
`;
  fs.writeFileSync(compute, computeSrc);
}

const server = "src/dashboard/server.ts";
replaceOnce(
  server,
  "import { reconcileHistoricalChildCreationEconomics } from '../economy/obligations.js';\n",
  "import { reconcileHistoricalChildCreationEconomics } from '../economy/obligations.js';\nimport { runDaytonaSmokeTest } from '../compute/daytona-client.js';\n"
);
replaceOnce(
  server,
  "        if(url.pathname==='/api/runtime-control') {\n          const input=await body(req);\n          const action=String(input.action || '');",
  "        if(url.pathname==='/api/daytona-smoke-test') {\n          await body(req);\n          return send(res,200,await runDaytonaSmokeTest());\n        }\n        if(url.pathname==='/api/runtime-control') {\n          const input=await body(req);\n          const action=String(input.action || '');"
);

console.log("[NOVENS CLOUD] Daytona smoke-test patch applied.");
