import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

const WHOLE_DOCUMENT_WIDTHS = ["12%", "43%", "11%", "16%", "18%"];

test.describe("Studio v2 PROD-01 01-08 legacy and whole-document control", () => {
  test("adapts legacy markup, blocks ambiguous table scope, and restores component restrictions", async ({ page, browserName }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => browserName === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") browserDiagnostics.push(message.text()); });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await admitPublicGateway(page);
    const initialSpec = await page.evaluate(async () => window.PrintFormStudioAgent.execute("get_form_spec"));
    expect(initialSpec.ok).toBe(true);
    expect(initialSpec.result.spec.mode).toBe("legacy-adapter");

    await openEditor(page);
    await page.locator("#template-editor").evaluate((editor) => {
      const parsed = new DOMParser().parseFromString(editor.value, "text/html");
      const root = parsed.querySelector(".printform");
      if (!root?.querySelector(".prowheader")) throw new Error("Legacy table header was not found");
      root.insertAdjacentHTML("beforeend", `<table class="prowheader pf-grid legacy-secondary" data-pf-table-id="secondary"><thead><tr><th style="width:7%">Secondary No.</th><th style="width:43%">Secondary Description</th><th style="width:11%">Secondary Qty</th><th style="width:16%">Secondary Unit</th><th style="width:18%">Secondary Amount</th></tr></thead></table>`);
      editor.value = root.outerHTML;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#apply-source-button").click();
    await expect(page.locator("#source-diff-modal")).toBeVisible();
    await page.locator("#source-diff-apply").click();
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);
    await expect(page.locator("#ai-context-scope-select option[value='table:secondary']")).toHaveCount(1);
    const legacySpec = await page.evaluate(async () => window.PrintFormStudioAgent.execute("get_form_spec"));
    expect(legacySpec.ok).toBe(true);
    expect(legacySpec.result.spec.mode).toBe("legacy-adapter");
    await admitPublicGateway(page);

    const baseline = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
      return {
        revision: revision.result.revision,
        projectHash: revision.result.projectHash,
        trust: summary.result.trust,
        source: document.querySelector("#template-editor").value
      };
    });
    expect(baseline.trust).toBe("trusted");

    await page.locator("#ai-context-scope-select").selectOption("table:default");
    await expect(page.locator("#ai-context-scope-select")).toHaveValue("table:default");
    const ambiguous = await page.evaluate(async ({ expectedRevision, widths }) => window.PrintFormStudioAgent.execute("preview_changes", {
      expectedRevision,
      operations: [{ type: "set_column_widths", tableSelector: ".prowheader", widths }]
    }), { expectedRevision: baseline.revision, widths: WHOLE_DOCUMENT_WIDTHS });
    expect(ambiguous.ok).toBe(false);
    expect(ambiguous.error.code).toBe("SCOPE_VIOLATION");
    const afterAmbiguous = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, source: document.querySelector("#template-editor").value };
    });
    expect(afterAmbiguous).toMatchObject({
      revision: baseline.revision,
      projectHash: baseline.projectHash,
      source: baseline.source
    });

    await page.locator("#ai-context-scope-select").selectOption("all");
    await expect(page.locator("#ai-context-scope-select")).toHaveValue("all");
    await page.locator("#ai-mode-preview").click();
    await page.evaluate(({ expectedRevision, operations }) => {
      const control = { runs: 0, actionCalls: 0, actionResult: null };
      let runtimeOptions;
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream() {
          control.runs += 1;
          return (async function* () {
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            control.actionCalls += 1;
            control.actionResult = await action.execute({}, { expectedRevision, operations });
            yield { type: "phase", detail: { phase: "act", transition: "completed", info: { actionName: "printform_preview_changes", outcome: "executed" } } };
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Whole-document preview ready" } } } };
          }());
        }
      };
      window.__p0Prod0108 = { control };
      window.Agrun = {
        defineAction: (definition) => definition,
        createInMemorySessionStore: () => ({}),
        createRuntime: (options) => {
          runtimeOptions = options;
          return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
        },
        openaiBrowserSkill: {},
        geminiBrowserSkill: {}
      };
    }, { expectedRevision: baseline.revision, operations: [{ type: "set_column_widths", tableSelector: ".prowheader", widths: WHOLE_DOCUMENT_WIDTHS }] });
    await page.locator("#ai-prompt").fill("Resize every legacy table header as an intentional whole-document change");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-apply-proposal")).toBeVisible({ timeout: 20_000 });
    const proposal = JSON.parse(await page.locator("#ai-proposal-diff").textContent());
    expect(proposal.revision).toBe(baseline.revision);
    expect(proposal.candidateHash).toEqual(expect.any(String));
    expect(proposal.diff.changedSections).toEqual(["templateHtml"]);
    await page.locator("#ai-apply-proposal").click();
    await expect(page.locator("#revision-label")).toHaveText(`Revision ${baseline.revision + 1}`);
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await expect(page.locator("#ai-apply-proposal")).toHaveCount(0);
    await expect(page.locator(".ai-card-undo")).toBeVisible();
    const afterWholeDocument = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      const source = document.querySelector("#template-editor").value;
      const parsed = new DOMParser().parseFromString(source, "text/html");
      return {
        revision: revision.result.revision,
        projectHash: revision.result.projectHash,
        source,
        widths: Array.from(parsed.querySelectorAll("table.prowheader"), (table) => Array.from(table.rows[0].cells, (cell) => cell.style.width)),
        tableIds: Array.from(parsed.querySelectorAll("table.prowheader"), (table) => table.getAttribute("data-pf-table-id") || "default")
      };
    });
    expect(afterWholeDocument.revision).toBe(baseline.revision + 1);
    expect(afterWholeDocument.projectHash).not.toBe(baseline.projectHash);
    expect(afterWholeDocument.source).not.toBe(baseline.source);
    expect(afterWholeDocument.tableIds).toEqual(["default", "secondary"]);
    expect(afterWholeDocument.widths).toEqual([WHOLE_DOCUMENT_WIDTHS, WHOLE_DOCUMENT_WIDTHS]);
    const control = await page.evaluate(() => window.__p0Prod0108.control);
    expect(control.runs).toBe(1);
    expect(control.actionCalls).toBe(1);
    expect(control.actionResult).toMatchObject({ output: { transactionId: expect.any(String), candidateHash: expect.any(String) } });

    const componentScope = await page.locator("#ai-context-scope-select option").evaluateAll((options) => options
      .map((option) => option.value)
      .find((value) => value.startsWith("component:document-header")));
    expect(componentScope).toBeTruthy();
    await page.locator("#ai-context-scope-select").selectOption(componentScope);
    await expect(page.locator("#ai-context-scope-select")).toHaveValue(componentScope);
    const componentRejected = await page.evaluate(async (expectedRevision) => window.PrintFormStudioAgent.execute("preview_changes", {
      expectedRevision,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    }), afterWholeDocument.revision);
    expect(componentRejected.ok).toBe(false);
    expect(componentRejected.error.code).toBe("SCOPE_VIOLATION");
    const afterComponentReject = await page.evaluate(async () => {
      const revision = await window.PrintFormStudioAgent.execute("get_revision");
      return { revision: revision.result.revision, projectHash: revision.result.projectHash, source: document.querySelector("#template-editor").value };
    });
    expect(afterComponentReject).toMatchObject({
      revision: afterWholeDocument.revision,
      projectHash: afterWholeDocument.projectHash,
      source: afterWholeDocument.source
    });
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
