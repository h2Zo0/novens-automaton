/**
 * NOVENS Stripe webhook gateway — public HTTPS edge only.
 * No Stripe API keys, no customer payment data, no locally trusted event state.
 * All webhook signatures are verified in NOVENS on the Mac.
 */
import http from "node:http";
const PORT = Number(process.env.PORT || 10000);
const MAX_BYTES = 262144;
const TIMEOUT_MS = 9500;
const SECURITY = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};
function respond(res,status,body,headers={}) {
  res.writeHead(status, {...SECURITY, "Content-Type": "application/json; charset=utf-8", ...headers});
  res.end(JSON.stringify(body));
}
async function getBody(req) {
  const chunks = []; let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function upstreamUrl() {
  const raw = process.env.NOVENS_STRIPE_UPSTREAM_URL || "";
  if (!raw) return null;
  let parsed;
  try { parsed = new URL(raw); } catch { return null; }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  if (!/^[a-z0-9-]+\.trycloudflare\.com$/i.test(parsed.hostname)) return null;
  if (parsed.pathname !== "/" && parsed.pathname !== "") return null;
  return parsed.origin;
}
async function handler(req,res) {
  const pathname = new URL(req.url || "/", "http://gateway.local").pathname;
  if (pathname === "/healthz" && req.method === "GET")
    return respond(res,200,{ service:"novens-stripe-webhook-gateway",gateway:"online",upstreamConfigured:Boolean(upstreamUrl()),paymentsEnabled:false });
  if (pathname === "/" && req.method === "GET") {
    const msg = "Votre demande a bien été transmise. Un paiement n'est confirmé qu'après vérification par le commerçant.";
    const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NOVENS · Confirmation</title><style>body{background:#0d1522;color:#f3f5fa;font:18px system-ui;margin:0;display:grid;place-items:center;min-height:100vh}main{max-width:580px;padding:32px;text-align:center}h1{font-size:32px}p{line-height:1.65;color:#b8c5da}</style><main><h1>NOVENS</h1><p>${msg}</p></main></html>`;
    res.writeHead(200,{...SECURITY,"Content-Type":"text/html; charset=utf-8"});
    return res.end(html);
  }
  if (pathname !== "/api/stripe/webhook") return respond(res,404,{error:"NOT_FOUND"});
  if (req.method !== "POST") return respond(res,405,{error:"METHOD_NOT_ALLOWED",Allow:"POST"});
  const sig = req.headers["stripe-signature"];
  if (typeof sig !== "string" || sig.length < 70 || sig.length > 3000) return respond(res,400,{error:"STRIPE_SIGNATURE_REQUIRED"});
  const upstream = upstreamUrl();
  if (!upstream) return respond(res,503,{error:"NOVENS_UPSTREAM_NOT_CONFIGURED"},{ "Retry-After":"60" });
  let raw;
  try { raw = await getBody(req); } catch { return respond(res,413,{error:"PAYLOAD_TOO_LARGE"}); }
  if (raw.length === 0) return respond(res,400,{error:"EMPTY_EVENT"});
  try {
    const answer = await fetch(upstream + "/api/stripe/webhook",{
      method:"POST",headers:{"stripe-signature":sig,"content-type":"application/json"},
      body:raw,signal:AbortSignal.timeout(TIMEOUT_MS),redirect:"error"
    });
    if (!answer.ok) return respond(res, answer.status === 400 ? 400 : 503,{error:"NOVENS_PROCESSOR_REJECTED"},{ "Retry-After":"60" });
    const result = await answer.json();
    if (result?.received !== true) return respond(res,503,{error:"NOVENS_ACK_INVALID"},{ "Retry-After":"60" });
    return respond(res,200,{received:true});
  } catch {
    return respond(res,503,{error:"NOVENS_UPSTREAM_UNAVAILABLE"},{ "Retry-After":"60" });
  }
}
http.createServer((req,res)=>{void handler(req,res).catch(()=>respond(res,503,{error:"NOVENS_GATEWAY_ERROR"},{ "Retry-After":"60" }));})
  .listen(PORT,"0.0.0.0",()=>console.log("NOVENS Stripe HTTPS gateway listening"));
