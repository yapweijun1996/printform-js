#!/usr/bin/env node
// One-command local health check (ROADMAP.md §2.2): runs the unit suite,
// the production build, and validate:v2 against all pilot exports, then
// prints a one-page pass/fail summary. Streams each step's own output live
// (nothing hidden until the end) since a failing step's detail is exactly
// what a developer reaching for "doctor" wants to see immediately.
//
// Deliberately NOT the e2e suite (npm run test:e2e): that's a separate,
// slower (three-engine) check already covered by CI on every push; doctor
// is for a quick "is my working tree healthy" pass, matching the ROADMAP
// wording ("测试 + build + validate:v2 三个试点"), not a full release gate.
import path from "node:path";
import { spawnSync } from "node:child_process";

// Invoke npm's CLI through the current Node executable instead of asking the
// Windows process resolver to find a shell command named "npm". This keeps
// the same npm implementation selected by the caller and works on Windows,
// macOS and Linux without shell-specific command names.
const npmCli = path.resolve(process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"));

const PILOT_EXPORTS = [
  "site-dist/studio-v2/samples/sales-invoice-v2.html",
  "site-dist/studio-v2/samples/purchase-order-red-v2.html",
  "site-dist/studio-v2/samples/progress-claim-northpeak-v2.html"
];

const steps = [
  { label: "AGRUN vendor integrity", command: "npm", args: ["run", "check:agrun"] },
  { label: "Unit tests + production build", command: "npm", args: ["run", "build:site"] },
  ...PILOT_EXPORTS.map((file) => ({ label: `validate:v2 — ${file}`, command: "npm", args: ["run", "validate:v2", "--", file] }))
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
