import { expect, test } from "@playwright/test";

test("keeps the topbar in one horizontal row across responsive widths", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

  for (const viewport of [{ width: 995, height: 778 }, { width: 720, height: 812 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator("body")).toHaveClass(/inspector-closed/);
    await expect.poll(() => page.locator("#inspector-toggle").evaluate((node) => getComputedStyle(node).display !== "none")).toBe(true);
    const layout = await page.evaluate(() => {
      const topbar = document.querySelector(".topbar");
      const actions = document.querySelector(".actions");
      const toggle = document.querySelector("#inspector-toggle");
      const visibleItems = [...actions.children].filter((node) => !node.classList.contains("visually-hidden"));
      const tops = visibleItems.map((node) => node.getBoundingClientRect().top);
      return {
        topbarHeight: topbar.getBoundingClientRect().height,
        topbarScrollHeight: topbar.scrollHeight,
        actionTopDelta: Math.max(...tops) - Math.min(...tops),
        actionsClientWidth: actions.clientWidth,
        actionsScrollWidth: actions.scrollWidth,
        inspectorInsideActions: toggle?.parentElement === actions,
        inspectorIndex: visibleItems.indexOf(toggle),
        inspectorVisible: getComputedStyle(toggle).display !== "none",
        inspectorTopDelta: Math.abs(toggle.getBoundingClientRect().top - topbar.getBoundingClientRect().top),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth
      };
    });
    expect(layout.topbarHeight).toBeLessThan(80);
    expect(layout.topbarScrollHeight).toBeLessThanOrEqual(layout.topbarHeight + 1);
    expect(layout.actionTopDelta).toBeLessThanOrEqual(1);
    expect(layout.inspectorVisible).toBe(true);
    expect(layout.inspectorInsideActions).toBe(true);
    expect(layout.inspectorIndex).toBe(1);
    expect(layout.inspectorTopDelta).toBeLessThan(20);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    if (viewport.width <= 720) expect(layout.actionsScrollWidth).toBeGreaterThan(layout.actionsClientWidth);
  }

  await page.setViewportSize({ width: 995, height: 778 });
  const actions = page.locator(".actions");
  const actionOverflow = await actions.evaluate((node) => ({ scrollLeft: node.scrollLeft, maxScrollLeft: node.scrollWidth - node.clientWidth }));
  expect(actionOverflow.maxScrollLeft).toBeGreaterThan(0);
  const actionBox = await actions.boundingBox();
  await page.mouse.move(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
  await page.mouse.wheel(0, 120);
  await expect.poll(() => actions.evaluate((node) => node.scrollLeft)).toBe(120);

  await page.locator("#inspector-toggle").click();
  await expect(page.locator("#inspector-panel")).toBeVisible();
  await expect(page.locator("#ai-designer-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ai-prompt")).toBeVisible();
  await expect(page.locator("#inspector-close")).toBeFocused();
  await page.locator("#inspector-close").click();
  await expect(page.locator("#ai-floating-launcher")).toBeVisible();
  await expect(page.locator("#ai-floating-launcher")).toHaveAttribute("title", /AI Designer/);
  await page.locator("#ai-floating-launcher").click();
  await expect(page.locator("#ai-designer-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#inspector-close")).toBeFocused();
  await page.locator("#inspector-close").click();
  await expect(page.locator("#ai-floating-launcher")).toBeFocused();
});
