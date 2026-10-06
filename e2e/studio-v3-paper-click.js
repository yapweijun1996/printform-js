// Clicks an element inside the scaled paper preview at its true screen position, as a mouse would.
// Playwright's own click converts coordinates wrongly for a CSS-scaled iframe on some Chromium builds.
export async function clickPaper(page, locator) {
  await locator.evaluate(node => node.scrollIntoView({block:'center'}));
  const inner = await locator.evaluate(node => { const r = node.getBoundingClientRect(); return {x:r.left + r.width / 2,y:r.top + r.height / 2}; });
  const frame = page.locator('#preview-frame'), box = await frame.boundingBox(), zoom = Number(await frame.getAttribute('data-zoom') || 1);
  await page.mouse.click(box.x + inner.x * zoom, box.y + inner.y * zoom);
}
