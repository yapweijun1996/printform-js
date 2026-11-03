import { test, expect } from "@playwright/test";

test.use({ serviceWorkers: "allow", viewport: { width: 320, height: 844 } });

async function loadThumbnails(page) {
  await page.locator(".gallery-card img").evaluateAll(async (images) => {
    await Promise.all(images.map(async (image) => {
      image.loading = "eager";
      await image.decode();
    }));
  });
}

async function expectMasonry(page, count) {
  const cards = page.locator(".gallery-card");
  await expect(cards).toHaveCount(count);
  await expect(page.locator("#gallery-grid")).toHaveClass(/\bis-masonry\b/);
  await expect.poll(() => cards.evaluateAll((nodes) =>
    new Set(nodes.map((node) => Math.round(node.getBoundingClientRect().left))).size)).toBe(2);
  const geometry = await page.evaluate(() => {
    const grid = document.querySelector("#gallery-grid").getBoundingClientRect();
    return {
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      grid: { left: grid.left, right: grid.right, top: grid.top, bottom: grid.bottom },
      cards: [...document.querySelectorAll(".gallery-card")].map((card) => {
        const box = card.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      }),
    };
  });
  expect(geometry.viewport).toBe(320);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewport);
  for (const [index, card] of geometry.cards.entries()) {
    expect(card.left).toBeGreaterThanOrEqual(geometry.grid.left - 0.5);
    expect(card.right).toBeLessThanOrEqual(geometry.grid.right + 0.5);
    expect(card.top).toBeGreaterThanOrEqual(geometry.grid.top - 0.5);
    expect(card.bottom).toBeLessThanOrEqual(geometry.grid.bottom + 0.5);
    for (const other of geometry.cards.slice(index + 1)) {
      expect(card.right <= other.left + 0.5 || other.right <= card.left + 0.5 ||
        card.bottom <= other.top + 0.5 || other.bottom <= card.top + 0.5).toBe(true);
    }
  }
}

test("installed gallery retains 320px masonry on offline reload and search", async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.goto("/gallery/index.html");
  await expect(page.locator(".gallery-card")).toHaveCount(67);

  // The real worker finishes its integrity-checked precache before activation.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const precached = await page.evaluate(async () => {
    const build = document.querySelector('meta[name="printform-build"]').content;
    const registration = await navigator.serviceWorker.ready;
    const cacheName = `pf-gallery-shell-${build}`;
    if (!(await caches.keys()).includes(cacheName)) return false;
    const cache = await caches.open(cacheName);
    const paths = ["index.html", `releases/${build}/gallery/gallery.css`,
      `releases/${build}/gallery/js/main.js`, `releases/${build}/gallery/manifest.json`];
    return registration.active === navigator.serviceWorker.controller &&
      (await Promise.all(paths.map((path) => cache.match(new URL(path, registration.scope))))).every(Boolean);
  });
  expect(precached).toBe(true);
  // Initial thumbnails may have loaded before the worker claimed this page.
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.locator(".gallery-card")).toHaveCount(67);

  // Thumbnails use a separate runtime cache rather than the shell precache.
  await loadThumbnails(page);
  expect(await page.evaluate(async () => {
    const cache = await caches.open("pf-gallery-thumbs-v1");
    const images = [...document.querySelectorAll(".gallery-card img")];
    return (await Promise.all(images.map((image) => cache.match(image.src)))).every(Boolean);
  })).toBe(true);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await expect(page.locator(".gallery-card")).toHaveCount(67);
    await loadThumbnails(page);
    await expectMasonry(page, 67);

    await page.locator("#search").fill("PF-06");
    await expect(page.locator(".gallery-card .card-id")).toHaveText(
      Array.from({ length: 8 }, (_, index) => `PF-0${67 - index}`),
    );
    await loadThumbnails(page);
    await expectMasonry(page, 8);

    await page.reload();
    await expect(page.locator("#search")).toHaveValue("PF-06");
    await expect(page.locator(".gallery-card .card-id")).toHaveText(
      Array.from({ length: 8 }, (_, index) => `PF-0${67 - index}`),
    );
    await loadThumbnails(page);
    await expectMasonry(page, 8);
  } finally {
    await context.setOffline(false);
  }
});
