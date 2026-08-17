import { expect, test } from "@playwright/test";
import { openInspector } from "./studio-v2-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("lets desktop users close and reopen the persistent inspector rail", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openInspector(page);
  await expect(page.locator("#inspector-panel")).toBeVisible();
  await expect(page.locator("#inspector-panel")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#ai-designer-tab")).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ai-designer-tabpanel")).toBeVisible();
  await expect(page.locator("#agent-tabpanel")).toBeHidden();
  await page.locator("#inspector-close").click();
  await expect(page.locator("#inspector-panel")).toHaveClass(/is-closed/);
  await expect(page.locator("#inspector-panel")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#inspector-toggle")).toBeVisible();
  await expect(page.locator("#inspector-toggle")).toBeFocused();
  await page.locator("#inspector-toggle").click();
  await expect(page.locator("#inspector-panel")).toBeVisible();
});

test("renders the inspector as a full-height right side panel", async ({ page }) => {
  await page.setViewportSize({ width: 995, height: 778 });
  await page.locator("#inspector-toggle").click();
  await page.locator("#ai-designer-tab").click();
  await page.waitForTimeout(250);
  const layout = await page.evaluate(() => {
    const panel = document.querySelector("#inspector-panel");
    const chat = document.querySelector("#ai-chat-log");
    const composer = document.querySelector(".ai-composer");
    const box = (node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      bodyScrollWidth: document.documentElement.scrollWidth,
      panel: box(panel),
      chat: box(chat),
      composer: box(composer),
      position: getComputedStyle(panel).position
    };
  });
  expect(layout.position).toBe("fixed");
  expect(layout.panel.y).toBe(0);
  expect(layout.panel.height).toBeCloseTo(layout.viewport.height, 0);
  expect(layout.panel.bottom).toBeCloseTo(layout.viewport.height, 0);
  expect(layout.panel.x + layout.panel.width).toBeCloseTo(layout.viewport.width, 0);
  expect(layout.panel.width).toBeLessThanOrEqual(440.5);
  expect(layout.chat.height).toBeGreaterThan(200);
  expect(layout.composer.bottom).toBeLessThanOrEqual(layout.viewport.height);
  expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewport.width);
});

test("keeps the preview clear of the persistent inspector near the desktop breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await openInspector(page);
  await expect(page.locator("#inspector-panel")).toBeVisible();
  const layout = await page.evaluate(() => {
    const preview = document.querySelector("#preview-panel").getBoundingClientRect();
    const inspector = document.querySelector("#inspector-panel").getBoundingClientRect();
    return { previewRight: preview.right, inspectorLeft: inspector.left, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth };
  });
  expect(layout.previewRight).toBeLessThanOrEqual(layout.inspectorLeft + 0.5);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
});
