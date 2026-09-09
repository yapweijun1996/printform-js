import { expect, test } from "@playwright/test";
import { openInspector } from "./studio-v2-helpers.js";

test("09-03 keeps the desktop inspector rail, preview and export geometry aligned while resizing", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await openInspector(page);
  await expect(page.locator("#inspector-panel")).toBeVisible();
  await expect.poll(() => page.locator("#inspector-panel").evaluate((node) => getComputedStyle(node).transform)).toBe("none");

  const geometry = () => page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    return {
      viewport: innerWidth,
      rail: box("#inspector-panel"),
      preview: box("#preview-panel"),
      topbar: box(".topbar"),
      export: box("#export-button"),
      handle: document.querySelector("#inspector-resize-handle").getAttribute("aria-valuenow"),
      documentWidth: document.documentElement.scrollWidth
    };
  });

  const initial = await geometry();
  expect(initial.rail.right).toBeCloseTo(initial.viewport, 0);
  expect(initial.preview.right).toBeLessThanOrEqual(initial.rail.left + 1);
  expect(initial.export.left).toBeGreaterThanOrEqual(initial.topbar.left);
  expect(initial.export.right).toBeLessThanOrEqual(initial.topbar.right + 1);

  await page.locator("#inspector-resize-handle").focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await geometry()).rail.width).toBeGreaterThan(initial.rail.width);
  const widened = await geometry();
  expect(widened.rail.right).toBeCloseTo(widened.viewport, 0);
  expect(widened.preview.right).toBeLessThanOrEqual(widened.rail.left + 1);
  expect(widened.export.right).toBeLessThanOrEqual(widened.topbar.right + 1);
  expect(widened.documentWidth).toBeLessThanOrEqual(widened.viewport);

  await page.keyboard.press("End");
  const minimum = await geometry();
  expect(Number(minimum.handle)).toBe(320);
  expect(minimum.rail.width).toBe(320);
  expect(minimum.preview.right).toBeLessThanOrEqual(minimum.rail.left + 1);
  expect(minimum.export.right).toBeLessThanOrEqual(minimum.topbar.right + 1);
});

test("09-04 keeps the stacked mobile workspace reachable without document-wide horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await expect(page.locator("#preview-frame")).toBeVisible();

  const viewportState = () => page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    return {
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyPosition: getComputedStyle(document.body).position,
      htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
      workspace: box(".workspace"),
      preview: box("#preview-panel")
    };
  });

  let state = await viewportState();
  expect(state.documentWidth).toBeLessThanOrEqual(state.viewport);
  expect(state.bodyPosition).toBe("static");
  expect(state.workspace.right).toBeLessThanOrEqual(state.viewport + 1);
  expect(state.preview.right).toBeLessThanOrEqual(state.viewport + 1);

  const editorToggle = page.locator("#editor-toggle");
  await editorToggle.click();
  await expect(page.locator("#editor-panel")).toBeVisible();
  await expect(page.locator("#manifest-editor")).toBeVisible();
  state = await viewportState();
  expect(state.documentWidth).toBeLessThanOrEqual(state.viewport);
  expect(state.workspace.right).toBeLessThanOrEqual(state.viewport + 1);

  await page.locator("#inspector-toggle").click();
  await expect(page.locator("#inspector-panel")).toBeVisible();
  await expect.poll(() => page.locator("#inspector-panel").evaluate((node) => Math.round(node.getBoundingClientRect().right))).toBe(375);
  const inspector = await page.locator("#inspector-panel").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, prompt: Boolean(document.querySelector("#ai-prompt")) };
  });
  expect(inspector.left).toBeCloseTo(0, 0);
  expect(inspector.right).toBeCloseTo(375, 0);
  expect(inspector.width).toBeCloseTo(375, 0);
  expect(inspector.prompt).toBe(true);
  state = await viewportState();
  expect(state.documentWidth).toBeLessThanOrEqual(state.viewport);

  await page.keyboard.press("Escape");
  await expect(page.locator("#inspector-panel")).toHaveClass(/is-closed/);
  await expect(page.locator("#editor-panel")).toBeVisible();
});

test("09-06 restores focus, selects inspector tabs by keyboard and wraps mobile Tab navigation", async ({ page }) => {
  await page.setViewportSize({ width: 995, height: 778 });
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

  await page.locator("#inspector-toggle").click();
  await expect(page.locator("#inspector-close")).toBeFocused();
  await page.locator("#inspector-close").click();
  await expect(page.locator("#inspector-toggle")).toBeFocused();
  await page.waitForTimeout(450);

  await page.locator("#editor-toggle").click();
  await expect(page.locator("#editor-panel-close")).toBeFocused();
  await page.locator("#editor-panel-close").click();
  await expect(page.locator("#editor-toggle")).toBeFocused();

  await page.locator("#inspector-toggle").click();
  await expect(page.locator("#inspector-close")).toBeFocused();
  await page.waitForTimeout(450);
  await page.locator("#ai-designer-tab").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#quality-tab")).toHaveAttribute("aria-selected", "true");
  await page.locator("#quality-tab").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#agent-tab")).toHaveAttribute("aria-selected", "true");

  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.locator("#inspector-panel").evaluate((node) => Math.round(node.getBoundingClientRect().right))).toBe(375);
  await page.evaluate(() => {
    const panel = document.querySelector("#inspector-panel");
    const activePanel = panel.querySelector('[role="tabpanel"]:not([hidden])');
    const focusable = [
      ...panel.querySelectorAll(".inspector-header button:not([disabled])"),
      ...(activePanel?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || [])
    ].filter((element) => element.offsetParent !== null || element === document.activeElement);
    const first = focusable[0];
    const last = focusable.at(-1);
    first.dataset.s12FocusTarget = "first";
    last.focus();
    last.dataset.s12FocusTarget = "last";
  });
  await page.keyboard.press("Tab");
  await expect(page.locator('[data-s12-focus-target="first"]')).toBeFocused();
});
