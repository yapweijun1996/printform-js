import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { openEditor } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARY = "SYNTHETIC-IMPORTED-CLASSIFICATION-CANARY";
const fixture = fs.readFileSync("site-dist/studio-v2/samples/sales-invoice-v2.html", "utf8").replaceAll("Sales Invoice", CANARY);

test("requires current-document confirmation and starts a fresh Synthetic persistence context", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await openEditor(page);
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await page.locator("#import-file").setInputFiles({ name: "synthetic-unclassified.html", mimeType: "text/html", buffer: Buffer.from(fixture) });
  await expect(page.locator("#data-policy")).toHaveText(/Unknown/i);
  expect(JSON.parse(await page.locator("#manifest-editor").inputValue()).title).toContain(CANARY);
  await page.locator("label.privacy-toggle").click();
  await expect(page.locator("#data-policy")).toHaveText(/Real data/i);

  let confirmation = "";
  page.once("dialog", async (dialog) => { confirmation = dialog.message(); await dialog.dismiss(); });
  await page.locator("label.privacy-toggle").click();
  expect(confirmation).toContain("entire current document");
  await expect(page.locator("#real-data-mode")).toBeChecked();
  await expect(page.locator("#data-policy")).toHaveText(/Real data/i);
  expect(JSON.stringify(await readClientStorage(page))).not.toContain(CANARY);

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("label.privacy-toggle").click();
  await expect(page.locator("#data-policy")).toHaveText(/Synthetic/i);
  expect(JSON.parse(await page.locator("#manifest-editor").inputValue()).title).toContain(CANARY);
  const after = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  for (const [key, value] of Object.entries(before)) expect(after[key]).toBe(value);
  const persisted = Object.entries(after).filter(([, value]) => value.includes(CANARY));
  expect(persisted.length).toBeGreaterThan(0);
  expect(persisted.every(([key]) => key.includes(":context:"))).toBe(true);
});
