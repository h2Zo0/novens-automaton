import fs from "node:fs";

const toolsFile = "src/agent/tools.ts";
let toolsSrc = fs.readFileSync(toolsFile, "utf8");
const helperMarker = "function compactInferenceParameters(";

if (!toolsSrc.includes(helperMarker)) {
  const startNeedle = "export function toolsToInferenceFormat(";
  const endNeedle = "/**\n * Execute a tool call";
  const start = toolsSrc.indexOf(startNeedle);
  const end = toolsSrc.indexOf(endNeedle, start);
  if (start < 0 || end < 0) {
    throw new Error("NOVENS compact-tool-schema target not found");
  }

  const replacement = `function compactInferenceParameters(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => compactInferenceParameters(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const compact: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    // Tool-level descriptions remain intact. Parameter-level descriptions are
    // documentation only; names, types, required fields, enums, bounds and
    // every execution/policy rule remain unchanged.
    if (key === "description") continue;
    compact[key] = compactInferenceParameters(child);
  }
  return compact;
}

export function toolsToInferenceFormat(
  tools: AutomatonTool[],
): InferenceToolDefinition[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: compactInferenceParameters(t.parameters) as any,
    },
  }));
}

`;

  toolsSrc = toolsSrc.slice(0, start) + replacement + toolsSrc.slice(end);
  fs.writeFileSync(toolsFile, toolsSrc);
}

const loopFile = "src/agent/loop.ts";
let loopSrc = fs.readFileSync(loopFile, "utf8");
const telemetryMarker = "[LLM INPUT] messages=";

if (!loopSrc.includes(telemetryMarker)) {
  const needle = "      const inferenceTools = toolsToInferenceFormat(toolsForInference);\n";
  const at = loopSrc.indexOf(needle);
  if (at < 0) {
    throw new Error("NOVENS LLM input telemetry target not found");
  }

  const insert = `      if (valueMode) {
        const messageChars = messages.reduce(
          (sum, message) => sum + String(message.content ?? "").length,
          0,
        );
        const toolSchemaChars = JSON.stringify(inferenceTools).length;
        log(
          config,
          \`[LLM INPUT] messages=\${messages.length} message_chars=\${messageChars} tools=\${inferenceTools.length} tool_schema_chars=\${toolSchemaChars}\`,
        );
      }
`;
  const end = at + needle.length;
  loopSrc = loopSrc.slice(0, end) + insert + loopSrc.slice(end);
  fs.writeFileSync(loopFile, loopSrc);
}

console.log("[NOVENS CLOUD] Inference tool schemas compacted; input-size telemetry enabled.");
