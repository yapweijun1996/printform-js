import { expect, test } from "@playwright/test";
import { openEditor, passLayoutReview } from "./studio-v2-helpers.js";
import { readClientStorage } from "./studio-v2-storage-inspection.js";

for (const phase of ["picker", "open", "write", "close"]) {
  test(`checks policy at the ${phase} boundary without losing a confirmed file outcome`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/studio-v2/");
    await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
    await openEditor(page);
    expect((await passLayoutReview(page)).ok).toBe(true);
    await page.evaluate((phase) => {
      window.confirm = () => true;
      const state = window.__fileRace = { phase: null, opens: 0, writes: 0, closes: 0, aborts: 0, buffered: null, committed: null };
      const pause = async (step) => {
        state.phase = step;
        if (step === phase) await new Promise((resolve) => { state.release = resolve; });
      };
      Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: async () => {
        await pause("picker");
        return { createWritable: async () => {
          state.opens += 1;
          await pause("open");
          return {
            async write(html) { state.writes += 1; state.buffered = html; await pause("write"); },
            async close() { state.closes += 1; await pause("close"); state.committed = state.buffered; },
            async abort() { state.aborts += 1; state.buffered = null; }
          };
        } };
      } });
    }, phase);
    await page.locator("#export-button").click();
    await expect.poll(() => page.evaluate(() => window.__fileRace.phase)).toBe(phase);
    const before = await readClientStorage(page);
    await page.locator("label.privacy-toggle").click();
    await expect(page.locator("#data-policy")).toHaveText(/Real data/i);
    const currentSaveState = await page.locator("#save-state").textContent();
    await page.evaluate(() => window.__fileRace.release());
    if (phase === "close") await expect.poll(() => page.evaluate(() => Boolean(window.__fileRace.committed))).toBe(true);
    else if (phase !== "picker") await expect.poll(() => page.evaluate(() => window.__fileRace.aborts)).toBe(1);
    await expect(page.locator("#save-state")).toHaveText(currentSaveState);
    const result = await page.evaluate(() => {
      const { opens, writes, closes, aborts, committed } = window.__fileRace;
      return { opens, writes, closes, aborts, committed };
    });
    expect(result.opens).toBe(phase === "picker" ? 0 : 1);
    expect(result.writes).toBe(["picker", "open"].includes(phase) ? 0 : 1);
    expect(result.closes).toBe(phase === "close" ? 1 : 0);
    if (phase === "close") { expect(result.committed).toContain("Sales Invoice"); expect(result.aborts).toBe(0); }
    else expect(result.committed).toBeNull();
    expect(await readClientStorage(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test("does not describe an unconfirmed close as cancelled or retry it", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  expect((await passLayoutReview(page)).ok).toBe(true);
  await page.evaluate(() => {
    window.confirm = () => true;
    window.__closeFailure = { attempts: 0, aborts: 0 };
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: async () => ({ createWritable: async () => ({
      async write() {},
      async close() { window.__closeFailure.attempts += 1; throw new DOMException("SYNTHETIC-CLOSE-DISCONNECT", "AbortError"); },
      async abort() { window.__closeFailure.aborts += 1; }
    }) }) });
  });
  await page.locator("#export-button").click();
  await expect(page.locator("#save-state")).toHaveText("Save completion unconfirmed");
  expect(await page.evaluate(() => window.__closeFailure)).toEqual({ attempts: 1, aborts: 0 });
});
