import fs from 'node:fs';

function replaceOne(path, oldText, newText) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(oldText)) throw new Error('NOVENS cloud patch target not found in ' + path);
  s = s.replace(oldText, newText);
  fs.writeFileSync(path, s);
}

replaceOne(
  'src/index.ts',
  `  const directOpenAIKey = process.env.OPENAI_API_KEY || config.openaiApiKey;
  const directAnthropicKey = process.env.ANTHROPIC_API_KEY || config.anthropicApiKey;
  const configuredOllamaBaseUrl = process.env.OLLAMA_BASE_URL || config.ollamaBaseUrl;
  const standaloneMode = !apiKey;
`,
  `  const directOpenAIKey = process.env.OPENAI_API_KEY || config.openaiApiKey;
  const directAnthropicKey = process.env.ANTHROPIC_API_KEY || config.anthropicApiKey;
  const cloudMode = process.env.NOVENS_CLOUD_MODE === "1";
  const envOllamaBaseUrl = process.env.OLLAMA_BASE_URL?.trim();
  const configuredOllamaBaseUrl = cloudMode
    ? (envOllamaBaseUrl && !/^http:\\/\\/(?:127\\.0\\.0\\.1|localhost|\\[::1\\])(?::|\\/|$)/i.test(envOllamaBaseUrl)
        ? envOllamaBaseUrl
        : undefined)
    : (envOllamaBaseUrl || config.ollamaBaseUrl);
  const standaloneMode = !apiKey;
`
);

replaceOne(
  'src/index.ts',
  `  if (standaloneMode) {
    logger.info("[NOVENS] Standalone mode enabled: Conway provisioning is disabled.");
  }
`,
  `  if (cloudMode && config.ollamaBaseUrl && !envOllamaBaseUrl) {
    logger.info("[NOVENS CLOUD] Ignoring Mac-local Ollama configuration in cloud mode.");
  }

  if (standaloneMode) {
    logger.info(
      cloudMode
        ? "[NOVENS] Standalone cloud mode enabled: local cloud-worker provisioning active; Conway provisioning disabled."
        : "[NOVENS] Standalone mode enabled: Conway provisioning is disabled.",
    );
  }
`
);

replaceOne(
  'src/index.ts',
  `  // Initialize state repo (git)
  try {
    await initStateRepo(conway);
    logger.info(\`[\${new Date().toISOString()}] State repo initialized.\`);
  } catch (err: any) {
    logger.warn(\`[\${new Date().toISOString()}] State repo init failed: \${err.message}\`);
  }

  // In armed real-money mode, Automaton may bootstrap itself autonomously.
  // Every real payment still passes through the durable fixed cumulative envelope.
  if (config.realMoneyEnabled === true) try {
`,
  `  // Initialize state repo (git). In standalone cloud mode the durable state
  // already lives on the mounted persistent disk; the Conway/local-shell
  // sandbox must not be used to reach outside its own workspace.
  if (cloudMode && standaloneMode) {
    logger.info("[NOVENS CLOUD] Persistent state disk active; git state-repo bootstrap skipped.");
  } else {
    try {
      await initStateRepo(conway);
      logger.info(\`[\${new Date().toISOString()}] State repo initialized.\`);
    } catch (err: any) {
      logger.warn(\`[\${new Date().toISOString()}] State repo init failed: \${err.message}\`);
    }
  }

  // In armed real-money mode, Automaton may bootstrap Conway credits only
  // when Conway is actually configured. Standalone direct-provider mode has
  // no Conway credit balance to top up.
  if (!standaloneMode && config.realMoneyEnabled === true) try {
`
);

replaceOne(
  'src/heartbeat/tasks.ts',
  `  health_check: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    // Check that the sandbox is healthy
    try {
      const result = await taskCtx.conway.exec("echo alive", 5000);
`,
  `  health_check: async (_ctx: TickContext, taskCtx: HeartbeatLegacyContext) => {
    // Render/Linux cloud mode has no macOS sandbox-exec. Health-check the
    // durable SQLite state directly instead of intentionally failing shell exec.
    if (process.env.NOVENS_CLOUD_MODE === "1") {
      try {
        const row = taskCtx.db.raw.prepare("SELECT 1 AS ok").get() as { ok?: number } | undefined;
        if (row?.ok !== 1) throw new Error("SQLite health probe failed");
        taskCtx.db.setKV("health_check_status", "ok");
        taskCtx.db.setKV("last_health_check", new Date().toISOString());
        return { shouldWake: false };
      } catch (err: any) {
        const prevStatus = taskCtx.db.getKV("health_check_status");
        if (prevStatus !== "failing") {
          taskCtx.db.setKV("health_check_status", "failing");
          return { shouldWake: true, message: \`Cloud state health check failed: \${err.message}\` };
        }
        return { shouldWake: false };
      }
    }

    // Local macOS mode: check that the sandbox is healthy.
    try {
      const result = await taskCtx.conway.exec("echo alive", 5000);
`
);

replaceOne(
  'src/agent/loop.ts',
  `      workerPool = initializedWorkerPool;

      orchestrator = new Orchestrator({
`,
  `      workerPool = initializedWorkerPool;

      // local:// workers live in the current cloud process. Their DB records
      // survive a Render restart, but their in-memory process does not.
      // Mark stale cloud workers stopped so fresh workers can be provisioned.
      if (process.env.NOVENS_CLOUD_MODE === "1") {
        db.raw.prepare(
          "UPDATE children SET status = 'stopped', last_checked = datetime('now') WHERE address LIKE 'local://%' AND status IN ('running','healthy')",
        ).run();
      }

      orchestrator = new Orchestrator({
`
);

replaceOne(
  'src/dashboard/server.ts',
  `  const cloudMode = process.env.NOVENS_CLOUD_MODE === '1';
`,
  `  const cloudMode = process.env.NOVENS_CLOUD_MODE === '1';
  const cloudInferenceReady = () => {
    let config: Record<string, unknown> = {};
    try { config = JSON.parse(fs.readFileSync(options.configFile, 'utf8')); } catch { /* false below */ }
    const externalOllama = String(process.env.OLLAMA_BASE_URL || '').trim();
    const safeExternalOllama = externalOllama && !/^http:\\/\\/(?:127\\.0\\.0\\.1|localhost|\\[::1\\])(?::|\\/|$)/i.test(externalOllama);
    return Boolean(
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CONWAY_API_KEY ||
      config.openaiApiKey ||
      config.anthropicApiKey ||
      config.conwayApiKey ||
      safeExternalOllama
    );
  };
`
);

replaceOne(
  'src/dashboard/server.ts',
  `          if(action==='start') {
            if(runtimeChild && !runtimeChild.killed) return send(res,200,runtimeStatus());
            const projectDir=path.resolve(options.publicDir,'../..');
`,
  `          if(action==='start') {
            if(runtimeChild && !runtimeChild.killed) return send(res,200,runtimeStatus());
            if(cloudMode && !cloudInferenceReady()) {
              throw new DashboardError(409,'Fournisseur IA cloud non configuré. Ajoutez OPENAI_API_KEY ou ANTHROPIC_API_KEY dans Render avant START.');
            }
            const projectDir=path.resolve(options.publicDir,'../..');
`
);

console.log('[NOVENS CLOUD] Runtime cloud safety and persistence patch applied.');
