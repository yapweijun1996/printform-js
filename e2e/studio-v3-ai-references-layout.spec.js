import { test, expect } from './studio-v3-test.js';
import { syntheticPdf, syntheticPng } from './fixtures/reference-documents.js';

const ready = page => expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
async function attach(page, file) {
  await page.getByLabel('Add reference PDF or image', {exact:true}).setInputFiles(file);
  await expect(page.locator('.ai-reference-card')).toHaveCount(1,{timeout:30000});
}
const widths = page => page.locator('.ai-reference-card').evaluate(card=>({
  card: card.getBoundingClientRect().width,
  name: card.querySelector(':scope > span').getBoundingClientRect().width,
  remove: card.querySelector(':scope > button').getBoundingClientRect().width
}));

test.beforeEach(async({page})=> {
  await page.goto('/studio-v3/'); await ready(page);
  await page.locator('[data-ai-toggle]').click(); await page.getByText('References · PDF / image',{exact:true}).click();
});

test('a text-only PDF card gives the file name the room and keeps Remove small',async({page})=> {
  await attach(page,syntheticPdf());
  await expect(page.locator('.ai-reference-excerpt')).toBeVisible();
  const {card,name,remove} = await widths(page);
  expect(name).toBeGreaterThan(card * .5);   // not squeezed into the thumbnail column
  expect(remove).toBeLessThan(card * .3);    // not stretched across the card
});

test('an image card keeps its thumbnail column, a readable name and a small Remove',async({page})=> {
  await attach(page,syntheticPng());
  await expect(page.locator('.ai-reference-thumbnails')).toBeVisible();
  const thumb = await page.locator('.ai-reference-thumbnails').evaluate(n=>n.getBoundingClientRect().width);
  const {card,name,remove} = await widths(page);
  expect(thumb).toBeLessThan(card * .2); expect(name).toBeGreaterThan(card * .4); expect(remove).toBeLessThan(card * .3);
});

test('on a phone, open references scroll inside their own area and leave the conversation room',async({page})=> {
  await page.setViewportSize({width:390,height:844});
  await attach(page,syntheticPdf());
  const log = await page.locator('[data-ai-log]').evaluate(n=>n.getBoundingClientRect().height);
  expect(log).toBeGreaterThanOrEqual(200);
  await expect(page.locator('#ai-prompt')).toBeInViewport({ratio:1}); await expect(page.locator('[data-ai-send]')).toBeInViewport({ratio:1});
});

test('Send greyed out for missing image support says so, right under the message box',async({page})=> {
  await page.setViewportSize({width:390,height:844});
  await attach(page,syntheticPng()); await page.locator('#ai-prompt').fill('Use navy accents.');
  await expect(page.locator('[data-ai-send]')).toBeDisabled();
  const reason = page.locator('[data-ai-send-reason]');
  await expect(reason).toBeVisible(); await expect(reason).toContainText('Check image support'); await expect(reason).toBeInViewport({ratio:1});
});
