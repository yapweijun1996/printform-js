import { expect, test } from "@playwright/test";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

test("does not cache an arbitrary same-origin document navigation", async ({ page }) => {
  await page.goto("/studio-v2/");
  await page.evaluate(async () => navigator.serviceWorker?.ready);
  await page.reload();
  const before = await readClientStorage(page);

  await page.goto("/studio-v2/samples/sales-invoice-v2.html");

  const after = await readClientStorage(page);
  expect(after.cacheEntries).toEqual(before.cacheEntries);
  expect(after.cacheEntries.some(({ url }) => url.endsWith("/samples/sales-invoice-v2.html"))).toBe(false);
});
