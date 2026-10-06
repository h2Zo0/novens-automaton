import fs from "node:fs";

function replaceOnce(file, from, to) {
  const src = fs.readFileSync(file, "utf8");
  if (src.includes(to)) return;
  if (!src.includes(from)) throw new Error("NOVENS Daytona-standard patch target not found in " + file);
  fs.writeFileSync(file, src.replace(from, to));
}

const file = "src/compute/daytona-client.ts";

replaceOnce(
  file,
  `  const createSandbox = async (options: CreateSandboxOptions): Promise<SandboxInfo> => {
    const memoryGiB = Math.max(1, Math.ceil((options.memoryMb || 1024) / 1024));
    const sandbox = await daytona.create({
      name: options.name,
      user: "root",
      language: "typescript",
      image: "node:22-bookworm",
      resources: {
        cpu: Math.max(1, options.vcpu || 1),
        memory: memoryGiB,
        disk: Math.max(5, options.diskGb || 5),
      },
      labels: {
`,
  `  const createSandbox = async (options: CreateSandboxOptions): Promise<SandboxInfo> => {
    const sandbox = await daytona.create({
      name: options.name,
      user: "root",
      language: "typescript",
      labels: {
`
);

replaceOnce(
  file,
  `    const sandbox = await daytona.create({
      name: "novens-parent-workspace",
      user: "root",
      language: "typescript",
      image: "node:22-bookworm",
      resources: { cpu: 1, memory: 1, disk: 10 },
      labels: { novens: "true", role: "parent-workspace" },
`,
  `    const sandbox = await daytona.create({
      name: "novens-parent-workspace",
      user: "root",
      language: "typescript",
      labels: { novens: "true", role: "parent-workspace" },
`
);

if (fs.readFileSync(file, "utf8").includes('name: `novens-smoke-${Date.now()}`')) {
  replaceOnce(
    file,
    `    sandbox = await daytona.create({
      name: \`novens-smoke-\${Date.now()}\`,
      user: "root",
      language: "typescript",
      image: "node:22-bookworm",
      resources: { cpu: 1, memory: 1, disk: 5 },
      labels: { novens: "true", role: "smoke-test" },
`,
    `    sandbox = await daytona.create({
      name: \`novens-smoke-\${Date.now()}\`,
      user: "root",
      language: "typescript",
      labels: { novens: "true", role: "smoke-test" },
`
  );
}

console.log("[NOVENS CLOUD] Daytona standard sandbox mode applied.");
