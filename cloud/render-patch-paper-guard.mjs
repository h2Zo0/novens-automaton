[Reading 234 lines from start (total: 234 lines, 0 remaining)]

import fs from 'node:fs';

function replaceOne(path, oldText, newText) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(oldText)) throw new Error('NOVENS paper/replication patch target not found in ' + path);
  s = s.replace(oldText, newText);
  fs.writeFileSync(path, s);
}

replaceOne(
  'src/index.ts',
  `  if (!config) {
    const { runSetupWizard } = await import("./setup/wizard.js");
    config = await runSetupWizard();
  }

  // Load wallet (chain-aware)
`,
  `  if (!config) {
    const { runSetupWizard } = await import("./setup/wizard.js");
    config = await runSetupWizard();
  }

  const paperMode = process.env.NOVENS_PAPER_MODE === "1";
  if (paperMode) {
    config = {
      ...config,
      realMoneyEnabled: false,
      registeredWithConway: false,
      conwayApiKey: "",
      socialRelayUrl: undefined,
    };
    logger.info("[NOVENS PAPER] Isolated paper-money mode active. Real-money and Conway actions are disabled.");
  }

  // Load wallet (chain-aware)
`
);

replaceOne(
  'src/index.ts',
  `  const apiKey = config.conwayApiKey || loadApiKeyFromConfig() || "";`,
  `  const apiKey = paperMode ? "" : (config.conwayApiKey || loadApiKeyFromConfig() || "");`
);

replaceOne(
  'src/index.ts',
  `    economyState = createEconomyState(
      automatonId,
      chainIdentity.address,
      config.ownerAddress || config.creatorAddress,
    );

    db.saveEconomyState(economyState);
`,
  `    economyState = createEconomyState(
      automatonId,
      chainIdentity.address,
      config.ownerAddress || config.creatorAddress,
    );

    if (paperMode) {
      const requested = Number(process.env.NOVENS_PAPER_INITIAL_CENTS || "2500");
      const cents = Number.isSafeInteger(requested) && requested >= 0 ? requested : 2500;
      economyState.capitalCents = BigInt(cents);
      economyState.economicValueCents = BigInt(cents);
      logger.info(\`[NOVENS PAPER] Initial fictive capital: €\${(cents / 100).toFixed(2)}\`);
    }

    db.saveEconomyState(economyState);
`
);

replaceOne(
  'src/agent/loop.ts',
  `          spawnAgent: async (task: any) => {
            // In standalone mode, spawn local workers directly.
`,
  `          spawnAgent: async (task: any) => {
            const economyId = db.getIdentity("automatonId") || identity.address;
            const parentEconomy = db.getEconomyState(economyId);
            const minReplicationCapitalCents = 15_000n;
            if (!parentEconomy || parentEconomy.economicValueCents < minReplicationCapitalCents) {
              logger.info("Replication blocked by NOVENS €150 rule", {
                taskId: task.id,
                economicValueCents: parentEconomy?.economicValueCents?.toString() ?? "missing",
                requiredCents: minReplicationCapitalCents.toString(),
              });
              return null;
            }

            // In standalone mode, spawn local workers directly.
`
);

replaceOne(
  'src/agent/tools.ts',
  `      execute: async (args, ctx) => {
        const { generateGenesisConfig, validateGenesisParams } =
`,
  `      execute: async (args, ctx) => {
        const economyId = ctx.db.getIdentity("automatonId") || ctx.identity.address;
        const parentEconomy = ctx.db.getEconomyState(economyId);
        if (!parentEconomy || parentEconomy.economicValueCents < 15_000n) {
          return "Blocked: NOVENS may create a child only when the parent has at least €150 of economic value.";
        }

        const { generateGenesisConfig, validateGenesisParams } =
`
);

replaceOne(
  'src/agent/system-prompt.ts',
  `Before spawning ANY child agent:
1. Check current active agent count against maxChildren config
2. Confirm credit budget covers the task's estimated cost
3. Prepare the task assignment message BEFORE spawning
4. Verify the requested role is valid (predefined or custom-defined in the plan)
`,
  `NOVENS REPLICATION LAW (creator-mandated, hard requirement):
- NEVER create, provision, spawn, or fund a new child/worker unless the parent currently has at least €150 of economic value.
- At an eligible replication event, the intended economics are: €50 retained by the parent, €50 owed/funded to the child, and €50 owed/paid to the human owner.
- Children that already exist because of an earlier mistake MUST NOT be destroyed merely to erase that mistake. Their obligations remain and must be resolved before optional further replication.
- This rule applies equally to local workers, Conway sandboxes, manual spawn_child calls, and orchestrator-created workers.
- If the €150 condition is not met, work solo and focus on producing value; do not repeatedly attempt replication.

Before spawning ANY child agent:
1. Verify parent economic value is at least €150
2. Check current active agent count against maxChildren config
3. Confirm credit budget covers the task's estimated cost
4. Prepare the task assignment message BEFORE spawning
5. Verify the requested role is valid (predefined or custom-defined in the plan)
`
);

