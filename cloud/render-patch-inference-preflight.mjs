import fs from 'node:fs';

function replaceOne(path, oldText, newText) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(oldText)) throw new Error('NOVENS model-aware patch target not found in ' + path);
  s = s.replace(oldText, newText);
  fs.writeFileSync(path, s);
}

replaceOne(
  'src/index.ts',
  `  if (standaloneMode && !directOpenAIKey && !directAnthropicKey && !configuredOllamaBaseUrl) {
    logger.error(
      "No inference provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or OLLAMA_BASE_URL. Conway is optional.",
    );
    process.exit(1);
  }
`,
  `  const configuredModel = config.inferenceModel || "";
  const directProviderReady = configuredOllamaBaseUrl ||
    (/^claude/i.test(configuredModel) ? Boolean(directAnthropicKey) :
      /^(?:gpt-|o[1-9](?:[-.\\s]|$)|chatgpt)/i.test(configuredModel) ? Boolean(directOpenAIKey) :
      Boolean(directOpenAIKey || directAnthropicKey));

  if (standaloneMode && !directProviderReady) {
    logger.error(
      \`No compatible inference provider configured for \${configuredModel || "the selected model"}. \` +
      "Set the matching provider API key or a reachable external OLLAMA_BASE_URL.",
    );
    process.exit(1);
  }
`
);

replaceOne(
  'src/dashboard/server.ts',
  `    return Boolean(
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.CONWAY_API_KEY ||
      config.openaiApiKey ||
      config.anthropicApiKey ||
      config.conwayApiKey ||
      safeExternalOllama
    );
`,
  `    const model = String(config.inferenceModel || '');
    const openai = Boolean(process.env.OPENAI_API_KEY || config.openaiApiKey);
    const anthropic = Boolean(process.env.ANTHROPIC_API_KEY || config.anthropicApiKey);
    const conway = Boolean(process.env.CONWAY_API_KEY || config.conwayApiKey);
    if (safeExternalOllama || conway) return true;
    if (/^claude/i.test(model)) return anthropic;
    if (/^(?:gpt-|o[1-9](?:[-.\\s]|$)|chatgpt)/i.test(model)) return openai;
    return openai || anthropic;
`
);

replaceOne(
  'src/dashboard/server.ts',
  `              throw new DashboardError(409,'Fournisseur IA cloud non configuré. Ajoutez OPENAI_API_KEY ou ANTHROPIC_API_KEY dans Render avant START.');
`,
  `              throw new DashboardError(409,'Fournisseur IA compatible non configuré. Pour le modèle actuel, ajoutez la clé API correspondante dans Render avant START.');
`
);

console.log('[NOVENS CLOUD] Model-aware inference preflight patch applied.');
