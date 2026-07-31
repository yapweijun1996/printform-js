#!/usr/bin/env node
// Release-process acceptance for the P0-B exit condition: both pilot templates
// across every desktop browser target and every boundary scenario, with the
// result written down (docs/BROWSER_MATRIX.zh-CN.md).
//
// This is deliberately NOT part of `npm test` / CI. It is slow (roughly 15-25
// minutes), it drives branded browsers that only exist on a developer machine,
// and its purpose is to produce a signed-off record for a release — not to gate
// every commit. CI's three-engine Playwright run stays the per-commit net.
//
// Usage: node scripts/browser-matrix.mjs [--quick]
//   --quick  skips the 100/500-row scenarios (smoke pass while iterating)

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium, firefox, webkit } from "@playwright/test";

const QUICK = process.argv.includes("--quick");
const PORT = 4176; // not 4174: never fight the dev preview server for a port
const BASE = `http://127.0.0.1:${PORT}`;

// Chromium and branded Chrome share an engine, and Playwright's WebKit is not
// literally Safari. Both facts are recorded in the report rather than papered
// over — claiming four independent engines would be exactly the kind of
// self-declaration the trust model rejects.
const TARGETS = [
  { id: "chromium", label: "Chromium (bundled)", type: chromium, options: {} },
  { id: "chrome", label: "Google Chrome (branded)", type: chromium, options: { channel: "chrome" } },
  { id: "firefox", label: "Firefox", type: firefox, options: {} },
  { id: "webkit", label: "WebKit (Safari engine)", type: webkit, options: {} }
];

const SAMPLES = [
  { key: "sales-invoice", label: "Sales Invoice" },
  { key: "purchase-order-red", label: "Purchase Order (Crimson)" }
];

const SCENARIOS = QUICK
  ? ["default", "empty", "one", "45-rows", "long-text"]
  : ["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"];
const LOCALES = ["zh-CN", "ms-MY", "ja-JP", "vi-VN"]; // en-MY is covered by the default pass

// "empty" is SUPPOSED to be blocked: an invoice with no line items fails schema
// validation by design. Treating that as a matrix failure would train everyone
// to ignore the report.
const EXPECTED_BLOCKED = new Set(["empty"]);

function startServer() {
  // serve-site.mjs takes the root as argv[2] and the port from PORT.
  return spawn("node", ["scripts/serve-site.mjs", "site-dist"], { stdio: "ignore", env: { ...process.env, PORT: String(PORT) } });
}

async function waitForSettledRender(page) {
  // Status class, not text: the label is localized and this sweep changes locale.
  await page.waitForFunction(() => {
    const node = document.querySelector("#render-status");
    return node && (node.classList.contains("ready") || node.classList.contains("blocked"));
  }, { timeout: 120_000 });
}

async function readState(page) {
  return page.evaluate(async () => {
    const result = await window.PrintFormStudioAgent.execute("validate_project", {});
    const validation = result.result.validation;
    const frame = document.querySelector("#preview-frame");
    return {
      valid: validation.valid,
      metrics: validation.metrics,
      errors: validation.errors.map((item) => item.code),
      status: document.querySelector("#render-status").className.replace("status ", "")
    };
  });
}

async function rowsPerPage(page) {
  // The preview iframe is sandboxed with an opaque origin, so page JS cannot
  // read it — but CDP can, which is why this runs from the driver, not the page.
  const frame = page.frameLocator("#preview-frame");
  return frame.locator(".printform_page").evaluateAll((nodes) => nodes.map((node) => node.querySelectorAll(".prowitem_processed").length));
}

