import { expect, test } from "@playwright/test";

test("presents repeated areas as clear, accessible responsive cards", async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
  await expect(page.locator("#repeat-flags-fields .repeat-flag-card")).toHaveCount(7, { timeout: 20_000 });

  const initial = await page.locator("#repeat-flags-fields").evaluate((container) => {
    const cards = [...container.querySelectorAll("label.repeat-flag-card")];
    return {
      count: cards.length,
      allHaveCheckbox: cards.every((card) => card.querySelector("input[type=checkbox]")),
      allHaveText: cards.every((card) => card.querySelector(".repeat-flag-copy")?.textContent?.trim()),
      checkedCards: cards.filter((card) => card.classList.contains("is-checked")).length,
      cardHeights: cards.map((card) => Math.round(card.getBoundingClientRect().height)),
      gridColumns: getComputedStyle(container).gridTemplateColumns
    };
  });
  expect(initial.count).toBe(7);
  expect(initial.allHaveCheckbox).toBe(true);
  expect(initial.allHaveText).toBe(true);
  expect(initial.checkedCards).toBeGreaterThan(0);
  expect(Math.min(...initial.cardHeights)).toBeGreaterThanOrEqual(48);
  expect(initial.gridColumns.split(" ")).toHaveLength(2);

  for (const viewport of [{ width: 995, height: 778 }, { width: 720, height: 812 }, { width: 375, height: 812 }, { width: 320, height: 812 }]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => {
      const container = document.querySelector("#repeat-flags-fields");
      const fieldset = document.querySelector(".repeat-settings");
      const cards = [...container.querySelectorAll(".repeat-flag-card")];
      const fieldsetBox = fieldset.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        fieldsetWidth: fieldsetBox.width,
        cardsInside: cards.every((card) => card.getBoundingClientRect().right <= fieldsetBox.right + 1),
        gridColumns: getComputedStyle(container).gridTemplateColumns
      };
    });
    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.cardsInside).toBe(true);
    expect(layout.fieldsetWidth).toBeGreaterThan(0);
    if (viewport.width <= 360) expect(layout.gridColumns.split(" ")).toHaveLength(1);
  }
});
