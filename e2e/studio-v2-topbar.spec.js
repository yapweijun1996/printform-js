import { expect, test } from "@playwright/test";

test("keeps the topbar in one horizontal row and never scrolls the primary action off desktop", async ({ page }) => {
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
      const visibleItems = [...actions.children].filter(
        (node) => !node.classList.contains("visually-hidden") && getComputedStyle(node).display !== "none"
      );
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
    expect(layout.topbarHeight).toBeLessThan(68);
    expect(layout.topbarScrollHeight).toBeLessThanOrEqual(layout.topbarHeight + 1);
    expect(layout.actionTopDelta).toBeLessThanOrEqual(1);
    expect(layout.inspectorVisible).toBe(true);
    expect(layout.inspectorInsideActions).toBe(true);
    expect(layout.inspectorIndex).toBe(1);
    expect(layout.inspectorTopDelta).toBeLessThan(20);
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    // Below the desktop breakpoint the 8-slot bar may still overflow-scroll (fallback).
    if (viewport.width <= 720) expect(layout.actionsScrollWidth).toBeGreaterThan(layout.actionsClientWidth);
  }

  // Narrow width: the action row overflows and a vertical wheel scrolls it
  // horizontally (bindHorizontalWheel is still bound to .actions).
  await page.setViewportSize({ width: 720, height: 812 });
  const actions = page.locator(".actions");
  const maxScrollLeft = await actions.evaluate((node) => node.scrollWidth - node.clientWidth);
  expect(maxScrollLeft).toBeGreaterThan(40);
  const actionBox = await actions.boundingBox();
  await page.mouse.move(actionBox.x + actionBox.width / 2, actionBox.y + actionBox.height / 2);
  await page.mouse.wheel(0, 40);
  await expect.poll(() => actions.evaluate((node) => node.scrollLeft)).toBe(40);

  // Desktop (the 1440px width ROADMAP.md:170 called out): no horizontal scroll,
  // primary export fully visible, readiness chip present.
  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = await page.evaluate(() => {
    const row = document.querySelector(".actions");
    const exportBtn = document.querySelector("#export-button").getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    const chip = document.querySelector("#export-readiness");
    return {
      noOverflow: row.scrollWidth <= row.clientWidth + 1,
      primaryInside: exportBtn.right <= rowBox.right + 1 && exportBtn.left >= rowBox.left - 1,
      chipVisible: getComputedStyle(chip).display !== "none",
      chipText: chip.textContent.trim()
    };
  });
  expect(desktop.noOverflow).toBe(true);
  expect(desktop.primaryInside).toBe(true);
  expect(desktop.chipVisible).toBe(true);
  expect(desktop.chipText).toMatch(/Ready|Blocked/);

  // ⋯ More menu: opens with Import HTML, Escape dismisses and restores focus.
  await page.locator("#more-menu-button").click();
  await expect.poll(() => page.locator("#more-menu").evaluate((node) => node.matches(":popover-open"))).toBe(true);
  await expect(page.locator("#import-file-item")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => page.locator("#more-menu").evaluate((node) => node.matches(":popover-open"))).toBe(false);
  await expect(page.locator("#more-menu-button")).toBeFocused();

  // Export caret: reveals Export Untrusted; outside click dismisses.
  await page.locator("#export-menu-button").click();
  await expect.poll(() => page.locator("#export-menu").evaluate((node) => node.matches(":popover-open"))).toBe(true);
  await expect(page.locator("#export-untrusted-button")).toBeVisible();
  await page.locator("#preview-panel").click({ position: { x: 12, y: 12 } });
  await expect.poll(() => page.locator("#export-menu").evaluate((node) => node.matches(":popover-open"))).toBe(false);

  // The AI-launcher / close / focus cycle is unchanged.
  await page.setViewportSize({ width: 995, height: 778 });
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
