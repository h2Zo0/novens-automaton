import fs from "node:fs";

const file = "src/conway/x402.ts";
let src = fs.readFileSync(file, "utf8");

if (!src.includes("amountCents?: number")) {
  src = src.replace(
    "interface X402PaymentResult {\n  success: boolean;\n  response?: any;\n  error?: string;\n  status?: number;\n}",
    "export interface X402PaymentResult {\n  success: boolean;\n  response?: any;\n  error?: string;\n  status?: number;\n  amountCents?: number;\n  paymentResponse?: string;\n}"
  );
}

if (!src.includes('typeof value.amount === "string"')) {
  const oldAmount = [
    '  const maxAmountRequired = typeof value.maxAmountRequired === "string"',
    '    ? value.maxAmountRequired',
    '    : typeof value.maxAmountRequired === "number" &&',
    '        Number.isFinite(value.maxAmountRequired)',
    '      ? String(value.maxAmountRequired)',
    '      : null;'
  ].join("\n");
  const newAmount = [
    '  const maxAmountRequired = typeof value.maxAmountRequired === "string"',
    '    ? value.maxAmountRequired',
    '    : typeof value.maxAmountRequired === "number" &&',
    '        Number.isFinite(value.maxAmountRequired)',
    '      ? String(value.maxAmountRequired)',
    '      : typeof value.amount === "string"',
    '        ? value.amount',
    '        : typeof value.amount === "number" && Number.isFinite(value.amount)',
    '          ? String(value.amount)',
    '          : null;'
  ].join("\n");
  if (!src.includes(oldAmount)) throw new Error("Agent402 x402 amount target missing");
  src = src.replace(oldAmount, newAmount);
}

if (!src.includes('resp.headers.get("PAYMENT-REQUIRED")')) {
  src = src.replace(
    '  const header = resp.headers.get("X-Payment-Required");',
    '  const header = resp.headers.get("PAYMENT-REQUIRED") || resp.headers.get("X-Payment-Required");'
  );
}

if (!src.includes("authorizePayment?:")) {
  src = src.replace(
    "  maxPaymentCents?: number,\n  chainType?: ChainType,\n): Promise<X402PaymentResult> {",
    "  maxPaymentCents?: number,\n  chainType?: ChainType,\n  authorizePayment?: (amountCents: number) => void | Promise<void>,\n): Promise<X402PaymentResult> {"
  );
}

if (!src.includes("Quote is free. Validate the quoted amount")) {
  const start = src.indexOf("    // Check amount against maxPaymentCents BEFORE signing");
  const end = src.indexOf("    // Sign payment", start);
  if (start < 0 || end < 0) throw new Error("Agent402 x402 amount-check block missing");
  const replacement = [
    "    // Quote is free. Validate the quoted amount before any signature.",
    "    const amountAtomic = parseMaxAmountRequired(",
    "      parsed.requirement.maxAmountRequired,",
    "      parsed.x402Version,",
    "    );",
    "    const amountCents = Number(amountAtomic) / 10_000;",
    "",
    "    if (maxPaymentCents !== undefined && amountCents > maxPaymentCents) {",
    "      return {",
    "        success: false,",
    "        error: \"Payment quote exceeds configured per-call limit\",",
    "        status: 402,",
    "        amountCents,",
    "      };",
    "    }",
    "",
    "    if (authorizePayment) {",
    "      try {",
    "        await authorizePayment(amountCents);",
    "      } catch (err: any) {",
    "        return {",
    "          success: false,",
    "          error: \"Payment authorization rejected: \" + (err?.message || String(err)),",
    "          status: 402,",
    "          amountCents,",
    "        };",
    "      }",
    "    }",
    "",
  ].join("\n");
  src = src.slice(0, start) + replacement + src.slice(end);
}

if (!src.includes("paymentHeaderName")) {
  const start = src.indexOf("    const paidResp = await x402HttpClient.request(url, {");
  const endNeedle = "    return { success: paidResp.ok, response: data, status: paidResp.status };";
  const end = src.indexOf(endNeedle, start);
  if (start < 0 || end < 0) throw new Error("Agent402 x402 paid-response block missing");
  const endPos = end + endNeedle.length;
  const replacement = [
    '    const paymentHeaderName = parsed.x402Version >= 2 ? "PAYMENT-SIGNATURE" : "X-Payment";',
    "    const paidResp = await x402HttpClient.request(url, {",
    "      method,",
    "      headers: {",
    "        ...headers,",
    '        "Content-Type": "application/json",',
    "        [paymentHeaderName]: paymentHeader,",
    "      },",
    "      body,",
    "      retries: 0,",
    "    });",
    "",
    "    const data = await paidResp.json().catch(() => paidResp.text());",
    "    const paymentResponse =",
    '      paidResp.headers.get("PAYMENT-RESPONSE") ||',
    '      paidResp.headers.get("X-Payment-Response") ||',
    "      undefined;",
    "    return {",
    "      success: paidResp.ok,",
    "      response: data,",
    "      status: paidResp.status,",
    "      amountCents,",
    "      paymentResponse,",
    "    };"
  ].join("\n");
  src = src.slice(0, start) + replacement + src.slice(endPos);
}

fs.writeFileSync(file, src);
console.log("[NOVENS CLOUD] x402 v2 Agent402 payment compatibility applied.");
