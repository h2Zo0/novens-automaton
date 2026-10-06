import fs from "node:fs";

function read(file) { return fs.readFileSync(file, "utf8"); }
function write(file, content) { fs.writeFileSync(file, content); }

// Legacy inference client used by the parent turn router.
{
  const file = "src/conway/inference.ts";
  let src = read(file);

  if (!src.includes('import { callAgent402 } from "./agent402-inference.js";')) {
    src = src.replace(
      'import { ResilientHttpClient } from "./http-client.js";',
      'import { ResilientHttpClient } from "./http-client.js";\nimport { callAgent402 } from "./agent402-inference.js";'
    );
  }

  if (!src.includes("NOVENS_AGENT402_LEGACY_V1")) {
    const needle = '    const model = opts?.model || currentModel;\n    const tools = opts?.tools;';
    if (!src.includes(needle)) throw new Error("Agent402 legacy inference target missing");
    const insertion = [
      '    const model = opts?.model || currentModel;',
      '    const tools = opts?.tools;',
      '',
      '    // NOVENS_AGENT402_LEGACY_V1',
      '    if (process.env.NOVENS_AGENT402_ENABLED === "1") {',
      '      const paid = await callAgent402({',
      '        messages,',
      '        tools,',
      '        toolChoice: "auto",',
      '        temperature: opts?.temperature,',
      '        maxTokens: opts?.maxTokens || maxTokens,',
      '      });',
      '      const response: InferenceResponse = {',
      '        id: paid.id,',
      '        model: paid.model,',
      '        message: {',
      '          role: "assistant",',
      '          content: paid.content,',
      '          tool_calls: paid.toolCalls,',
      '        },',
      '        toolCalls: paid.toolCalls,',
      '        usage: {',
      '          promptTokens: paid.promptTokens,',
      '          completionTokens: paid.completionTokens,',
      '          totalTokens: paid.totalTokens,',
      '        },',
      '        finishReason: paid.finishReason,',
      '      };',
      '      (response as any).walletCostCents = paid.walletCostCents;',
      '      (response as any).paymentReceipt = paid.paymentReceipt;',
      '      return response;',
      '    }'
    ].join("\n");
    src = src.replace(needle, insertion);
  }

  write(file, src);
}

// Unified inference client used by planner and worker orchestration.
{
  const file = "src/inference/inference-client.ts";
  let src = read(file);

  if (!src.includes('import { callAgent402 } from "../conway/agent402-inference.js";')) {
    src = src.replace(
      'import type { ChatMessage } from "../types.js";',
      'import type { ChatMessage } from "../types.js";\nimport { callAgent402 } from "../conway/agent402-inference.js";'
    );
  }

  if (!src.includes("NOVENS_AGENT402_UNIFIED_V1")) {
    const needle = '  async chat(params: UnifiedChatParams): Promise<UnifiedInferenceResult> {\n    const survivalMode = this.isSurvivalMode();';
    if (!src.includes(needle)) throw new Error("Agent402 unified chat target missing");
    const replacement = [
      '  async chat(params: UnifiedChatParams): Promise<UnifiedInferenceResult> {',
      '    // NOVENS_AGENT402_UNIFIED_V1',
      '    if (process.env.NOVENS_AGENT402_ENABLED === "1") {',
      '      const started = Date.now();',
      '      const paid = await callAgent402({',
      '        messages: params.messages,',
      '        tools: params.tools,',
      '        toolChoice: params.toolChoice,',
      '        temperature: params.temperature,',
      '        maxTokens: params.maxTokens,',
      '      });',
      '      return {',
      '        content: paid.content,',
      '        toolCalls: paid.toolCalls,',
      '        usage: {',
      '          inputTokens: paid.promptTokens,',
      '          outputTokens: paid.completionTokens,',
      '          totalTokens: paid.totalTokens,',
      '        },',
      '        cost: {',
      '          inputCostCredits: 0,',
      '          outputCostCredits: 0,',
      '          totalCostCredits: paid.walletCostCents,',
      '        },',
      '        metadata: {',
      '          providerId: "agent402",',
      '          modelId: paid.model,',
      '          tier: params.tier,',
      '          latencyMs: Date.now() - started,',
      '          retries: 0,',
      '          failedProviders: [],',
      '        },',
      '      };',
      '    }',
      '',
      '    const survivalMode = this.isSurvivalMode();'
    ].join("\n");
    src = src.replace(needle, replacement);
  }

  if (!src.includes("NOVENS_AGENT402_UNIFIED_DIRECT_V1")) {
    const needle = '  async chatDirect(params: UnifiedChatDirectParams): Promise<UnifiedInferenceResult> {\n    if (this.isProviderCircuitOpen(params.providerId)) {';
    if (!src.includes(needle)) throw new Error("Agent402 unified direct target missing");
    const replacement = [
      '  async chatDirect(params: UnifiedChatDirectParams): Promise<UnifiedInferenceResult> {',
      '    // NOVENS_AGENT402_UNIFIED_DIRECT_V1',
      '    if (process.env.NOVENS_AGENT402_ENABLED === "1") {',
      '      const started = Date.now();',
      '      const paid = await callAgent402({',
      '        messages: params.messages,',
      '        tools: params.tools,',
      '        toolChoice: params.toolChoice,',
      '        temperature: params.temperature,',
      '        maxTokens: params.maxTokens,',
      '      });',
      '      return {',
      '        content: paid.content,',
      '        toolCalls: paid.toolCalls,',
      '        usage: {',
      '          inputTokens: paid.promptTokens,',
      '          outputTokens: paid.completionTokens,',
      '          totalTokens: paid.totalTokens,',
      '        },',
      '        cost: {',
      '          inputCostCredits: 0,',
      '          outputCostCredits: 0,',
      '          totalCostCredits: paid.walletCostCents,',
      '        },',
      '        metadata: {',
      '          providerId: "agent402",',
      '          modelId: paid.model,',
      '          tier: "reasoning",',
      '          latencyMs: Date.now() - started,',
      '          retries: 0,',
      '          failedProviders: [],',
      '        },',
      '      };',
      '    }',
      '',
      '    if (this.isProviderCircuitOpen(params.providerId)) {'
    ].join("\n");
    src = src.replace(needle, replacement);
  }

  write(file, src);
}

console.log("[NOVENS CLOUD] Agent402 inference clients wired.");
