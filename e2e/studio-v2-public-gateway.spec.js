import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const inspectorToggle = page.locator("#inspector-toggle");
  if (await inspectorToggle.getAttribute("aria-expanded") !== "true") await inspectorToggle.click();
  await page.locator("#ai-designer-tab").click();
});

test("uses an origin-bound Demo session without a browser gateway key", async ({ page }) => {
  await expect(page.locator("#ai-profile-select option")).toHaveText("Default gateway: gpt-5.4-mini · browser demo session");
  await expect(page.locator("#ai-status")).toHaveText("Demo Gateway ready · a short-lived origin-bound session is acquired on demand.");
  await page.evaluate(() => {
    window.__demoGatewayRequests = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init = {}) => {
      const url = String(input);
      if (url.endsWith("/demo/session")) {
        window.__demoGatewayRequests.push({ url, headers: new Headers(init.headers || {}) });
        return Promise.resolve(new Response(JSON.stringify({ token: "dmo_e2e-token", expires_in: 900 }), { status: 200, headers: { "content-type": "application/json" } }));
      }
      if (!url.endsWith("/demo/v1/responses")) return originalFetch(input, init);
      window.__demoGatewayRequests.push({ url, headers: new Headers(init.headers || {}), signal: init.signal, body: JSON.parse(init.body) });
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
      });
    };
  });
  await page.locator("#ai-prompt").fill("Make the heading blue");
  await page.locator("#ai-send").click();
  await expect.poll(() => page.evaluate(() => window.__demoGatewayRequests.length)).toBe(2);
  const requests = await page.evaluate(() => window.__demoGatewayRequests.map((request) => ({ url: request.url, authorization: request.headers.get("authorization"), body: request.body || null })));
  expect(requests[0]).toMatchObject({ url: "https://gpt.yapweijun1996.com/demo/session", authorization: null });
  expect(requests[1]).toMatchObject({ url: "https://gpt.yapweijun1996.com/demo/v1/responses", authorization: "Bearer dmo_e2e-token" });
  expect(requests[1].body).toMatchObject({ model: "gpt-5.4-mini", stream: true });
  for (const field of ["tools", "tool_choice", "files", "audio", "background", "web_search", "store"]) {
    expect(requests[1].body).not.toHaveProperty(field);
  }
  expect(JSON.stringify(requests[1].body)).toContain("Make the heading blue");
  await page.locator("#ai-stop").click();
});

test("does not render a gateway-key override field", async ({ page }) => {
  await page.locator("#ai-settings-button").click();
  await expect(page.locator("#ai-public-gateway-key")).toHaveCount(0);
  await expect(page.locator("#ai-settings-badge")).toHaveText("Built-in demo Gateway");
  await expect(page.locator("#ai-profile-select option")).toHaveText("Default gateway: gpt-5.4-mini · browser demo session");
});
