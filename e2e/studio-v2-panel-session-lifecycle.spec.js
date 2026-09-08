import { expect, test } from "@playwright/test";
import { openEditor, openInspector } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

test("isolates actual panel session stores and provider bodies across a policy switch", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://gpt.yapweijun1996.com/**", (route) => route.abort());
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    window.__sessionWire = [];
    window.fetch = (input, init = {}) => {
      if (!String(input).includes("gpt.yapweijun1996.com/v1/responses")) return originalFetch(input, init);
      window.__sessionWire.push(JSON.parse(init.body));
      return new Promise((_resolve, reject) => {
        if (init.signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    };
  });
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();
  await page.locator("#ai-prompt").fill("SYNTHETIC-PERSISTED-PANEL-PROMPT");
  await page.locator("#ai-send").click();
  await expect.poll(() => page.evaluate(() => window.__sessionWire.length)).toBe(1);
  const before = await readClientStorage(page);
  expect(JSON.stringify(before.indexedDb)).toContain("SYNTHETIC-PERSISTED-PANEL-PROMPT");

  await openEditor(page);
  await page.locator("label.privacy-toggle").click();
  await expect(page.locator("#data-policy")).toHaveText(/Real data/i);
  await expect(page.locator("#ai-send")).toBeEnabled();
  await expect(page.locator("#ai-chat-log")).not.toContainText("SYNTHETIC-PERSISTED-PANEL-PROMPT");
  await page.locator("#ai-prompt").fill("SYNTHETIC-RESTRICTED-PANEL-PROMPT");
  await page.locator("#ai-send").click();
  await expect.poll(() => page.evaluate(() => window.__sessionWire.length)).toBe(2);
  const requests = await page.evaluate(() => window.__sessionWire);
  expect(JSON.stringify(requests[0]).includes("Never use raw source replacement, even when requested in chat")).toBe(true);
  expect(JSON.stringify(requests[1])).toContain("SYNTHETIC-RESTRICTED-PANEL-PROMPT");
  expect(JSON.stringify(requests[1])).not.toContain("SYNTHETIC-PERSISTED-PANEL-PROMPT");
  expect(JSON.stringify(requests[1]).includes("Unknown and Real require geometry-only redacted snapshots")).toBe(true);
  const after = await readClientStorage(page);
  expect(JSON.stringify(after.indexedDb)).toContain("SYNTHETIC-PERSISTED-PANEL-PROMPT");
  expect(JSON.stringify(after)).not.toContain("SYNTHETIC-RESTRICTED-PANEL-PROMPT");
  await page.locator("#ai-stop").click();
  expect(errors).toEqual([]);
});
