import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 320, height: 568 }, serviceWorkers: "block" });

test("synchronous close and reopen keeps the new preview alive", async ({ page }) => {
  await page.goto("/gallery/index.html");
  const card = page.locator('[data-design-id="bilingual-academy-invoice"]');
  await card.click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  await page.evaluate(() => {
    document.querySelector("[data-close]").click();
    document.querySelector('[data-design-id="bilingual-academy-invoice"]').click();
  });
  await expect(page.locator("[data-print]")).toBeEnabled();
  await expect.poll(() => page.frameLocator("iframe").locator("body").evaluate(() => location.pathname)).toContain("bilingual-academy-invoice");
  await expect(page.frameLocator("iframe").locator(".printform_page")).toBeVisible();
});

for (const [width, height] of [[320, 568], [360, 640], [390, 664]]) {
  test(`PF063 compact paper budget at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/gallery/index.html");
    await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    const box = await page.locator("iframe").boundingBox();
    const top = await page.frameLocator("iframe").locator(".printform_page").first().evaluate((node) => node.getBoundingClientRect().top);
    expect(top).toBeLessThanOrEqual(100);
    if (width === 390) expect(box.height).toBeGreaterThanOrEqual(height * 0.7);
  });
}

test("repeated and different synchronous reopen, then close restores focus and scroll", async ({ page }) => {
  await page.goto("/gallery/index.html");
  const a = '[data-design-id="bilingual-academy-invoice"]';
  const b = '[data-design-id="premium-international-school-invoice"]';
  await page.locator(a).scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await page.locator(a).click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  for (const id of [b, a, b]) {
    await page.evaluate((target) => { document.querySelector("[data-close]").click(); document.querySelector(target).click(); }, id);
    await expect(page.locator("[data-print]")).toBeEnabled();
    await expect.poll(() => page.frameLocator("iframe").locator("body").evaluate(() => location.pathname)).toContain(id === a ? "bilingual-academy-invoice" : "premium-international-school-invoice");
  }
  await page.frameLocator("iframe").locator("#gallery-preview-options").focus();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog")).not.toBeVisible();
  await expect(page.locator(b)).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  expect(await page.evaluate(() => document.body.style.position)).toBe("");
});

test("options preserve paper and dataset; print and standalone stay intact", async ({ page, context }) => {
  await page.goto("/gallery/index.html");
  await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  const frame = page.frameLocator("iframe");
  const options = frame.locator("#gallery-preview-options");
  await expect(options).toHaveAttribute("aria-expanded", "false");
  expect((await options.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await options.focus();
  await page.keyboard.press("Enter");
  await expect(options).toHaveAttribute("aria-expanded", "true");
  const paper = frame.locator("#paper"), sample = frame.locator("#sample");
  expect(await paper.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
  expect((await paper.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await paper.selectOption("A5");
  await sample.selectOption("long");
  await expect.poll(() => frame.locator("body").evaluate(() => window.SCHOOL_RESULT?.sample)).toBe("long");
  await expect.poll(() => frame.locator("body").evaluate(() => window.SCHOOL_RESULT?.paper)).toBe("A5");
  await options.click();
  await options.click();
  await expect(paper).toHaveValue("A5");
  await expect(sample).toHaveValue("long");
  await frame.locator("body").evaluate(() => { window.__galleryPrintCalls = 0; window.print = () => { window.__galleryPrintCalls++; }; });
  await page.locator("[data-print]").click();
  expect(await frame.locator("body").evaluate(() => window.__galleryPrintCalls)).toBe(1);
  await page.emulateMedia({ media: "print" });
  await expect(options).toBeHidden();
  await expect(frame.locator(".printform_page").first()).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  const standalone = await context.newPage();
  await standalone.goto("/gallery/designs/bilingual-academy-invoice.html");
  await expect(standalone.locator("#print")).toBeEnabled();
  await expect(standalone.locator("nav.controls")).toBeVisible();
  await expect(standalone.locator("#gallery-preview-options")).toHaveCount(0);
  await standalone.close();
});

test("school rerenders disable outer print until success, including failure and recovery", async ({ page }) => {
  await page.goto("/gallery/index.html");
  await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
  const print = page.locator("[data-print]");
  await expect(print).toBeEnabled();
  const body = page.frameLocator("iframe").locator("body");
  await body.evaluate(() => {
    window.__printCalls = 0;
    window.print = () => { window.__printCalls++; };
    window.parent.__openCalls = 0;
    window.parent.open = () => { window.parent.__openCalls++; };
    const original = window.PrintForm.formatAll;
    window.PrintForm.formatAll = async (...args) => {
      await new Promise((resolve, reject) => { window.__release = resolve; window.__reject = reject; });
      return original.apply(window.PrintForm, args);
    };
  });
  const start = async (selector, value) => body.evaluate((_, { selector, value }) => {
    const control = document.querySelector(selector);
    control.value = value;
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return { ready: window.SCHOOL_READY, processed: window.__printFormProcessed,
      disabled: window.parent.document.querySelector("[data-print]").disabled };
  }, { selector, value });
  expect(await start("#paper", "A5")).toEqual({ ready: false, processed: true, disabled: true });
  await expect.poll(() => body.evaluate(() => typeof window.__release)).toBe("function");
  await print.evaluate(node => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(await body.evaluate(() => [window.__printCalls, window.parent.__openCalls])).toEqual([0, 0]);
  await body.evaluate(() => { window.__release(); window.__release = null; window.__reject = null; });
  await expect(print).toBeEnabled();
  expect(await start("#sample", "long")).toEqual({ ready: false, processed: true, disabled: true });
  await expect.poll(() => body.evaluate(() => typeof window.__reject)).toBe("function");
  await body.evaluate(() => { window.__reject(new Error("held format failed")); window.__reject = null; });
  await expect.poll(() => body.evaluate(() => window.SCHOOL_ERROR)).toContain("held format failed");
  await expect(print).toBeDisabled();
  await expect(page.locator(".preview-status")).toContainText("could not load");
  await print.evaluate(node => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(await body.evaluate(() => [window.__printCalls, window.parent.__openCalls])).toEqual([0, 0]);
  await start("#sample", "short");
  await expect.poll(() => body.evaluate(() => typeof window.__release)).toBe("function");
  await body.evaluate(() => window.__release());
  await expect(print).toBeEnabled();
  await print.click();
  expect(await body.evaluate(() => window.__printCalls)).toBe(1);
  const direct = await body.evaluate(() => {
    window.__release = null;
    window.SCHOOL_RERENDER();
    window.parent.document.querySelector("[data-print]").dispatchEvent(new window.parent.MouseEvent("click", { bubbles: true }));
    return { ready: window.SCHOOL_READY, disabled: window.parent.document.querySelector("[data-print]").disabled,
      prints: window.__printCalls, opens: window.parent.__openCalls };
  });
  expect(direct).toEqual({ ready: false, disabled: true, prints: 1, opens: 0 });
  await expect.poll(() => body.evaluate(() => typeof window.__release)).toBe("function");
  await body.evaluate(() => window.__release());
  await expect(print).toBeEnabled();
});

test("failed preview is recoverable after reopening", async ({ page }) => {
  await page.route("**/designs/bilingual-academy-invoice.html", (route) => route.fulfill({ status: 503, contentType: "text/html", body: "Unavailable" }));
  await page.goto("/gallery/index.html");
  await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
  await expect(page.locator(".preview-status")).toContainText("could not load", { timeout: 15000 });
  await expect(page.locator("[data-print]")).toBeDisabled();
  await page.locator("[data-close]").click();
  await page.unrouteAll();
  await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
  await expect(page.locator("[data-print]")).toBeEnabled();
});

test("late old load cannot replace a newer preview", async ({ page }) => {
  await page.route("**/designs/bilingual-academy-invoice.html", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => {});
  });
  await page.goto("/gallery/index.html");
  await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
  await page.evaluate(() => {
    window.stalePreviewFrame = document.querySelector("iframe");
    document.querySelector("[data-close]").click();
    document.querySelector('[data-design-id="premium-international-school-invoice"]').click();
  });
  await expect(page.locator("[data-print]")).toBeEnabled();
  await page.waitForTimeout(1800);
  await expect(page.locator("[data-print]")).toBeEnabled();
  await expect.poll(() => page.frameLocator("iframe").locator("body").evaluate(() => location.pathname)).toContain("premium-international-school-invoice");
  await page.evaluate(() => window.stalePreviewFrame.dispatchEvent(new Event("error")));
  await expect(page.locator(".preview-status")).not.toContainText("could not load");
});

test("print geometry matches standalone and Tab stays inside the dialog", async ({ page, context }) => {
  await page.goto("/gallery/index.html");
  await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  const frame = page.frameLocator("iframe");
  await frame.locator("#gallery-preview-options").focus();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement))).toBe(true);
  }
  const standalone = await context.newPage();
  await standalone.goto("/gallery/designs/bilingual-academy-invoice.html");
  await expect(standalone.locator("#print")).toBeEnabled();
  await page.emulateMedia({ media: "print" });
  await standalone.emulateMedia({ media: "print" });
  const geometry = (node) => {
    const page = node.querySelector(".printform_page");
    const box = page.getBoundingClientRect();
    return { count: node.querySelectorAll(".printform_page").length, width: box.width, height: box.height };
  };
  expect(await frame.locator("body").evaluate(geometry)).toEqual(await standalone.locator("body").evaluate(geometry));
  await standalone.close();
});

for (const [name, width, height] of [["320", 320, 568], ["390", 390, 664], ["landscape", 568, 320]]) {
  test(`mobile screenshot and reachable actions ${name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto("/gallery/index.html");
    await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    const box = await page.locator("iframe").boundingBox();
    expect(box.height).toBeGreaterThan(80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const selector of ["[data-close]", "[data-print]", "[data-open]"]) {
      const rect = await page.locator(selector).boundingBox();
      expect(rect.width).toBeGreaterThanOrEqual(44);
      expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.y + rect.height).toBeLessThanOrEqual(height);
    }
    await page.screenshot({ path: testInfo.outputPath(`printform-modal-${name}.png`) });
  });
}

test("Chinese dark preview keeps controls after viewport changes", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("printform_lang", "zh"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/gallery/index.html");
  await page.locator('[data-design-id="bilingual-academy-invoice"]').click();
  await expect(page.locator("[data-print]")).toBeEnabled();
  const frame = page.frameLocator("iframe"), options = frame.locator("#gallery-preview-options");
  await expect(options).toHaveText("预览选项");
  await options.click();
  await frame.locator("#paper").selectOption("A5");
  await expect.poll(() => frame.locator("body").evaluate(() => window.SCHOOL_RESULT?.paper)).toBe("A5");
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(frame.locator("#paper")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(options).toHaveAttribute("aria-expanded", "true");
  await expect(frame.locator("#paper")).toHaveValue("A5");
  await expect(page.locator("#modal-title")).toContainText("梅紫");
});
