import fs from "node:fs";
const file="src/agent/tools.ts";
let src=fs.readFileSync(file,"utf8");
if(!src.includes("NOVENS_SANDBOX_REUSE_V1")){
 const needle='      name: "create_sandbox",';
 const start=src.indexOf(needle);
 const end=src.indexOf('    {\n      name: "delete_sandbox"',start);
 if(start<0||end<0) throw new Error("create_sandbox block not found");
 let block=src.slice(start,end);
 const a=block.indexOf("      execute: async (args, ctx) => {");
 const b=block.indexOf("\n      },",a);
 if(a<0||b<0) throw new Error("create_sandbox execute block not found");
 const repl=[
 "      execute: async (args, ctx) => {",
 "        // NOVENS_SANDBOX_REUSE_V1",
 "        const existing = await ctx.conway.listSandboxes();",
 '        const reusable = existing.find((s) => s.status === "running") ?? existing[0];',
 '        if (reusable) return "Sandbox reused: " + reusable.id + " [" + reusable.status + "]";',
 "        try {",
 "          const info = await ctx.conway.createSandbox({ name: args.name as string, vcpu: args.vcpu as number, memoryMb: args.memory_mb as number, diskGb: args.disk_gb as number });",
 '          return "Sandbox created: " + info.id + " (" + info.vcpu + " vCPU, " + info.memoryMb + "MB RAM)";',
 "        } catch (error) {",
 "          const message = error instanceof Error ? error.message : String(error);",
 "          const lower = message.toLowerCase();",
 '          if (lower.includes("disk limit") || lower.includes("maximum allowed") || lower.includes("quota")) {',
 "            const again = await ctx.conway.listSandboxes();",
 '            const fallback = again.find((s) => s.status === "running") ?? again[0];',
 '            if (fallback) return "Sandbox reused after quota check: " + fallback.id + " [" + fallback.status + "]";',
 '            return "SANDBOX_CAPACITY_EXHAUSTED: no reusable sandbox visible; do not retry until capacity changes.";',
 "          }",
 "          throw error;",
 "        }",
 "      },"
 ].join("\n");
 block=block.slice(0,a)+repl+block.slice(b+"\n      },".length);
 src=src.slice(0,start)+block+src.slice(end);
 fs.writeFileSync(file,src);
}
console.log("[NOVENS CLOUD] Sandbox reuse patch applied.");
