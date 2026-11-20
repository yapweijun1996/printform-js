#!/usr/bin/env node
// Build the site, then validate the generated Studio v3 samples.
import path from "node:path";
import { spawnSync } from "node:child_process";

// Invoke npm's CLI through the current Node executable instead of asking the
// Windows process resolver to find a shell command named "npm". This keeps
// the same npm implementation selected by the caller and works on Windows,
// macOS and Linux without shell-specific command names.
const npmCli = path.resolve(process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"));

const steps = [
  { label: "Unit tests + production build", command: "npm", args: ["run", "build:site"] },
  { label: "Studio v3 sample validation", command: "npm", args: ["run", "verify:samples"] }
];

const results = [];
for (const step of steps) {
  console.log(`\n=== ${step.label} ===`);
  const started = Date.now();
  const result = spawnSync(process.execPath, [npmCli, ...step.args], { stdio: "inherit", windowsHide: true });
  results.push({ label: step.label, ok: result.status === 0, durationMs: Date.now() - started });
}

console.log("\n=== Doctor summary ===");
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.label}  (${(result.durationMs / 1000).toFixed(1)}s)`);
}

const failures = results.filter((result) => !result.ok);
console.log(`\n${results.length} steps, ${failures.length} failed.`);
process.exitCode = failures.length ? 1 : 0;
