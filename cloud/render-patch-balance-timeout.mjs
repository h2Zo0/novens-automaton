import fs from "node:fs";

function replaceOnce(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error("NOVENS balance-timeout patch target not found in " + file);
  fs.writeFileSync(file, src.replace(from, to));
}

replaceOnce(
  "src/agent/tools.ts",
  `        const [ethereum, baseBalance] = await Promise.all([
          getUsdcBalance(ctx.identity.address, "eip155:1", chainType),
          getUsdcBalance(ctx.identity.address, "eip155:8453", chainType),
        ]);
        return \`USDC balances — Ethereum: \${ethereum.toFixed(6)} USDC; Base: \${baseBalance.toFixed(6)} USDC\`;
`,
  `        const withTimeout = async (
          promise: Promise<number>,
          timeoutMs = 12_000,
        ): Promise<number | null> => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            return await Promise.race([
              promise,
              new Promise<null>((resolve) => {
                timer = setTimeout(() => resolve(null), timeoutMs);
              }),
            ]);
          } finally {
            if (timer) clearTimeout(timer);
          }
        };

        const [ethereum, baseBalance] = await Promise.all([
          withTimeout(
            getUsdcBalance(ctx.identity.address, "eip155:1", chainType),
          ),
          withTimeout(
            getUsdcBalance(ctx.identity.address, "eip155:8453", chainType),
          ),
        ]);

        const ethText =
          ethereum === null ? "unavailable (timeout)" : \`\${ethereum.toFixed(6)} USDC\`;
        const baseText =
          baseBalance === null ? "unavailable (timeout)" : \`\${baseBalance.toFixed(6)} USDC\`;
        return \`USDC balances — Ethereum: \${ethText}; Base: \${baseText}\`;
`
);

replaceOnce(
  "src/agent/loop.ts",
  `          const blockedIdleInspection = new Set([
            "list_goals",
            "orchestrator_status",
            "get_plan",
          ]);
`,
  `          const blockedIdleInspection = new Set([
            "list_goals",
            "orchestrator_status",
            "get_plan",
            "check_usdc_balance",
          ]);
`
);

console.log("[NOVENS CLOUD] Wallet timeout + idle-balance guard applied.");
