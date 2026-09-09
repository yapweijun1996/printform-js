import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARY_A = "P0-X02-X03-DOCUMENT-A-CANARY-20260909";
const CANARY_B = "P0-X03-DOCUMENT-B-CANARY-20260909";
const SOURCE = path.resolve(process.cwd(), "site-dist/studio-v2/samples/sales-invoice-v2.html");

function stable(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(stable(item))), null, 2);
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return JSON.stringify(Object.keys(value).sort().reduce((result, key) => ({ ...result, [key]: JSON.parse(stable(value[key])) }), {}), null, 2);
}

function jsonSection(document, id) { return JSON.parse(document.getElementById(id).textContent); }
function setJsonSection(document, id, value) { document.getElementById(id).textContent = `\n${stable(value)}\n`; }
function sha256(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex"); }

function makeFixture(documentId, canary) {
  const document = new JSDOM(fs.readFileSync(SOURCE, "utf8")).window.document;
  const manifest = jsonSection(document, "pf-manifest");
  const schema = jsonSection(document, "pf-schema");
  const i18n = jsonSection(document, "pf-i18n");
  const spec = jsonSection(document, "pf-form-spec");
  const sampleData = jsonSection(document, "pf-sample-data");
  const attestation = jsonSection(document, "pf-attestation");
  manifest.documentId = documentId;
  manifest.title = `P0 ${documentId}`;
  sampleData.customer.name = canary;
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
  const canonical = [stable(manifest), stable(schema), stable(i18n), document.getElementById("pf-theme").textContent.trim(), template.innerHTML.trim(), stable(spec), stable(sampleData), runtime?.dataset.version || "", runtime?.dataset.hash || ""];
  attestation.contentHash = sha256(canonical.join("\n---printform-section---\n"));
  setJsonSection(document, "pf-attestation", attestation);
  return Buffer.from(new JSDOM(document.documentElement.outerHTML).serialize(), "utf8");
}

async function selectTableA(page) {
  const frame = page.frameLocator("#preview-frame");
  await expect(frame.locator('[data-pf-component-id="table-a-header"]').last()).toBeVisible({ timeout: 20_000 });
  await frame.locator('[data-pf-component-id="table-a-header"]').last().dispatchEvent("click");
  await expect(page.locator("#ai-context-scope-select")).toHaveValue("table:a");
}

async function selectSyntheticProfile(page) {
  await page.locator("#ai-settings-button").click();
  await page.locator("#ai-settings-tab-vault").click();
  await page.locator("#ai-vault-passphrase").fill("P0 X02 X03 local vault passphrase 20260909");
  await page.locator("#ai-unlock-vault").click();
  await expect(page.locator("#ai-settings-status")).toHaveText(/Vault unlocked/i);
  await page.locator("#ai-settings-tab-provider").click();
  await page.locator("#ai-profile-id").fill("p0-x02-x03-local-provider");
  await page.locator("#ai-provider").selectOption("custom");
  await page.locator("#ai-model").fill("p0-x02-x03-model");
  await page.locator("#ai-api-variant").selectOption("chat");
  await page.locator("#ai-endpoint").fill("https://provider.test/v1");
  await page.locator("#ai-settings-tab-vault").click();
  await page.locator("#ai-api-key").fill("P0-X02-X03-SYNTHETIC-KEY");
  await page.locator("#ai-save-profile").click();
  await expect(page.locator("#ai-provider-details")).toBeHidden();
  await expect(page.locator("#ai-profile-select")).toHaveValue("p0-x02-x03-local-provider");
}

async function installDelayedSession(page, expectedRevision, review = false) {
  await page.evaluate(({ expectedRevision, review }) => {
    const control = { started: false, finished: false, prompt: "", actionResult: null, error: null };
    let runtimeOptions;
    let release;
    const session = {
      getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
      runStream(input) {
        control.started = true;
        control.prompt = input?.prompt || "";
        return (async function* () {
          await new Promise((resolve) => { release = resolve; });
          try {
            const actionName = review ? "printform_complete_current_layout_review" : "printform_preview_changes";
            const action = runtimeOptions.customActions.find((item) => item.name === actionName);
            if (!action) throw new Error(`${actionName} was not registered`);
            control.actionResult = await action.execute({}, review
              ? { findings: [], summary: "Controlled current-document review" }
              : { expectedRevision, operations: [{ type: "set_column_widths", tableSelector: ".scope-table-a-header, .scope-table-a-row", widths: ["12%", "43%", "11%", "16%", "18%"] }] });
            control.finished = true;
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Controlled result delivered" } } } };
          } catch (error) {
            control.error = { name: error.name, message: error.message };
            control.finished = true;
            throw error;
          }
        }());
      }
    };
    window.__p0Delayed = control;
    window.__p0DelayedRelease = () => release?.();
    window.Agrun = {
      defineAction: (definition) => definition,
      createInMemorySessionStore: () => ({}),
      createRuntime: (options) => { runtimeOptions = options; return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] }; },
      openaiBrowserSkill: {}, geminiBrowserSkill: {}
    };
  }, { expectedRevision, review });
}

