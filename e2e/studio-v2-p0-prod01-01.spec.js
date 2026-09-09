import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector } from "./studio-v2-helpers.js";

test.describe("Studio v2 PROD-01 01-01 selection agreement", () => {
  test("preview table selection keeps FormSpec identity, context and scope aligned", async ({ page }) => {
    const browserErrors = [];
    const browserDiagnostics = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => test.info().project.name === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") browserDiagnostics.push(message.text());
    });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openInspector(page);

    const frame = page.frameLocator("#preview-frame");
    const targets = frame.locator("[data-pf-component-id]");
    await expect(targets.first()).toBeVisible({ timeout: 12_000 });
    const targetInfo = await targets.evaluateAll((nodes) => nodes.map((node) => ({
      id: node.getAttribute("data-pf-component-id"),
      className: String(node.className || "")
    })));
    const tableHeader = targetInfo.find((item) => /(^|\s)prowheader(?:_processed)?(\s|$)/.test(item.className));
    expect(tableHeader?.id).toBeTruthy();

    await frame.locator(`[data-pf-component-id="${tableHeader.id}"]`).first().click();

    const contextTarget = page.locator("#ai-context-selection-meta");
    await expect(contextTarget).toHaveAttribute("data-component-id", tableHeader.id);
    await expect(contextTarget).toHaveAttribute("data-table-id", "default");
    await expect(contextTarget).toHaveAttribute("data-source", "preview");
    await expect(page.locator("#ai-context-selection-val")).toContainText(tableHeader.id);
    await expect(page.locator("#ai-context-scope-select")).toHaveValue("table");

    await admitPublicGateway(page);
    const rejectedTheme = await page.evaluate(async () => window.PrintFormStudioAgent.execute("preview_changes", {
      expectedRevision: 0,
      operations: [{ type: "set_brand_color", hex: "#854d0e" }]
    }));
    expect(rejectedTheme).toMatchObject({ ok: false, error: { code: "SCOPE_VIOLATION" } });
    await expect(contextTarget).toHaveAttribute("data-component-id", tableHeader.id);
    await expect(page.locator("#ai-context-scope-select")).toHaveValue("table");

    const summary = await page.evaluate(async () => window.PrintFormStudioAgent.execute("get_project_summary"));
    expect(summary.result.revision).toBe(0);
    expect(browserErrors).toEqual([]);
    expect(browserDiagnostics.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (browserDiagnostics.some(knownFirefoxAgrunCspDiagnostic)) {
      test.info().annotations.push({
        type: "known-browser-diagnostic",
        description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
      });
    }
  });
});
