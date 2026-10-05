import fs from 'node:fs';

const p='ui/app.ts';
let s=fs.readFileSync(p,'utf8');

s=s.replace(
  "let snapshot:Snapshot|null=null, runtime:RuntimeStatus|null=null, payment:PaymentStatus|null=null, mode:'simulation'|'observed'='observed', token='',busy=false,connected=false,lastError='',range='7',search='',filter='all',tab='performance',wizardStep=1,createdId='',polling=false;",
  "let snapshot:Snapshot|null=null, runtime:RuntimeStatus|null=null, payment:PaymentStatus|null=null, portfolio:SurplusSweepPreview|null=null, portfolioCheckedAt=0, mode:'simulation'|'observed'='observed', token='',busy=false,connected=false,lastError='',range='7',search='',filter='all',tab='performance',wizardStep=1,createdId='',polling=false;"
);

s=s.replace(
  "<h3>${b?.simulated?'Fonds de simulation':'Solde du wallet · '+esc(b?.balanceNetwork||'Base')}</h3>${action('funding',icon('help'),'icon-button','aria-label=\"Informations sur les fonds\"')}</div><div class=\"address\">${money(b?.balance??null,b?.currency||currency())}</div><p>${b?.simulated?'Solde de simulation · fonds fictifs':b?.balanceAt?esc(b.balanceNetwork||'Base')+' · dernière mesure : '+when(b.balanceAt):'Aucun solde mesuré disponible'}</p>${b?.otherBalances?.map(x=>`<p>${esc(x.network)} : ${money(x.balance,'USDC')} · ${x.error?'lecture indisponible':esc(when(x.at))}</p>`).join('')||''}",
  "<h3>${b?.simulated?'Fonds de simulation':'Valeur totale du wallet'}</h3>${action('funding',icon('help'),'icon-button','aria-label=\"Informations sur les fonds\"')}</div><div class=\"address\">${b?.simulated?money(b?.balance??null,b?.currency||currency()):portfolio?money(portfolio.totalWalletEurCents/100,'EUR'):money(b?.balance??null,b?.currency||currency())}</div><p>${b?.simulated?'Solde de simulation · fonds fictifs':portfolio?'USDC + ETH · Ethereum et Base · estimation actualisée':'Calcul total indisponible · affichage USDC de secours'}</p>${!b?.simulated&&portfolio?`<p>Base : ${portfolio.baseUsdc} USDC + ${Number(portfolio.baseEth).toFixed(6)} ETH</p><p>Ethereum : ${portfolio.ethereumUsdc} USDC + ${Number(portfolio.ethereumEth).toFixed(6)} ETH</p>`:b?.otherBalances?.map(x=>`<p>${esc(x.network)} : ${money(x.balance,'USDC')} · ${x.error?'lecture indisponible':esc(when(x.at))}</p>`).join('')||''}"
);

s=s.replace(
  "${kpi('SOLDE ACTUEL',money(b.balance,b.currency),b.balanceAt?(b.balanceNetwork||'')+' · '+when(b.balanceAt):'Aucune mesure','white')}",
  "${kpi('SOLDE ACTUEL',mode==='observed'&&b.id==='main'&&portfolio?money(portfolio.totalWalletEurCents/100,'EUR'):money(b.balance,b.currency),mode==='observed'&&b.id==='main'&&portfolio?'Valeur totale estimée · Ethereum + Base':b.balanceAt?(b.balanceNetwork||'')+' · '+when(b.balanceAt):'Aucune mesure','white')}"
);

s=s.replace(
  "<td>${money(b.balance,b.currency)}${b.balanceNetwork?`<small class=\"muted\"> · ${esc(b.balanceNetwork)}</small>`:''}</td>",
  "<td>${mode==='observed'&&b.id==='main'&&portfolio?money(portfolio.totalWalletEurCents/100,'EUR'):money(b.balance,b.currency)}${mode==='observed'&&b.id==='main'&&portfolio?`<small class=\"muted\"> · total wallet</small>`:b.balanceNetwork?`<small class=\"muted\"> · ${esc(b.balanceNetwork)}</small>`:''}</td>"
);

s=s.replace(
  "const s=await api<Snapshot>('/api/snapshot?mode='+requestedMode);runtime=requestedMode==='observed'?await api<RuntimeStatus>('/api/runtime-status'):null;if(requestedMode!==mode)return;",
  "const s=await api<Snapshot>('/api/snapshot?mode='+requestedMode);runtime=requestedMode==='observed'?await api<RuntimeStatus>('/api/runtime-status'):null;if(requestedMode==='observed'&&Date.now()-portfolioCheckedAt>10000){try{portfolio=await api<SurplusSweepPreview>('/api/surplus-sweep-preview');portfolioCheckedAt=Date.now();}catch{/* Conserve la dernière estimation disponible. */}}else if(requestedMode==='simulation'){portfolio=null;}if(requestedMode!==mode)return;"
);

fs.writeFileSync(p,s);
console.log('[NOVENS CLOUD] Total wallet portfolio display patch applied.');
