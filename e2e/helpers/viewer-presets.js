export async function chooseFit(page) {
  await page.locator('[data-presets]').click();
  await page.locator('[data-fit]').click();
}
