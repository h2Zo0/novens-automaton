import fs from "node:fs";

function replaceOnce(file, from, to, marker = to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(marker)) return;
  if (!src.includes(from)) {
    throw new Error("NOVENS no-openai patch target not found in " + file);
  }
  fs.writeFileSync(file, src.replace(from, to));
}

function insertBeforeOnce(file, needle, insertion, marker) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(marker)) return;
  const at = src.indexOf(needle);
  if (at < 0) throw new Error("NOVENS no-openai insert target not found in " + file);
  fs.writeFileSync(file, src.slice(0, at) + insertion + src.slice(at));
}

// 1) Hard-disable OpenAI as an inference provider when requested, even if a
// key is still present in config or the Render environment.
replaceOnce(
  "src/agent/loop.ts",
  `      if (config.openaiApiKey && !process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = config.openaiApiKey;
      }`,
  `      if (
        process.env.NOVENS_DISABLE_OPENAI !== "1" &&
        config.openaiApiKey &&
        !process.env.OPENAI_API_KEY
      ) {
        process.env.OPENAI_API_KEY = config.openaiApiKey;
      }`,
  "process.env.NOVENS_DISABLE_OPENAI !== \"1\"",
);

replaceOnce(
  "src/inference/provider-registry.ts",
  `  private isProviderActive(provider: ProviderConfig): boolean {
    if (!provider.enabled) {`,
  `  private isProviderActive(provider: ProviderConfig): boolean {
    if (process.env.NOVENS_DISABLE_OPENAI === "1" && provider.id === "openai") {
      return false;
    }

    // Do not probe paid remote providers with placeholder/missing keys.
    if (provider.id !== "local") {
      const providerKey = process.env[provider.apiKeyEnvVar];
      if (!providerKey || providerKey.trim().length === 0) {
        return false;
      }
    }

    if (!provider.enabled) {`,
  "NOVENS_DISABLE_OPENAI",
);

// 2) The legacy direct client must also ignore OpenAI even if a key is
// still present in the persisted config.
replaceOnce(
  "src/conway/inference.ts",
  `  const { apiUrl, apiKey, openaiApiKey, anthropicApiKey, ollamaBaseUrl, getModelProvider } = options;`,
  `  const { apiUrl, apiKey, openaiApiKey, anthropicApiKey, ollamaBaseUrl, getModelProvider } = options;
  const effectiveOpenAiApiKey =
    process.env.NOVENS_DISABLE_OPENAI === "1" ? undefined : openaiApiKey;`,
  "const effectiveOpenAiApiKey =",
);

{
  const file = "src/conway/inference.ts";
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("openaiApiKey: effectiveOpenAiApiKey")) {
    src = src.replace(
      "      openaiApiKey,\\n      anthropicApiKey,",
      "      openaiApiKey: effectiveOpenAiApiKey,\\n      anthropicApiKey,",
    );
  }
  if (!src.includes('backend === "openai" ? (effectiveOpenAiApiKey as string)')) {
    src = src.replace(
      'backend === "openai" ? (openaiApiKey as string) :',
      'backend === "openai" ? (effectiveOpenAiApiKey as string) :',
    );
  }
  fs.writeFileSync(file, src);
}

// 3) Deterministic-only mode is allowed to boot without an inference provider.
{
  const file = "src/index.ts";
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("NOVENS_DETERMINISTIC_ONLY !== \"1\"")) {
    const from = "if (standaloneMode && !directProviderReady) {";
    if (src.includes(from)) {
      src = src.replace(
        from,
        'if (standaloneMode && !directProviderReady && process.env.NOVENS_DETERMINISTIC_ONLY !== "1") {',
      );
    } else {
      // Older cloud source uses the pre-model-aware provider check.
      const legacy =
        "if (standaloneMode && !directOpenAIKey && !directAnthropicKey && !configuredOllamaBaseUrl) {";
      if (src.includes(legacy)) {
        src = src.replace(
          legacy,
          'if (standaloneMode && !directOpenAIKey && !directAnthropicKey && !configuredOllamaBaseUrl && process.env.NOVENS_DETERMINISTIC_ONLY !== "1") {',
        );
      } else {
        throw new Error("NOVENS deterministic-only preflight target not found in src/index.ts");
      }
    }
    fs.writeFileSync(file, src);
  }
}

