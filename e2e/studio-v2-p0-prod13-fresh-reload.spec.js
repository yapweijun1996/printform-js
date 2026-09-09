import { expect, test } from "@playwright/test";
import { admitPublicGateway, openEditor } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

const CANARY = "REAL-RELOAD-CANARY-20260908";

test("PROD-13 13-03 reload does not restore Real data and explicit export stays separate", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await openEditor(page);
  await page.locator("label.privacy-toggle").click();
  await expect(page.locator("#data-policy")).toHaveText(/Real data: session only, not cached|真实数据：仅本会话，不缓存/i);
  await admitPublicGateway(page);

  const manifestEditor = page.locator("#manifest-editor");
  const manifest = JSON.parse(await manifestEditor.inputValue());
  manifest.title = CANARY;
  await manifestEditor.fill(JSON.stringify(manifest, null, 2));
  await page.locator("#apply-source-button").click();
  await page.locator("#source-diff-apply").click();
  await expect(manifestEditor).toHaveValue(new RegExp(CANARY));
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });

  const beforeExport = await readClientStorage(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("#export-menu-button").click();
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-untrusted-button").click();
  const download = await downloadEvent;
  const afterExport = await readClientStorage(page);

  expect(download.suggestedFilename()).toMatch(/-untrusted\.html$/);
  await expect(page.locator("#save-state")).toHaveText(/Download started|已开始下载|Muat turun bermula|ダウンロード開始|Đã bắt đầu tải xuống/i);
  expect(afterExport).toEqual(beforeExport);

  await page.reload();
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await openEditor(page);
  await admitPublicGateway(page);
  const reloaded = await page.evaluate(async () => ({
    summary: await window.PrintFormStudioAgent.execute("get_project_summary"),
    recoveryVisible: !document.querySelector("#restore-banner")?.classList.contains("hidden"),
    policy: document.querySelector("#data-policy")?.textContent || ""
  }));
  const reloadedStorage = await readClientStorage(page);

  expect(reloaded.summary.result.revision).toBe(0);
  expect(reloaded.recoveryVisible).toBe(false);
  expect(reloaded.policy).toMatch(/Synthetic data only|仅合成数据/i);
  expect(await manifestEditor.inputValue()).not.toContain(CANARY);
  expect(JSON.stringify(reloadedStorage)).not.toContain(CANARY);
});
