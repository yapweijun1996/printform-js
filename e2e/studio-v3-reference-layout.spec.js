import { test, expect } from './studio-v3-test.js';
import { keepStructureOpen } from './studio-v3-structure.js';

for (const viewport of [{width:1440,height:900},{width:390,height:844},{width:768,height:600}]) {
  test(`references stay compact and composer reachable at ${viewport.width}px`, async ({page}, info) => {
    await page.route('https://gpt.yapweijun1996.com/demo/**', route => route.abort());
    await keepStructureOpen(page);
    await page.setViewportSize({width:1440,height:900});
    await page.goto('/studio-v3/');
    await expect(page.locator('[data-action=export]')).toBeEnabled({timeout:30000});
    const ids = ['items','header-company','header-registration','header-address','header-number','header-date','header-due','header-reference'];
    for (const [index,id] of ids.entries()) {
      await page.locator(`[data-select="${id}"]`).first().click();
      await page.locator('#left-panel [data-ai-add]').click();
      const comment = page.getByLabel(`Comment for ${id}`,{exact:true});
      await expect(comment).toBeFocused();
      await comment.fill(`Keep note ${index + 1}`);
      if (index === 1) {
        await page.setViewportSize(viewport);
        const scroll = page.locator('.ai-conversation-scroll');
        await scroll.evaluate(node => node.scrollTop = 0);
        const top = await scroll.boundingBox(), first = await page.locator('[data-ai-tag-id]').first().boundingBox();
        expect(first.y - top.y).toBeLessThan(140);
        await expect(page.locator('#ai-prompt')).toBeInViewport({ratio:1});
        await expect(page.locator('[data-ai-send]')).toBeInViewport({ratio:1});
        await page.screenshot({path:info.outputPath('two-references.png')});
        await page.setViewportSize({width:1440,height:900});
      }
    }
    await page.setViewportSize(viewport);
    await expect(page.locator('[data-ai-tag-id]')).toHaveCount(8);
    await page.locator('.ai-conversation-scroll').evaluate(node => node.scrollTop = node.scrollHeight);
    await expect(page.getByLabel('Comment for header-reference',{exact:true})).toBeInViewport({ratio:1});
    await expect(page.locator('#ai-prompt')).toBeInViewport({ratio:1});
    await page.locator('#ai-prompt').fill('Keep all values; improve spacing.');
    await expect(page.locator('[data-ai-send]')).toBeInViewport({ratio:1});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({path:info.outputPath('eight-references.png')});
    await page.getByRole('button',{name:'Remove reference header-reference',exact:true}).click();
    await expect(page.locator('[data-ai-tag-id]')).toHaveCount(7);
    await expect(page.getByLabel('Comment for header-company',{exact:true})).toHaveValue('Keep note 2');
    await page.getByRole('button',{name:'Remove all',exact:true}).click();
    await expect(page.locator('[data-ai-element-tags]')).toBeHidden();
    await expect(page.locator('.ai-welcome')).toBeVisible();
    await expect(page.locator('#ai-prompt')).toHaveValue('Keep all values; improve spacing.');
    await expect(page.locator('#revision')).toHaveText('r0');
  });
}
