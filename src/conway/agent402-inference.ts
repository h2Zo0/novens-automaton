import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadWalletAccount, getWalletChainType, getAutomatonDir } from "../identity/wallet.js";
import { getUsdcBalance, x402Fetch } from "./x402.js";
import type { ChatMessage } from "../types.js";

interface Agent402Params {
  messages: ChatMessage[];
  tools?: unknown[];
  toolChoice?: unknown;
  temperature?: number;
  maxTokens?: number;
}

export interface Agent402Result {
  id: string;
  model: string;
  content: string;
  toolCalls?: any[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
  walletCostCents: number;
  paymentReceipt?: string;
}

interface DailyLedger {
  date: string;
  spentCents: number;
  calls: number;
}

const ENDPOINT = "https://agent402.tools/v1/metered/chat/completions";

function positiveNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function ledgerPath(): string {
  return path.join(getAutomatonDir(), "agent402-spend.json");
}

function readLedger(): DailyLedger {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const value = JSON.parse(fs.readFileSync(ledgerPath(), "utf8")) as DailyLedger;
    if (
      value.date === today &&
      Number.isFinite(value.spentCents) &&
      Number.isFinite(value.calls)
    ) {
      return value;
    }
  } catch {}
  return { date: today, spentCents: 0, calls: 0 };
}

function writeLedger(value: DailyLedger): void {
  fs.writeFileSync(
    ledgerPath(),
    JSON.stringify(value, null, 2) + "\n",
    { mode: 0o600 },
  );
}

export async function callAgent402(params: Agent402Params): Promise<Agent402Result> {
  if (process.env.NOVENS_AGENT402_ENABLED !== "1") {
    throw new Error("Agent402 inference is disabled");
  }

  const chainType = getWalletChainType();
  const account = loadWalletAccount();
  if (chainType !== "evm" || !account) {
    throw new Error("Agent402 self-funded inference currently requires NOVENS' EVM wallet");
  }

  const model = process.env.NOVENS_AGENT402_MODEL || "deepseek/deepseek-chat";
  const maxCallCents = positiveNumber("NOVENS_AGENT402_MAX_CALL_CENTS", 25);
  const dailyCapCents = positiveNumber("NOVENS_AGENT402_DAILY_CENTS", 500);
  const reserveCents = positiveNumber("NOVENS_AGENT402_RESERVE_CENTS", 1000);
  const outputCap = Math.max(
    64,
    Math.min(
      Number(params.maxTokens || 2048),
      positiveNumber("NOVENS_AGENT402_MAX_OUTPUT_TOKENS", 2048),
      8192,
    ),
  );

  const requestBody: Record<string, unknown> = {
    model,
    messages: params.messages,
    max_tokens: outputCap,
  };
  if (params.tools && params.tools.length > 0) {
    requestBody.tools = params.tools;
    requestBody.tool_choice = params.toolChoice || "auto";
  }
  if (typeof params.temperature === "number") {
    requestBody.temperature = params.temperature;
  }

  const idempotencyKey = "novens-" + randomUUID();
  let authorizedCents = 0;

  const paid = await x402Fetch(
    ENDPOINT,
    account,
    "POST",
    JSON.stringify(requestBody),
    {
      "Idempotency-Key": idempotencyKey,
      "User-Agent": "NOVENS-Automaton/0.2.1",
    },
    maxCallCents,
    chainType,
    async (amountCents) => {
      const ledger = readLedger();
      if (ledger.spentCents + amountCents > dailyCapCents) {
        throw new Error(
          "Agent402 daily cap would be exceeded: " +
          ledger.spentCents.toFixed(2) + "c + " +
          amountCents.toFixed(2) + "c > " +
          dailyCapCents.toFixed(2) + "c",
        );
      }

      const balanceUsd = await getUsdcBalance(
        account.address,
        "eip155:8453",
        "evm",
      );
      const balanceCents = Math.floor(balanceUsd * 100);
      console.log(
        "[AGENT402 PAYMENT] quote=" + amountCents.toFixed(4) +
        "c wallet=" + balanceCents +
        "c reserve=" + reserveCents + "c",
      );
      if (balanceCents - amountCents < reserveCents) {
        throw new Error(
          "NOVENS reserve protected: wallet " + balanceCents +
          "c - quote " + amountCents.toFixed(2) +
          "c < reserve " + reserveCents + "c",
        );
      }
      authorizedCents = amountCents;
    },
  );

  if (!paid.success) {
    throw new Error(
      paid.error ||
      "Agent402 inference failed with HTTP " + String(paid.status || "unknown"),
    );
  }

  const chargedCents = Number((paid as any).amountCents ?? authorizedCents);
  if (chargedCents > 0) {
    const ledger = readLedger();
    ledger.spentCents += chargedCents;
    ledger.calls += 1;
    writeLedger(ledger);
  }

  const data = paid.response as any;
  const choice = data?.choices?.[0];
  if (!choice?.message) {
    throw new Error("Agent402 returned no completion choice");
  }

  const toolCalls = Array.isArray(choice.message.tool_calls)
    ? choice.message.tool_calls.map((tc: any) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.function?.name,
          arguments:
            typeof tc.function?.arguments === "string"
              ? tc.function.arguments
              : JSON.stringify(tc.function?.arguments || {}),
        },
      }))
    : undefined;

  const promptTokens = Number(data?.usage?.prompt_tokens || 0);
  const completionTokens = Number(data?.usage?.completion_tokens || 0);
  const totalTokens = Number(
    data?.usage?.total_tokens || promptTokens + completionTokens,
  );

  console.log(
    "[AGENT402 RESULT] model=" + String(data?.model || model) +
    " paid=" + chargedCents.toFixed(4) + "c" +
    " tokens=" + totalTokens +
    " receipt=" + ((paid as any).paymentResponse ? "yes" : "no"),
  );

  return {
    id: String(data?.id || idempotencyKey),
    model: String(data?.model || model),
    content: String(choice.message.content || ""),
    toolCalls,
    promptTokens,
    completionTokens,
    totalTokens,
    finishReason: String(choice.finish_reason || "stop"),
    walletCostCents: chargedCents,
    paymentReceipt: (paid as any).paymentResponse,
  };
}
