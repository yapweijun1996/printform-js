import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const inspectorToggle = page.locator("#inspector-toggle");
  if (await inspectorToggle.getAttribute("aria-expanded") !== "true") await inspectorToggle.click();
  await page.locator("#ai-designer-tab").click();
});

test("uses the built-in public gateway credential without setup", async ({ page }) => {
  await expect(page.locator("#ai-profile-select option")).toHaveText("Default gateway: gpt-5.4-mini · built-in public credential");
  await expect(page.locator("#ai-status")).toHaveText("Built-in Gateway ready · server abuse controls apply.");
  await page.evaluate(() => {
    window.__publicGatewayRequest = null;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      if (!String(input).includes("gpt.yapweijun1996.com/v1/responses")) return originalFetch(input, init);
      const authorization = String(init.headers?.authorization || "");
      window.__publicGatewayRequest = { hasBearer: /^Bearer gw_[a-z0-9]+$/.test(authorization), signal: init.signal };
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    };
  });
  await page.locator("#ai-prompt").fill("Make the heading blue");
  await page.locator("#ai-send").click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__publicGatewayRequest))).toBe(true);
  expect(await page.evaluate(() => window.__publicGatewayRequest.hasBearer)).toBe(true);
  await page.locator("#ai-stop").click();
});

test("uses a gateway token only for the current page session", async ({ page }) => {
  await page.locator("#ai-settings-button").click();
  await page.locator("#ai-public-gateway-key").fill("session-e2e-key");
  await page.locator("#ai-save-profile").click();
  await expect(page.locator("#ai-settings-badge")).toHaveText("Session gateway override");
  await expect(page.locator("#ai-profile-select option")).toHaveText("Default gateway: gpt-5.4-mini · session override loaded");

  await page.evaluate(() => {
    window.__sessionGatewayRequest = null;
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      if (!String(input).includes("gpt.yapweijun1996.com/v1/responses")) return originalFetch(input, init);
      return new Promise((_resolve, reject) => {
        window.__sessionGatewayRequest = { headers: { ...(init.headers || {}) }, signal: init.signal };
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    };
  });
  await page.locator("#ai-prompt").fill("Use the session gateway token");
  await page.locator("#ai-send").click();
  await expect.poll(() => page.evaluate(() => Boolean(window.__sessionGatewayRequest))).toBe(true);
  const request = await page.evaluate(() => ({ headers: window.__sessionGatewayRequest.headers }));
  expect(request.headers.authorization).toBe("Bearer session-e2e-key");
  await page.locator("#ai-stop").click();
});