// 4) START must remain available in deterministic-only mode.
{
  const file = "src/dashboard/server.ts";
  let src = fs.readFileSync(file, "utf8");
  if (!src.includes("NOVENS deterministic-only mode does not require an external inference provider")) {
    const needle = "  const cloudInferenceReady = () => {";
    if (!src.includes(needle)) {
      throw new Error("NOVENS no-openai dashboard preflight target not found");
    }
    src = src.replace(
      needle,
      needle + `
    // NOVENS deterministic-only mode does not require an external inference provider.
    if (process.env.NOVENS_DETERMINISTIC_ONLY === "1") return true;`,
    );
    fs.writeFileSync(file, src);
  }
}

// 5) Run deterministic orchestration/heartbeat first, but never enter the
// parent LLM THINK loop in deterministic-only mode. If semantic/generative
// work is required, persist that fact instead of silently spending OpenAI.
insertBeforeOnce(
  "src/agent/loop.ts",
  "      // ── Inference Call (via router when available) ──",
  `      // NOVENS_DETERMINISTIC_ONLY_GATE_V1
      if (process.env.NOVENS_DETERMINISTIC_ONLY === "1") {
        let reasoningTask: { id?: string; title?: string; description?: string } | undefined;
        try {
          reasoningTask = db.raw.prepare(
            "SELECT id, title, description FROM task_graph " +
            "WHERE assigned_to = ? AND status IN ('assigned','running') " +
            "ORDER BY priority DESC, created_at ASC LIMIT 1",
          ).get(identity.address) as
            | { id?: string; title?: string; description?: string }
            | undefined;
        } catch {
          reasoningTask = undefined;
        }

        if (reasoningTask?.id) {
          db.setKV("reasoning_required.task_id", String(reasoningTask.id));
          db.setKV(
            "reasoning_required.reason",
            "Parent task needs semantic/generative execution; direct OpenAI is disabled.",
          );
          log(
            config,
            \`[DETERMINISTIC] Task \${reasoningTask.id} requires reasoning. OpenAI is disabled; no inference call made.\`,
          );
        } else {
          db.deleteKV("reasoning_required.task_id");
          db.deleteKV("reasoning_required.reason");
          log(
            config,
            "[DETERMINISTIC] Scheduler/orchestrator tick complete. No LLM inference call made.",
          );
        }

        db.setKV("sleep_until", new Date(Date.now() + 60_000).toISOString());
        db.setAgentState("sleeping");
        onStateChange?.("sleeping");
        running = false;
        break;
      }

`,
  "NOVENS_DETERMINISTIC_ONLY_GATE_V1",
);

// 6) Respect the persisted cooldown before any later continuous-mode override.
// This intercepts sleeping immediately after runAgentLoop returns.
insertBeforeOnce(
  "src/index.ts",
  "      // Agent loop exited (sleeping or dead)",
  `      // NOVENS_RESPECT_COOLDOWN_V1
      if (
        process.env.NOVENS_RESPECT_COOLDOWN === "1" &&
        db.getAgentState() === "sleeping"
      ) {
        const cooldownRaw = db.getKV("sleep_until");
        const cooldownUntil = cooldownRaw
          ? Date.parse(cooldownRaw)
          : Date.now() + 60_000;
        const target = Number.isFinite(cooldownUntil)
          ? Math.max(cooldownUntil, Date.now() + 1_000)
          : Date.now() + 60_000;

        logger.info(
          \`[NOVENS COOLDOWN] Deterministic sleep respected for \${Math.max(1, Math.ceil((target - Date.now()) / 1000))}s.\`,
        );

        while (Date.now() < target) {
          await sleep(Math.min(5_000, Math.max(250, target - Date.now())));
        }

        db.deleteKV("sleep_until");
        continue;
      }

`,
  "NOVENS_RESPECT_COOLDOWN_V1",
);

console.log("[NOVENS CLOUD] OpenAI disabled; deterministic-first execution enforced.");