async function readPublicState(page) {
  return page.evaluate(async () => {
    const revision = await window.PrintFormStudioAgent.execute("get_revision");
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    const history = await window.PrintFormStudioAgent.execute("get_transaction_history");
    const review = await window.PrintFormStudioAgent.execute("get_layout_review_status");
    const pack = await window.PrintFormStudioAgent.execute("get_evidence_pack");
    return { revision, summary, history, review, pack };
  });
}

test.describe.configure({ timeout: 180_000 });

test("P0 X-02 rejects a stale policy, mode and scope result in the real Studio UI", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await page.locator("#import-file").setInputFiles({ name: "p0-x02.html", mimeType: "text/html", buffer: makeFixture("p0-x02-canary", CANARY_A) });
  await expect(page.locator("#data-policy")).toHaveText(/Unknown data|未知数据/i);
  await openEditor(page);
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();
  await selectTableA(page);
  await selectSyntheticProfile(page);
  await admitPublicGateway(page);
  await expect(page.locator("#ai-mode-auto")).toHaveAttribute("aria-checked", "true");
  const before = await readClientStorage(page);
  const baseline = await page.evaluate(async () => (await window.PrintFormStudioAgent.execute("get_revision")).result);
  await installDelayedSession(page, baseline.revision);
  await page.locator("#ai-prompt").fill("Preview one safe table A adjustment while policy changes");
  await page.locator("#ai-send").click();
  await expect.poll(() => page.evaluate(() => window.__p0Delayed?.started)).toBe(true);
  await page.locator("#real-data-mode").check();
  await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
  await page.locator("#ai-mode-preview").click();
  const componentScope = await page.locator("#ai-context-scope-select option").evaluateAll((options) => options.map((option) => option.value).find((value) => value === "component:table-a-header"));
  expect(componentScope).toBe("component:table-a-header");
  await page.locator("#ai-context-scope-select").selectOption(componentScope);
  await admitPublicGateway(page);
  await page.evaluate(() => window.__p0DelayedRelease?.());
  await expect.poll(() => page.evaluate(() => window.__p0Delayed?.finished)).toBe(true);
  const after = await readClientStorage(page);
  const state = await page.evaluate(async () => ({ revision: (await window.PrintFormStudioAgent.execute("get_revision")).result, control: window.__p0Delayed, surface: {
    contextStatus: document.querySelector("#ai-context-status")?.textContent || "",
    quality: document.querySelector("#quality-summary")?.textContent || "",
    exportDisabled: Boolean(document.querySelector("#export-button")?.disabled)
  } }));
  expect(state.revision.revision).toBe(baseline.revision);
  expect(state.revision.projectHash).toBe(baseline.projectHash);
  expect(state.control.actionResult?.ok ?? false).toBe(false);
  expect(state.surface.exportDisabled).toBe(true);
  expect(state.surface.contextStatus).toMatch(/blocked/i);
  expect(JSON.stringify(state.control)).not.toContain(CANARY_A);
  expect(JSON.stringify(await page.locator("#ai-chat-log").textContent())).not.toContain(CANARY_A);
  expect(JSON.stringify(before)).not.toContain(CANARY_A);
  expect(JSON.stringify(after)).not.toContain(CANARY_A);
  await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
  await expect(page.locator("#candidate-preview-banner")).toBeHidden();
});

test("P0 X-03 keeps document B isolated from a delayed document A review in the real Studio UI", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await page.locator("#import-file").setInputFiles({ name: "p0-x03-a.html", mimeType: "text/html", buffer: makeFixture("p0-x03-document-a", CANARY_A) });
  await expect(page.locator("#data-policy")).toHaveText(/Unknown data|未知数据/i);
  await openEditor(page);
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();
  await selectTableA(page);
  await selectSyntheticProfile(page);
  await admitPublicGateway(page);
  await installDelayedSession(page, 0, true);
  await page.locator("#ai-review-layout").click();
  await expect.poll(() => page.evaluate(() => window.__p0Delayed?.started)).toBe(true);
  await page.locator("#import-file").setInputFiles({ name: "p0-x03-b.html", mimeType: "text/html", buffer: makeFixture("p0-x03-document-b", CANARY_B) });
  await expect(page.locator("#data-policy")).toHaveText(/Unknown data|未知数据/i);
  await expect(page.locator("#revision-label")).toHaveText(/Revision 0/i);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await admitPublicGateway(page);
  const bBaseline = await readPublicState(page);
  await page.evaluate(() => window.__p0DelayedRelease?.());
  await expect.poll(() => page.evaluate(() => window.__p0Delayed?.finished)).toBe(true);
  const state = await readPublicState(page);
  await expect(page.locator("#ai-context-doc-name")).toHaveText(/p0-x03-document-b/i);
  expect(state.revision.result.revision).toBe(0);
  expect(state.revision.result.projectHash).toBe(bBaseline.revision.result.projectHash);
  expect(state.history.result.entries.filter((entry) => entry.type === "REVISION_COMMIT")).toHaveLength(0);
  expect(state.review.result.review.status).toBe("required");
  expect(state.pack.result.evidencePack).toBeNull();
  expect(JSON.stringify(state)).not.toContain(CANARY_A);
  expect(JSON.stringify(await page.locator("#ai-chat-log").textContent())).not.toContain(CANARY_A);
  expect(JSON.stringify(await readClientStorage(page))).not.toContain(CANARY_A);
});
