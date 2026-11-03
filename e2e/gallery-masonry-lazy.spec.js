import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("distant thumbnails are requested only as the reader scrolls toward them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests = new Set();
  page.on("request", (request) => requests.add(request.url()));
  await page.goto("/gallery/index.html");
  const cards = page.locator(".gallery-card");
  await expect(cards).toHaveCount(67);
  const firstImage = cards.first().locator("img");
  const lastImage = cards.last().locator("img");
  await expect.poll(() => firstImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  const farUrl = await lastImage.evaluate((image) => image.currentSrc || image.src);
  const distance = await lastImage.evaluate((image) => image.getBoundingClientRect().top);
  expect(distance).toBeGreaterThan(3 * 844);
  expect(requests.has(farUrl)).toBe(false);
  expect(await lastImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(false);

  await cards.last().scrollIntoViewIfNeeded();
  await expect.poll(() => requests.has(farUrl)).toBe(true);
  await expect.poll(() => lastImage.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
});

test("a card growing after initial layout repacks the gallery without overlaps", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/gallery/index.html");
  const cards = page.locator(".gallery-card");
  await expect(cards).toHaveCount(67);
  await expect.poll(() => cards.first().locator("img").evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  const before = await cards.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, height: box.height };
  }));

  // Simulate content arriving after the initial render, without invoking layout code.
  await cards.first().locator(".card-info > div").evaluate((labels) => {
    const additionalContent = document.createElement("p");
    additionalContent.textContent = "Additional document details";
    additionalContent.style.height = "240px";
    labels.append(additionalContent);
  });
  await expect.poll(async () => {
    const after = await cards.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, height: box.height };
    }));
    const grew = after[0].height > before[0].height + 200;
    const moved = after.slice(1).some((card, index) =>
      Math.abs(card.x - before[index + 1].x) > 1 || Math.abs(card.y - before[index + 1].y) > 1);
    const overlaps = after.some((card, index) => after.slice(index + 1).some((other) =>
      card.right > other.x + 0.5 && other.right > card.x + 0.5 &&
      card.bottom > other.y + 0.5 && other.bottom > card.y + 0.5));
    return grew && moved && !overlaps;
  }).toBe(true);
});
