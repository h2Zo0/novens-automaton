import fs from "node:fs";

const file = "src/conway/x402.ts";
let src = fs.readFileSync(file, "utf8");

if (!src.includes("amountCents?: number")) {
  src = src.replace(
    /interface X402PaymentResult \{([\s\S]*?)\n\}/,
    (m, body) => "export interface X402PaymentResult {" + body +
      "\n  amountCents?: number;\n  paymentResponse?: string;\n}"
  );
}

if (!src.includes('typeof value.amount === "string"')) {
  src = src.replace(
    /const maxAmountRequired = typeof value\.maxAmountRequired === "string"[\s\S]*?: null;/,
    [
      'const maxAmountRequired = typeof value.maxAmountRequired === "string"',
      '    ? value.maxAmountRequired',
      '    : typeof value.maxAmountRequired === "number" && Number.isFinite(value.maxAmountRequired)',
      '      ? String(value.maxAmountRequired)',
      '      : typeof value.amount === "string"',
      '        ? value.amount',
      '        : typeof value.amount === "number" && Number.isFinite(value.amount)',
      '          ? String(value.amount)',
      '          : null;'
    ].join("\n")
  );
}

if (!src.includes('resp.headers.get("PAYMENT-REQUIRED")')) {
  src = src.replace(
    /const header = resp\.headers\.get\("X-Payment-Required"\);/,
    'const header = resp.headers.get("PAYMENT-REQUIRED") || resp.headers.get("X-Payment-Required");'
  );
}

if (!src.includes("authorizePayment?:")) {
  src = src.replace(
    /  chainType\?: ChainType,\n\): Promise<X402PaymentResult> \{/,
    '  chainType?: ChainType,\n  authorizePayment?: (amountCents: number) => void | Promise<void>,\n): Promise<X402PaymentResult> {'
  );
}

if (!src.includes("NOVENS_AGENT402_QUOTE_GUARD_V2")) {
  const signMarker = "    // Sign payment";
  const at = src.indexOf(signMarker);
  if (at < 0) throw new Error("Agent402 x402 sign marker missing");
  const guard = [
    "    // NOVENS_AGENT402_QUOTE_GUARD_V2",
    "    const agent402AmountAtomic = parseMaxAmountRequired(",
    "      parsed.requirement.maxAmountRequired,",
    "      parsed.x402Version,",
    "    );",
    "    const agent402AmountCents = Number(agent402AmountAtomic) / 10_000;",
    "    if (maxPaymentCents !== undefined && agent402AmountCents > maxPaymentCents) {",
    "      return {",
    "        success: false,",
    '        error: "Payment quote exceeds configured per-call limit",',
    "        status: 402,",
    "        amountCents: agent402AmountCents,",
    "      };",
    "    }",
    "    if (authorizePayment) {",
    "      try {",
    "        await authorizePayment(agent402AmountCents);",
    "      } catch (err: any) {",
    "        return {",
    "          success: false,",
    '          error: "Payment authorization rejected: " + (err?.message || String(err)),',
    "          status: 402,",
    "          amountCents: agent402AmountCents,",
    "        };",
    "      }",
    "    }",
    ""
  ].join("\n");
  src = src.slice(0,at)+guard+src.slice(at);
}

if (!src.includes("PAYMENT-SIGNATURE")) {
  src = src.replace(
    '"X-Payment": paymentHeader,',
    '[parsed.x402Version >= 2 ? "PAYMENT-SIGNATURE" : "X-Payment"]: paymentHeader,'
  );
}

if (!src.includes('paidResp.headers.get("PAYMENT-RESPONSE")')) {
  const dataNeedle = "    const data = await paidResp.json().catch(() => paidResp.text());";
  const at = src.indexOf(dataNeedle);
  if (at < 0) throw new Error("Agent402 paid response parse marker missing");
  const insertAt=at+dataNeedle.length;
  const extra=[
    "",
    "    const paymentResponse =",
    '      paidResp.headers.get("PAYMENT-RESPONSE") ||',
    '      paidResp.headers.get("X-Payment-Response") ||',
    "      undefined;"
  ].join("\n");
  src=src.slice(0,insertAt)+extra+src.slice(insertAt);

  src=src.replace(
    /return \{ success: paidResp\.ok, response: data, status: paidResp\.status \};/,
    "return { success: paidResp.ok, response: data, status: paidResp.status, amountCents: agent402AmountCents, paymentResponse };"
  );
}

fs.writeFileSync(file, src);
console.log("[NOVENS CLOUD] x402 v2 Agent402 payment compatibility applied.");


// NOVENS_AGENT402_BASE_RPC_V1
{
  const file = "src/conway/x402.ts";
  let src = fs.readFileSync(file, "utf8");
  const from = '    const rpcUrl = process.env.AUTOMATON_RPC_URL || undefined;';
  const to = [
    '    // NOVENS x402 balance reads must use the RPC for the network being queried.',
    '    // A generic AUTOMATON_RPC_URL may point at another EVM chain and must not',
    '    // be interpreted as a valid zero balance on Base.',
    '    const rpcUrl =',
    '      network === "eip155:8453"',
    '        ? (process.env.BASE_RPC_URL || undefined)',
    '        : network === "eip155:84532"',
    '          ? (process.env.BASE_SEPOLIA_RPC_URL || undefined)',
    '          : undefined;'
  ].join("\n");
  if (!src.includes(to)) {
    if (!src.includes(from)) throw new Error("Base RPC selection target missing");
    src = src.replace(from, to);
  }
  fs.writeFileSync(file, src);
}
