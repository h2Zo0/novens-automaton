import fs from 'node:fs';

function replaceOne(path, oldText, newText) {
  let s = fs.readFileSync(path, 'utf8');
  if (!s.includes(oldText)) throw new Error('NOVENS paper patch target not found in ' + path);
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
    logger.info("[NOVENS PAPER] Isolated fictive-money mode active. Real-money and Conway actions are disabled.");
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
  `async function getFinancialState(
  conway: ConwayClient,
  address: string,
  db?: AutomatonDatabase,
  chainType?: string,
): Promise<FinancialState> {
  let creditsCents = _lastKnownCredits;
`,
  `async function getFinancialState(
  conway: ConwayClient,
  address: string,
  db?: AutomatonDatabase,
  chainType?: string,
): Promise<FinancialState> {
  if (process.env.NOVENS_PAPER_MODE === "1") {
    const requested = Number(process.env.NOVENS_PAPER_INITIAL_CENTS || "2500");
    const cents = Number.isSafeInteger(requested) && requested >= 0 ? requested : 2500;
    return {
      creditsCents: cents,
      usdcBalance: cents / 100,
      lastChecked: new Date().toISOString(),
    };
  }

  let creditsCents = _lastKnownCredits;
`
);

replaceOne(
  'src/agent/system-prompt.ts',
  `  // Layer 5: Active skill instructions (untrusted content with trust boundary markers)
`,
  `  if (process.env.NOVENS_PAPER_MODE === "1") {
    const requested = Number(process.env.NOVENS_PAPER_INITIAL_CENTS || "2500");
    const cents = Number.isSafeInteger(requested) && requested >= 0 ? requested : 2500;
    sections.push(
      \`--- NOVENS PAPER TEST (creator-authorized, isolated) ---
This is a fictive-money evaluation run. Your starting economic capital is €\${(cents / 100).toFixed(2)}.
All wallet funds, profits, losses, owner payouts, child funding and economic outcomes in this run are hypothetical.
Do not make real purchases, real transfers, real blockchain transactions, real paid deployments, or irreversible external account actions.
Use the same reasoning, planning, revenue-first discipline, accounting and €150 child-creation rules you would use in production.
You may create local artifacts and plans inside the isolated paper-test workspace.
The purpose of this run is to measure decisions and behavior, not to fabricate profits. Never claim a fictive result is real revenue.
--- END NOVENS PAPER TEST ---\`,
    );
  }

  // Layer 5: Active skill instructions (untrusted content with trust boundary markers)
`
);

replaceOne(
  'src/dashboard/server.ts',
  `  const pushRuntimeLine = (stream:'stdout'|'stderr'|'system', line:string) => {
    runtimeLines.push({at:new Date().toISOString(),stream,line});
    if(runtimeLines.length>300) runtimeLines.splice(0,runtimeLines.length-300);
  };`,
  `  const pushRuntimeLine = (stream:'stdout'|'stderr'|'system', line:string) => {
    runtimeLines.push({at:new Date().toISOString(),stream,line});
    if(runtimeLines.length>300) runtimeLines.splice(0,runtimeLines.length-300);
    if(process.env.NOVENS_PAPER_AUTOSTART==='1' || process.env.NOVENS_PAPER_MODE==='1') {
      console.log(\`[NOVENS RUNTIME][\${stream}] \${line}\`);
    }
  };`
);

replaceOne(
  'src/dashboard/server.ts',
  `  server.on('listening', () => { options.balanceMonitor?.start(); options.secondaryBalanceMonitor?.start(); });`,
  `  server.on('listening', () => {
    options.balanceMonitor?.start();
    options.secondaryBalanceMonitor?.start();

    if (cloudMode && process.env.NOVENS_PAPER_AUTOSTART === '1') {
      try {
        const untilRaw=String(process.env.NOVENS_PAPER_TEST_UNTIL || '');
        const untilMs=Date.parse(untilRaw);
        if(!Number.isFinite(untilMs) || untilMs<=Date.now()) {
          pushRuntimeLine('system','PAPER non démarré : heure de fin absente ou dépassée.');
          return;
        }

        const projectDir=path.resolve(options.publicDir,'../..');
        const realStateDir=path.dirname(options.configFile);
        const paperDir=path.join(realStateDir,'paper-test');
        const runId=String(process.env.NOVENS_PAPER_RUN_ID || untilRaw);
        const marker=path.join(paperDir,'run-id.txt');
        let fresh=true;
        try { fresh=fs.readFileSync(marker,'utf8')!==runId; } catch { fresh=true; }

        if(fresh) {
          fs.rmSync(paperDir,{recursive:true,force:true});
          fs.mkdirSync(paperDir,{recursive:true,mode:0o700});
          const source=JSON.parse(fs.readFileSync(options.configFile,'utf8'));
          const paperSkills=path.join(paperDir,'skills');
          const configuredSkills=typeof source.skillsDir==='string' ? source.skillsDir : '';
          const realSkills=configuredSkills.startsWith('~/')
            ? path.join(process.env.HOME || '',configuredSkills.slice(2))
            : configuredSkills ? path.resolve(configuredSkills) : path.join(realStateDir,'skills');
          if(fs.existsSync(realSkills)) fs.cpSync(realSkills,paperSkills,{recursive:true});
          for(const name of ['SOUL.md','WORKLOG.md','constitution.md']) {
            const from=path.join(realStateDir,name);
            if(fs.existsSync(from)) fs.copyFileSync(from,path.join(paperDir,name));
          }

          const paperConfig={
            ...source,
            name:String(source.name || 'NOVENS')+' PAPER',
            registeredWithConway:false,
            conwayApiKey:'',
            sandboxId:'paper-test',
            walletAddress:'',
            dbPath:path.join(paperDir,'state.db'),
            heartbeatConfigPath:path.join(paperDir,'heartbeat.yml'),
            skillsDir:paperSkills,
            socialRelayUrl:undefined,
            realMoneyEnabled:false,
          };
          fs.writeFileSync(path.join(paperDir,'automaton.json'),JSON.stringify(paperConfig,null,2)+'\\n',{mode:0o600});
          fs.writeFileSync(marker,runId,{mode:0o600});
          const paperHeartbeat=[
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

        if(runtimeChild && !runtimeChild.killed) {
          pushRuntimeLine('system','PAPER demandé mais un runtime est déjà actif.');
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
        setTimeout(()=>{
          if(runtimeChild===child && !child.killed) {
            runtimeState='stopping';
            pushRuntimeLine('system','Fin planifiée du test PAPER : arrêt du runtime.');
            child.kill('SIGTERM');
          }
        },Math.max(0,untilMs-Date.now()));
      } catch(err:any) {
        runtimeError=err?.message || String(err);
        runtimeState='error';
        pushRuntimeLine('system','Impossible de démarrer le PAPER : '+runtimeError);
      }
    }
  });`
);

console.log('[NOVENS CLOUD] Isolated paper-test patch applied.');