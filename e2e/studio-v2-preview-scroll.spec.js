import { expect, test } from "@playwright/test";

test("maps vertical mouse-wheel movement to horizontal preview scrolling", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

  const preview = page.locator(".preview-viewport");
  await preview.evaluate((viewport) => { viewport.scrollLeft = 0; });
  const box = await preview.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  const result = await preview.evaluate((viewport) => ({
    scrollLeft: viewport.scrollLeft,
    maxScrollLeft: viewport.scrollWidth - viewport.clientWidth
  }));

  expect(result.maxScrollLeft).toBeGreaterThan(0);
  expect(result.scrollLeft).toBe(120);
});
