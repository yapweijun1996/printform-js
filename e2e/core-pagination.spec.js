import { expect, test } from "@playwright/test";

// Smoke coverage for the core dist/printform.js library rendered directly
// (legacy data-*/global-var config, no Studio) — the actual shipped product
// this repo builds. Prior to this spec, e2e coverage only exercised the
// Studio v2 declarative-binding path; the classic multi-page ERP templates
// under the repo root had zero real-browser regression protection, only
// jsdom-approximated unit tests, despite the code containing explicit
// mobile-WebKit sub-pixel workarounds that jsdom cannot reproduce.

test("renders a full ERP document across multiple real pages with the header repeated on every page", async ({ page }) => {
  await page.goto("/demo001.html");
  const pages = page.locator(".printform_page");
  await expect(pages).toHaveCount(8, { timeout: 15_000 });
  expect(await page.locator(".pheader_processed").count()).toBe(8);
  // The source .printform container is removed once formatting completes
  // (PrintFormFormatter.format()); its presence would mean auto-init never
  // ran or bailed out early.
  expect(await page.locator(".printform").count()).toBe(0);
  expect(await page.locator(".printform_formatter_processed").count()).toBe(1);
});

test("renders a minimal multi-page document with the header shown only once when repeat is disabled", async ({ page }) => {
  await page.goto("/index006.html");
  const pages = page.locator(".printform_page");
  await expect(pages).toHaveCount(3, { timeout: 15_000 });
  // index006 sets repeat_header=n via legacy global vars — this is the
  // config-precedence path (legacy globals, not data-* attributes), a
  // separate code path from what the Studio v2 declarative binding tests.
  expect(await page.locator(".pheader_processed").count()).toBe(1);
});

test("auto-formats a script injected after the page has already loaded", async ({ page }) => {
  // Regression for the readyState fix: a script tag added post-load must
  // still trigger formatting instead of waiting forever for a
  // DOMContentLoaded event that already fired.
  await page.goto("/index001.html");
  await expect(page.locator(".printform_page").first()).toBeVisible({ timeout: 15_000 });
  const pageCountBefore = await page.locator(".printform_page").count();
  expect(pageCountBefore).toBeGreaterThan(0);

  await page.evaluate(() => {
    delete window.__printFormProcessed;
    delete window.__printFormScriptLoaded__;
    delete window.PrintForm;
    document.querySelectorAll(".printform_formatter_processed").forEach((node) => node.remove());
    const revived = document.createElement("div");
    revived.className = "paper_width printform";
    revived.innerHTML = '<div class="pheader">H</div><table class="prowitem"><tr><td>row</td></tr></table>';
    document.body.appendChild(revived);
    const script = document.createElement("script");
    script.src = "./dist/printform.js";
    document.body.appendChild(script);
  });

  await expect(page.locator(".printform_formatter_processed")).toHaveCount(1, { timeout: 15_000 });
});