replaceOne(
  'src/dashboard/server.ts',
  `  server.on('listening', () => { options.balanceMonitor?.start(); options.secondaryBalanceMonitor?.start(); });`,
  `  server.on('listening', () => {
    options.balanceMonitor?.start();
    options.secondaryBalanceMonitor?.start();

    if (cloudMode && process.env.NOVENS_PAPER_AUTOSTART === '1') {
      try {
        const untilRaw = String(process.env.NOVENS_PAPER_TEST_UNTIL || '');
        const untilMs = Date.parse(untilRaw);
        if (!Number.isFinite(untilMs) || untilMs <= Date.now()) {
          pushRuntimeLine('system','Test paper non démarré : heure de fin absente ou dépassée.');
          return;
        }

        const projectDir=path.resolve(options.publicDir,'../..');
        const paperDir=path.join(path.dirname(options.configFile),'paper-test');
        const runId=String(process.env.NOVENS_PAPER_RUN_ID || untilRaw);
        const marker=path.join(paperDir,'run-id.txt');
        let fresh=true;
        try { fresh=fs.readFileSync(marker,'utf8')!==runId; } catch { fresh=true; }
        if (fresh) {
          fs.rmSync(paperDir,{recursive:true,force:true});
          fs.mkdirSync(paperDir,{recursive:true,mode:0o700});
          const source=JSON.parse(fs.readFileSync(options.configFile,'utf8'));
          const paperConfig={
            ...source,
            name:String(source.name || 'NOVENS')+' PAPER',
            registeredWithConway:false,
            conwayApiKey:'',
            sandboxId:'paper-test',
            walletAddress:'',
            dbPath:path.join(paperDir,'state.db'),
            heartbeatConfigPath:path.join(paperDir,'heartbeat.yml'),
            skillsDir:path.join(paperDir,'skills'),
            socialRelayUrl:undefined,
            realMoneyEnabled:false,
          };
          fs.writeFileSync(path.join(paperDir,'automaton.json'),JSON.stringify(paperConfig,null,2)+'\\n',{mode:0o600});
          fs.writeFileSync(marker,runId,{mode:0o600});
          const paperHeartbeat = [
            'entries:',
            '  - { name: heartbeat_ping, schedule: "*/15 * * * *", task: heartbeat_ping, enabled: false }',
            '  - { name: check_credits, schedule: "0 */6 * * *", task: check_credits, enabled: false }',
            '  - { name: check_usdc_balance, schedule: "*/5 * * * *", task: check_usdc_balance, enabled: false }',
            '  - { name: check_for_updates, schedule: "0 */4 * * *", task: check_for_updates, enabled: false }',
            '  - { name: health_check, schedule: "*/30 * * * *", task: health_check, enabled: true }',
            '  - { name: check_social_inbox, schedule: "*/2 * * * *", task: check_social_inbox, enabled: false }',
            'defaultIntervalMs: 60000',
            'lowComputeMultiplier: 4',
            '',
          ].join(String.fromCharCode(10));
          fs.writeFileSync(path.join(paperDir,'heartbeat.yml'),paperHeartbeat,{mode:0o600});
        }

        if (runtimeChild && !runtimeChild.killed) {
          pushRuntimeLine('system','Test paper demandé mais un runtime est déjà actif.');
          return;
        }

        runtimeState='starting'; runtimeStartedAt=new Date().toISOString(); runtimeStoppedAt=null; runtimeError=null;
        pushRuntimeLine('system',\`PAPER START : capital fictif €\${(Number(process.env.NOVENS_PAPER_INITIAL_CENTS || '2500')/100).toFixed(2)}, arrêt prévu \${untilRaw}.\`);
        const child=spawn(process.execPath,[path.join(projectDir,'dist','index.js'),'--run'],{
          cwd:projectDir,
          env:{
            ...process.env,
            AUTOMATON_STATE_DIR:paperDir,
            CONWAY_API_KEY:'',
            NOVENS_PAPER_MODE:'1',
            NOVENS_UI_CONTROLLED:'1',
          },
          stdio:'pipe',
        });
        runtimeChild=child;
        const consume=(stream:'stdout'|'stderr',chunk:Buffer)=>{for(const line of chunk.toString('utf8').split(/\\r?\\n/))if(line.trim())pushRuntimeLine(stream,line);};
        child.stdout.on('data',(chunk:Buffer)=>consume('stdout',chunk));
        child.stderr.on('data',(chunk:Buffer)=>consume('stderr',chunk));
        child.once('spawn',()=>{runtimeState='running';pushRuntimeLine('system',\`PAPER Automaton lancé (PID \${child.pid ?? '?'}).\`);});
        child.once('error',(err)=>{runtimeError=err.message;runtimeState='error';pushRuntimeLine('system','Erreur PAPER : '+err.message);});
        child.once('exit',(code,signal)=>{runtimeStoppedAt=new Date().toISOString();runtimeState='stopped';pushRuntimeLine('system',\`PAPER Automaton arrêté\${signal?' par '+signal:''}\${code!==null?' (code '+code+')':''}.\`);runtimeChild=null;});
        const stopDelay=Math.max(0,untilMs-Date.now());
        setTimeout(()=>{
          if(runtimeChild===child && !child.killed) {
            runtimeState='stopping';
            pushRuntimeLine('system','Fin planifiée du test PAPER : arrêt du runtime.');
            child.kill('SIGTERM');
          }
        },stopDelay);
      } catch(err:any) {
        runtimeError=err?.message || String(err);
        runtimeState='error';
        pushRuntimeLine('system','Impossible de démarrer le test PAPER : '+runtimeError);
      }
    }
  });`
);

console.log('[NOVENS CLOUD] Paper mode and €150 replication guard patch applied.');

[executed on device: Mac.lan (70fd6287-e3d6-4d7c-82ac-8806af4ad277)]