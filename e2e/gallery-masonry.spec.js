import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("320px gallery presents the newest cards in two columns", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/gallery/index.html");
  const cards = page.locator(".gallery-card");
  await expect(cards).toHaveCount(67);
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(second.x).toBeGreaterThan(first.x + first.width);
  expect(Math.abs(second.y - first.y)).toBeLessThan(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("mobile cards expose their visible document type in the accessible name", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/gallery/index.html");
  const card = page.locator(".gallery-card").first();
  const type = card.locator(".type-tag");
  const label = await type.textContent();
  expect(label.trim()).not.toBe("");
  await expect(card).toHaveAccessibleName(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  await expect(type).toBeVisible();
  const boxes = await card.evaluate((element) => {
    const card = element.getBoundingClientRect(), tag = element.querySelector(".type-tag").getBoundingClientRect();
    return { cardLeft: card.left, cardRight: card.right, tagLeft: tag.left, tagRight: tag.right };
  });
  expect(boxes.tagLeft).toBeGreaterThanOrEqual(boxes.cardLeft);
  expect(boxes.tagRight).toBeLessThanOrEqual(boxes.cardRight);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("masonry preserves order, full images and layout through resize and filtering", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/gallery/index.html");
  await expect(page.locator(".gallery-card")).toHaveCount(67);
  // Load every real thumbnail, including cards outside the viewport.
  await page.locator(".gallery-card img").evaluateAll(async (images) => {
    await Promise.all(images.map(async (image) => {
      image.loading = "eager";
      await image.decode();
    }));
  });
  for (const [width, columns] of [[320, 2], [360, 2], [390, 2], [768, 3], [1200, 5], [1440, 5]]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.locator(".gallery-card").evaluateAll((cards) =>
      new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size)).toBe(columns);
    const layout = await page.locator(".gallery-card").evaluateAll((cards) => cards.map((card) => {
      const box = card.getBoundingClientRect(), image = card.querySelector("img");
      const picture = image.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, height: box.height,
        imageRatio: picture.width / picture.height, naturalRatio: image.naturalWidth / image.naturalHeight,
        id: card.querySelector(".card-id").textContent, title: card.querySelector("h2").textContent,
        details: card.querySelector(".card-info p:last-child").textContent };
    }));
    expect(layout.map((card) => card.id)).toEqual(Array.from({ length: 67 }, (_, i) => `PF-${String(67 - i).padStart(3, "0")}`));
    expect(new Set(layout.map((card) => Math.round(card.height))).size).toBeGreaterThan(2);
    for (const [index, card] of layout.entries()) {
      expect(card.title).not.toBe("");
      expect(card.details).toMatch(/ · .+ · /);
      expect(Math.abs(card.imageRatio - card.naturalRatio)).toBeLessThan(0.002);
      if (index) expect(card.y).toBeGreaterThanOrEqual(layout[index - 1].y - 0.1);
      for (const other of layout.slice(index + 1)) {
        expect(card.right <= other.x + 0.5 || other.right <= card.x + 0.5 ||
          card.bottom <= other.y + 0.5 || other.bottom <= card.y + 0.5).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const cards = page.locator(".gallery-card");
  await cards.first().focus();
  await page.keyboard.press("Tab");
  await expect(cards.nth(1)).toBeFocused();
  await page.locator("#search").fill("PF-064");
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator(".card-id")).toHaveText("PF-064");
  await page.locator("#search").fill("no such design");
  await expect(page.locator("#empty-state")).toBeVisible();
  await expect.poll(() => page.locator("#gallery-grid").evaluate((grid) => grid.getBoundingClientRect().height)).toBe(0);
  await page.goBack();
  await expect(cards).toHaveCount(67);
});

for (const colorScheme of ["light", "dark"]) {
  test(`${colorScheme} gallery works with reduced motion`, async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.goto("/gallery/index.html");
    await expect(page.locator(".gallery-card")).toHaveCount(67);
    await page.locator('[data-language="zh"]').click();
    await page.locator("#search").fill("PF-004");
    await page.locator(".gallery-card").click();
    await expect(page.locator("[data-print]")).toBeEnabled();
    await expect(page.locator("[data-open]")).toHaveAttribute("href", /blue-sales-invoice|green|quotation/);
    await page.locator("[data-close]").click();
    await expect(page.locator(".gallery-card")).toBeFocused();
    await page.screenshot({ path: info.outputPath(`${colorScheme}.png`) });
  });
}
