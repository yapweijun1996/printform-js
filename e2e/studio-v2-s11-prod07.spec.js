import { expect, test } from "@playwright/test";
import { openEditor, openInspector } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

function recordBrowserDiagnostics(page, testInfo) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  return () => {
    const knownFirefox = testInfo.project.name === "firefox"
      && consoleErrors.some((message) => /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message));
    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !(/Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message) && knownFirefox))).toEqual([]);
  };
}

test.describe("Studio v2 S11 PROD-07 actionable Quality", () => {
  test("07-01 routes a blocking field issue and keeps metadata localized", async ({ page }, testInfo) => {
    const assertDiagnostics = recordBrowserDiagnostics(page, testInfo);
    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await page.locator("#scenario-select").selectOption("empty");
    await expect(page.locator("#render-status")).toHaveText("Blocked", { timeout: 20_000 });
    await openInspector(page);
    await page.locator("#quality-tab").click();

    const issue = page.locator("#issue-list li").filter({ hasText: "MIN_ITEMS" }).first();
    await expect(issue).toContainText("/sampleData/items");
    await expect(issue).toContainText("Next action");
    const issueButton = issue.locator("button");
    await expect(issueButton).toBeVisible();
    await issueButton.focus();
    await issueButton.press("Enter");
    await expect(page.locator("#sample-editor")).toBeFocused();

    await page.locator("#ui-locale-select").selectOption("zh-CN");
    await expect(page.locator("#issue-list li").filter({ hasText: "MIN_ITEMS" }).first()).toContainText("至少需要一行数据");
    await expect(page.locator("#issue-list")).toContainText("位置：");
    await expect(page.locator("#issue-list")).toContainText("下一步：");
    assertDiagnostics();
  });

  test("07-02 navigates an element issue inside the isolated preview", async ({ page }, testInfo) => {
    const assertDiagnostics = recordBrowserDiagnostics(page, testInfo);
    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await page.locator("#template-editor").evaluate((editor) => {
      const parsed = new DOMParser().parseFromString(editor.value, "text/html");
      const root = parsed.querySelector(".printform");
      if (!root) throw new Error("Missing printform root");
      const header = root.querySelector(".pheader");
      if (!header) throw new Error("Missing printform header");
      const canary = parsed.createElement("div");
      canary.id = "s11-quality-overflow";
      canary.className = "pinfo";
      canary.setAttribute("data-pf-text", "/customer/name");
      canary.style.cssText = "width:2000px;height:20px;overflow:hidden;";
      header.append(canary);
      editor.value = root.outerHTML;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.locator("#apply-source-button").click();
    await expect(page.locator("#source-diff-modal")).toBeVisible();
    await page.locator("#source-diff-apply").click();
    await expect(page.locator("#render-status")).toHaveText("Blocked", { timeout: 20_000 });
    await openInspector(page);
    await page.locator("#quality-tab").click();

    const issue = page.locator("#issue-list li").filter({ hasText: "HORIZONTAL_OVERFLOW" }).first();
    await expect(issue).toContainText("page 1");
    await expect(issue).toContainText("component");
    const frame = page.frameLocator("#preview-frame");
    const canary = frame.locator("#s11-quality-overflow").first();
    await expect(canary).toBeVisible({ timeout: 20_000 });
    await issue.locator("button").press("Space");
    await expect(canary).toHaveAttribute("data-pf-preview-selected", "true");
    assertDiagnostics();
  });
});
