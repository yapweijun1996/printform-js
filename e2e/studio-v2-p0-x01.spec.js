import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARY = "P0-X01-UNKNOWN-CANARY-20260909";
const FIXTURE_ID = "p0-x01-canary";
const SOURCE = path.resolve(process.cwd(), "site-dist/studio-v2/samples/sales-invoice-v2.html");
const JSON_IDS = ["pf-manifest", "pf-schema", "pf-i18n", "pf-form-spec", "pf-sample-data", "pf-attestation"];

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => ({ ...result, [key]: sorted(value[key]) }), {});
}

function stable(value) { return JSON.stringify(sorted(value), null, 2); }

function sha256(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex"); }

function jsonSection(document, id) { return JSON.parse(document.getElementById(id).textContent); }

function setJsonSection(document, id, value) { document.getElementById(id).textContent = `\n${stable(value)}\n`; }

function makeCanaryFixture() {
  const dom = new JSDOM(fs.readFileSync(SOURCE, "utf8"));
  const document = dom.window.document;
  const manifest = jsonSection(document, "pf-manifest");
  const schema = jsonSection(document, "pf-schema");
  const i18n = jsonSection(document, "pf-i18n");
  const spec = jsonSection(document, "pf-form-spec");
  const sampleData = jsonSection(document, "pf-sample-data");
  const attestation = jsonSection(document, "pf-attestation");
  manifest.documentId = FIXTURE_ID;
  manifest.title = "P0 X-01 Synthetic Canary";
  sampleData.customer.name = CANARY;
  const template = document.getElementById("pf-template");
  template.innerHTML = template.innerHTML
    .replace('class="prowheader pf-grid"', 'class="prowheader pf-grid scope-table-a-header" data-pf-table-id="a"')
    .replace('class="prowitem pf-grid"', 'class="prowitem pf-grid scope-table-a-row" data-pf-table-id="a"');
  for (const component of spec.components || []) {
    if (component.tableId === "default") component.tableId = "a";
    if (typeof component.id === "string") component.id = component.id.replaceAll("table-default", "table-a");
  }
  for (const section of spec.sections || []) {
    if (typeof section.id === "string") section.id = section.id.replaceAll("table-default", "table-a");
    section.componentIds = (section.componentIds || []).map((id) => String(id).replaceAll("table-default", "table-a"));
  }
  setJsonSection(document, "pf-manifest", manifest);
  setJsonSection(document, "pf-form-spec", spec);
  setJsonSection(document, "pf-sample-data", sampleData);
  const runtime = document.getElementById("pf-document-runtime");
  const canonical = [stable(manifest), stable(schema)];
  if (Object.keys(i18n).length) canonical.push(stable(i18n));
  canonical.push(document.getElementById("pf-theme").textContent.trim());
  canonical.push(template.innerHTML.trim(), stable(spec), stable(sampleData), runtime?.dataset.version || "", runtime?.dataset.hash || "");
  attestation.contentHash = sha256(canonical.join("\n---printform-section---\n"));
  setJsonSection(document, "pf-attestation", attestation);
  return Buffer.from(dom.serialize(), "utf8");
}

function noKnownBrowserDiagnostics(testInfo, errors, diagnostics) {
  const known = testInfo.project.name === "firefox" && diagnostics.some((message) =>
    /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message));
  expect(errors).toEqual([]);
  expect(diagnostics.filter((message) => !/Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message))).toEqual([]);
  if (known) testInfo.annotations.push({ type: "known-browser-diagnostic", description: "Firefox reports the existing AGRUN CSP eval diagnostic." });
}

async function selectSyntheticByokProfile(page) {
  await page.locator("#ai-settings-button").click();
  await page.locator("#ai-settings-tab-vault").click();
  await page.locator("#ai-vault-passphrase").fill("P0 X01 local vault passphrase 20260909");
  await page.locator("#ai-unlock-vault").click();
  await expect(page.locator("#ai-settings-status")).toHaveText(/Vault unlocked/i);
  await page.locator("#ai-settings-tab-provider").click();
  await page.locator("#ai-profile-id").fill("p0-x01-local-provider");
  await page.locator("#ai-provider").selectOption("custom");
  await page.locator("#ai-model").fill("p0-x01-model");
  await page.locator("#ai-api-variant").selectOption("chat");
  await page.locator("#ai-endpoint").fill("https://provider.test/v1");
  await page.locator("#ai-settings-tab-vault").click();
  await page.locator("#ai-api-key").fill("P0-X01-SYNTHETIC-KEY");
  await page.locator("#ai-save-profile").click();
  await expect(page.locator("#ai-provider-details")).toBeHidden();
  await expect(page.locator("#ai-profile-select")).toHaveValue("p0-x01-local-provider");
}

test.describe.configure({ timeout: 180_000 });

