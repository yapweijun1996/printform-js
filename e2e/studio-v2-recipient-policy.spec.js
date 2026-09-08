import { expect, test } from "@playwright/test";
import { openEditor, openInspector } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

for (const change of ["endpoint", "credential"]) {
  test(`starts a new actual panel conversation after ${change} replacement`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("https://provider-*.test/**", (route) => route.abort());
    await page.route("https://gpt.yapweijun1996.com/**", (route) => route.abort());
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    await page.locator("label.privacy-toggle").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data/i);
    await page.evaluate(() => {
      const originalFetch = window.fetch.bind(window);
      window.__recipientWire = [];
      window.fetch = (input, init = {}) => {
        if (!/^https:\/\/provider-[ab]\.test\//.test(String(input))) return originalFetch(input, init);
        window.__recipientWire.push({ url: String(input), body: JSON.parse(init.body), authorization: new Headers(init.headers).get("authorization") });
        return new Promise((_resolve, reject) => {
          if (init.signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
        });
      };
    });
    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await page.locator("#ai-settings-button").click();
    await page.locator("#ai-settings-tab-vault").click();
    await page.locator("#ai-vault-passphrase").fill("SYNTHETIC-VAULT-PASSPHRASE");
    await page.locator("#ai-unlock-vault").click();
    await expect(page.locator("#ai-settings-status")).toContainText(/unlocked/i);
    await page.locator("#ai-settings-tab-provider").click();
    await page.locator("#ai-profile-id").fill("synthetic-recipient");
    await page.locator("#ai-provider").selectOption("custom");
    await page.locator("#ai-model").fill("model-synthetic");
    await page.locator("#ai-api-variant").selectOption("chat");
    await page.locator("#ai-endpoint").fill("https://provider-a.test/v1");
    await page.locator("#ai-settings-tab-vault").click();
    await page.locator("#ai-api-key").fill("SYNTHETIC-CREDENTIAL-A");
    await page.locator("#ai-save-profile").click();
    await expect(page.locator("#ai-provider-details")).toBeHidden();
    await page.locator("#ai-prompt").fill("SYNTHETIC-OLD-RECIPIENT-PROMPT");
    await page.locator("#ai-send").click();
    await expect.poll(() => page.evaluate(() => window.__recipientWire.length)).toBe(1);

    await page.locator("#ai-settings-button").click();
    if (change === "endpoint") {
      await page.locator("#ai-settings-tab-provider").click();
      await page.locator("#ai-endpoint").fill("https://provider-b.test/v1");
    } else {
      await page.locator("#ai-settings-tab-vault").click();
      await page.locator("#ai-api-key").fill("SYNTHETIC-CREDENTIAL-B");
    }
    await page.locator("#ai-save-profile").click();
    await expect(page.locator("#ai-provider-details")).toBeHidden();
    await expect(page.locator("#ai-chat-log")).toContainText("next request starts a new chat");
    await expect(page.locator("#ai-chat-log")).not.toContainText("SYNTHETIC-OLD-RECIPIENT-PROMPT");
    await page.locator("#ai-prompt").fill("SYNTHETIC-NEW-RECIPIENT-PROMPT");
    await page.locator("#ai-send").click();
    await expect.poll(() => page.evaluate(() => window.__recipientWire.length)).toBe(2);
    const requests = await page.evaluate(() => window.__recipientWire);
    expect(requests[1].url).toContain(change === "endpoint" ? "provider-b.test" : "provider-a.test");
    expect(requests[1].authorization).toContain(change === "credential" ? "SYNTHETIC-CREDENTIAL-B" : "SYNTHETIC-CREDENTIAL-A");
    const body = JSON.stringify(requests[1].body);
    expect(body.includes("SYNTHETIC-NEW-RECIPIENT-PROMPT")).toBe(true);
    expect(body.includes("SYNTHETIC-OLD-RECIPIENT-PROMPT")).toBe(false);
    expect(body.includes("SYNTHETIC-CREDENTIAL-")).toBe(false);
    const persisted = JSON.stringify(await readClientStorage(page));
    expect(persisted).not.toContain("SYNTHETIC-OLD-RECIPIENT-PROMPT");
    expect(persisted).not.toContain("SYNTHETIC-NEW-RECIPIENT-PROMPT");
    expect(persisted).not.toContain("SYNTHETIC-CREDENTIAL-");
    await page.locator("#ai-stop").click();
    expect(errors).toEqual([]);
  });
}
