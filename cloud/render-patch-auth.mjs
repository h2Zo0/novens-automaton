import fs from 'node:fs';

const p='src/dashboard/server.ts';
let s=fs.readFileSync(p,'utf8');

s=s.replace(
  "import { randomBytes, timingSafeEqual } from 'node:crypto';",
  "import { randomBytes, timingSafeEqual, createHmac } from 'node:crypto';"
);

s=s.replace(
  "  const uiPassword = process.env.NOVENS_UI_PASSWORD || '';\n",
  "  const uiPassword = process.env.NOVENS_UI_PASSWORD || '';\n  const sessionSecret = process.env.NOVENS_SESSION_SECRET || uiPassword;\n  const sessionCookieName = 'novens_session';\n  const sessionToken = () => createHmac('sha256', sessionSecret).update(uiUser+'\\n'+uiPassword).digest('hex');\n"
);

const oldBlock=`      if(cloudMode) {
        if(!uiUser || !uiPassword) throw new DashboardError(503,'Authentification cloud non configurée.');
        const supplied=Buffer.from(String(req.headers.authorization || ''));
        const expected=Buffer.from('Basic '+Buffer.from(uiUser+':'+uiPassword).toString('base64'));
        if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)) {
          res.setHeader('WWW-Authenticate','Basic realm="NOVENS Automaton"');
          return send(res,401,{error:'Authentification requise.'});
        }
      }
`;

const newBlock=`      if(cloudMode) {
        if(!uiUser || !uiPassword || !sessionSecret) throw new DashboardError(503,'Authentification cloud non configurée.');
        const cookies=Object.fromEntries(String(req.headers.cookie || '').split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return i<0?[v,'']:[v.slice(0,i),v.slice(i+1)];}));
        const expectedSession=Buffer.from(sessionToken());
        const suppliedSession=Buffer.from(String(cookies[sessionCookieName] || ''));
        let authenticated=suppliedSession.length===expectedSession.length && timingSafeEqual(suppliedSession,expectedSession);
        if(!authenticated) {
          const supplied=Buffer.from(String(req.headers.authorization || ''));
          const expected=Buffer.from('Basic '+Buffer.from(uiUser+':'+uiPassword).toString('base64'));
          authenticated=supplied.length===expected.length && timingSafeEqual(supplied,expected);
          if(!authenticated) {
            res.setHeader('WWW-Authenticate','Basic realm="NOVENS Automaton"');
            return send(res,401,{error:'Authentification requise.'});
          }
          res.setHeader('Set-Cookie',sessionCookieName+'='+sessionToken()+'; Max-Age=31536000; Path=/; HttpOnly; Secure; SameSite=Strict');
        }
      }
`;

if(!s.includes(oldBlock)) throw new Error('auth block not found');
s=s.replace(oldBlock,newBlock);

fs.writeFileSync(p,s);
console.log('[NOVENS CLOUD] Persistent browser session patch applied.');
