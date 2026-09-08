import { expect, test } from "@playwright/test";
import { openEditor } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

test("keeps an explicit Untrusted file export separate from automatic persistence", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await openEditor(page);
  await page.locator("label.privacy-toggle").click();
  await expect(page.locator("#data-policy")).toHaveText(/Real data|真实数据/i);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  const before = await readClientStorage(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("#export-menu-button").click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-untrusted-button").click();
  const download = await downloadEvent;
  const after = await readClientStorage(page);

  expect(download.suggestedFilename()).toMatch(/-untrusted\.html$/);
  await expect(page.locator("#save-state")).toHaveText(/Download started|已开始下载|Muat turun bermula|ダウンロード開始|Đã bắt đầu tải xuống/i);
  expect(after).toEqual(before);
});