test("P0 X-01 completes the real Studio UI happy path without unauthorized canary persistence", async ({ page }) => {
  const browserErrors = [];
  const browserDiagnostics = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await page.locator("#import-file").setInputFiles({ name: "p0-x01.html", mimeType: "text/html", buffer: makeCanaryFixture() });
  await expect(page.locator("#data-policy")).toHaveText(/Unknown data|未知数据/i);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await openEditor(page);
  await page.locator("#real-data-mode").check();
  await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);

  const frame = page.frameLocator("#preview-frame");
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();
  const table = frame.locator('[data-pf-component-id="table-a-header"]').last();
  await expect(table).toBeVisible({ timeout: 20_000 });
  await table.dispatchEvent("click");
  await expect(page.locator("#ai-context-scope-select")).toHaveValue("table:a");
  await expect(page.locator("#ai-context-selection-meta")).toHaveAttribute("data-table-id", "a");
  await selectSyntheticByokProfile(page);
  await admitPublicGateway(page);
  await page.locator("#ai-mode-preview").click();
  const before = await readClientStorage(page);
  const baseline = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result);

  await page.evaluate((expectedRevision) => {
    const control = { designRuns: 0, reviewRuns: 0, actionCalls: 0, prompts: [], actionResult: null };
    let runtimeOptions;
    const session = {
      getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
      runStream(input, runOptions = {}) {
        control.prompts.push({ prompt: input?.prompt || "", systemPrompt: input?.systemPrompt || "" });
        return (async function* () {
          if (/layout review|multimodal/i.test(input?.prompt || "")) {
            control.reviewRuns += 1;
            const complete = runtimeOptions.customActions.find((item) => item.name === "printform_complete_current_layout_review");
            if (!complete) throw new Error("Layout completion action was not registered");
            await complete.execute({}, { findings: [], summary: "Controlled clean geometry review" });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Review complete" } } } };
            return;
          }
          control.designRuns += 1;
          const preview = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
          if (!preview) throw new Error("Preview action was not registered");
          control.actionCalls += 1;
          control.actionResult = await preview.execute({}, {
            expectedRevision,
            operations: [{ type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-a-row", widths: ["12%", "43%", "11%", "16%", "18%"] }]
          });
          yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
          yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Preview ready" } } } };
        }());
      }
    };
    window.__p0X01 = control;
    window.Agrun = {
      defineAction: (definition) => definition,
      createInMemorySessionStore: () => ({}),
      createRuntime: (options) => { runtimeOptions = options; return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] }; },
      openaiBrowserSkill: {}, geminiBrowserSkill: {}
    };
  }, baseline.revision);

  await page.locator("#ai-prompt").fill("Preview one safe table A layout adjustment");
  await page.locator("#ai-send").click();
  await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#ai-proposal-diff")).toContainText("templateHtml");
  expect(await page.locator("#ai-proposal-diff").textContent()).not.toContain(CANARY);
  const pending = await page.evaluate(() => window.__p0X01);
  expect(pending).toMatchObject({ designRuns: 1, reviewRuns: 0, actionCalls: 1, actionResult: { control: "complete", output: { ok: true } } });
  expect(JSON.stringify(pending)).not.toContain(CANARY);

  await page.locator("#ai-apply-proposal").click();
  await expect(page.locator(".ai-card-applied")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("#revision-label")).toHaveText("Revision 1");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await expect(page.locator("#ai-send")).toBeEnabled();
  await page.locator("#ai-review-layout").click();
  await expect.poll(() => page.evaluate(() => window.__p0X01.reviewRuns)).toBe(1);
  await expect(page.locator("#ai-status")).toHaveText(/human print preview and export confirmation remain required/i);
  await expect(page.locator("#export-button")).toBeEnabled();

  await page.evaluate(() => {
    window.__p0X01Export = { html: "", closed: false, options: null };
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, writable: true, value: async (options) => {
      window.__p0X01Export.options = options;
      return { createWritable: async () => ({ write: async (html) => { window.__p0X01Export.html = html; }, close: async () => { window.__p0X01Export.closed = true; } }) };
    } });
  });
  await page.locator("#export-button").click();
  await expect.poll(() => page.evaluate(() => window.__p0X01Export.closed)).toBe(true);
  await expect(page.locator("#save-state")).toHaveText("Saved");
  const exported = await page.evaluate(() => window.__p0X01Export);
  const exportedDocument = new JSDOM(exported.html).window.document;
  const attestation = JSON.parse(exportedDocument.getElementById("pf-attestation").textContent);
  expect(exported.options.suggestedName).toBe(`${FIXTURE_ID}.html`);
  expect(exported.html).toContain(CANARY);
  expect(attestation.evidence.revision).toBe(1);
  expect(attestation.evidence.transactionId).toEqual(expect.any(String));

  const finalState = await page.evaluate(async () => ({
    revision: (await window.PrintFormStudioAgent.execute("get_revision")).result.revision,
    history: (await window.PrintFormStudioAgent.execute("get_transaction_history")).result.entries,
    control: window.__p0X01
  }));
  expect(finalState.revision).toBe(1);
  expect(finalState.history.filter((entry) => entry.type === "REVISION_COMMIT")).toHaveLength(1);
  expect(finalState.control).toMatchObject({ designRuns: 1, reviewRuns: 1, actionCalls: 1 });
  expect(JSON.stringify(finalState)).not.toContain(CANARY);
  const after = await readClientStorage(page);
  expect(JSON.stringify(before)).not.toContain(CANARY);
  expect(JSON.stringify(after)).not.toContain(CANARY);
  noKnownBrowserDiagnostics(test.info(), browserErrors, browserDiagnostics);
});