async function runCell(page, { sample, scenario, locale }) {
  await page.goto(`${BASE}/studio-v2/?sample=${sample}`);
  await waitForSettledRender(page);
  if (locale) {
    const revision = await page.evaluate(async (target) => {
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary", {});
      await window.PrintFormStudioAgent.execute("set_locale", { expectedRevision: summary.result.revision, locale: target });
      return true;
    }, locale);
    await waitForSettledRender(page);
  }
  if (scenario && scenario !== "default") {
    await page.evaluate(async (target) => {
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary", {});
      await window.PrintFormStudioAgent.execute("set_sample_scenario", { expectedRevision: summary.result.revision, scenario: target });
    }, scenario);
    await waitForSettledRender(page);
  }
  const state = await readState(page);
  return { ...state, rows: await rowsPerPage(page) };
}

function verdict(cell, scenario) {
  const problems = [];
  const expectBlocked = EXPECTED_BLOCKED.has(scenario);
  if (expectBlocked && cell.status !== "blocked") problems.push("expected blocked, got ready");
  if (!expectBlocked && cell.status !== "ready") problems.push(`status=${cell.status} [${cell.errors.join(",")}]`);
  if (!expectBlocked) {
    const m = cell.metrics || {};
    if (m.overflowElements) problems.push(`overflow=${m.overflowElements}`);
    if (m.verticalOverflowPages) problems.push(`vOverflow=${m.verticalOverflowPages}`);
    if (m.contrastFailures) problems.push(`contrast=${m.contrastFailures}`);
    if (m.expectedRows !== undefined && m.renderedRows !== m.expectedRows) problems.push(`rows ${m.renderedRows}!=${m.expectedRows}`);
  }
  return problems;
}

const server = startServer();
await new Promise((resolve) => setTimeout(resolve, 1500));
const results = [];
const started = new Date().toISOString();

try {
  for (const target of TARGETS) {
    let browser;
    try {
      browser = await target.type.launch(target.options);
    } catch (error) {
      results.push({ target: target.id, unavailable: error.message.split("\n")[0] });
      console.log(`SKIP ${target.id}: ${error.message.split("\n")[0]}`);
      continue;
    }
    for (const sample of SAMPLES) {
      for (const scenario of SCENARIOS) {
        const page = await browser.newPage();
        try {
          const cell = await runCell(page, { sample: sample.key, scenario });
          const problems = verdict(cell, scenario);
          results.push({ target: target.id, sample: sample.key, scenario, locale: "en-MY", ...cell, problems });
          console.log(`${problems.length ? "FAIL" : "ok  "} ${target.id} ${sample.key} ${scenario} pages=${cell.metrics?.logicalPages} rows=${JSON.stringify(cell.rows)} ${problems.join("; ")}`);
        } catch (error) {
          results.push({ target: target.id, sample: sample.key, scenario, locale: "en-MY", problems: [`threw: ${error.message.split("\n")[0]}`] });
          console.log(`ERR  ${target.id} ${sample.key} ${scenario}: ${error.message.split("\n")[0]}`);
        }
        await page.close();
      }
      for (const locale of LOCALES) {
        const page = await browser.newPage();
        try {
          const cell = await runCell(page, { sample: sample.key, scenario: "default", locale });
          const problems = verdict(cell, "default");
          results.push({ target: target.id, sample: sample.key, scenario: "default", locale, ...cell, problems });
          console.log(`${problems.length ? "FAIL" : "ok  "} ${target.id} ${sample.key} locale:${locale} pages=${cell.metrics?.logicalPages} ${problems.join("; ")}`);
        } catch (error) {
          results.push({ target: target.id, sample: sample.key, scenario: "default", locale, problems: [`threw: ${error.message.split("\n")[0]}`] });
          console.log(`ERR  ${target.id} ${sample.key} locale:${locale}: ${error.message.split("\n")[0]}`);
        }
        await page.close();
      }
    }
    await browser.close();
  }
} finally {
  server.kill();
}

const outPath = path.resolve("browser-matrix-result.json");
fs.writeFileSync(outPath, JSON.stringify({ started, finished: new Date().toISOString(), quick: QUICK, results }, null, 2));
const failures = results.filter((row) => row.problems?.length);
console.log(`\n${results.length} cells, ${failures.length} with problems. Raw JSON: ${outPath}`);
process.exitCode = failures.length ? 1 : 0;
