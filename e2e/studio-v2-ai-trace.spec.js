import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const toggle = page.locator("#inspector-toggle");
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await page.locator("#ai-designer-tab").click();
});

test("exposes a memory-only sanitized runtime trace", async ({ page }) => {
  await expect.poll(() => page.evaluate(() => window.PrintFormStudioAgentTrace?.version)).toBe("1.0.0");
  await expect(page.locator("#ai-max-steps")).toHaveValue("100");
  await expect(page.locator("#ai-max-steps")).toHaveAttribute("max", "100");
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      if (!String(input).includes("gpt.yapweijun1996.com/v1/responses")) return originalFetch(input, init);
      return new Promise((_resolve, reject) => init.signal?.addEventListener(
        "abort", () => reject(new DOMException("aborted", "AbortError")), { once: true }
      ));
    };
  });

  const prompt = "TRACE-SECRET-CUSTOMER-918273";
  await page.locator("#ai-prompt").fill(prompt);
  await page.locator("#ai-send").click();
  await expect.poll(() => page.evaluate(() => window.PrintFormStudioAgentTrace.getSnapshot().length)).toBeGreaterThanOrEqual(2);

  const serialized = await page.evaluate(() => JSON.stringify(window.PrintFormStudioAgentTrace.getSnapshot()));
  expect(serialized).toContain("runtime_config");
  expect(serialized).toContain('"maxSteps":100');
  expect(serialized).toContain("turn_start");
  expect(serialized).not.toContain(prompt);
  expect(serialized).not.toMatch(/gw_[a-z0-9]+/i);

  await page.locator("#ai-stop").click();
  const auditRows = await page.evaluate(() => window.PrintFormStudioAgentTrace.getAuditSnapshot());
  expect(auditRows.some((row) => row.kind === "event" && row.type === "turn_start")).toBe(true);
  expect(auditRows.every((row) => row.kind === "event" || row.kind === "action")).toBe(true);
  await page.locator("#ai-trace-panel summary").click();
  await expect(page.locator("#ai-trace-log")).toContainText("Turn started");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.locator("#ai-trace-clear").click();
  await expect(page.locator("#ai-trace-count")).toHaveText("0");
  expect(await page.evaluate(() => window.PrintFormStudioAgentTrace.getSnapshot())).toEqual([]);
});
