import fs from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const html = fs.readFileSync('index.html', 'utf8');
const parse = () => new JSDOM(html).window.document;

describe('homepage navigation', () => {
  it('keeps business, Studio and developer destinations usable without JavaScript', () => {
    const doc = parse();
    expect(doc.documentElement.lang).toBe('en');
    expect(doc.querySelector('a[href="#main"]')).not.toBeNull();
    expect(doc.querySelector('main h1')).not.toBeNull();
    expect(doc.querySelectorAll('main h1')).toHaveLength(1);
    const routes = ['gallery/index.html', 'demo001.html', 'demo002.html',
      'studio/index.html', 'studio-v2/', 'studio-v3/', 'README.md',
      'docs/configuration.html', 'docs/USAGE_GUIDE.md'];
    for (const route of routes) expect(doc.querySelector(`a[href="${route}"]`), route).not.toBeNull();
    const details = doc.querySelector('details');
    expect(details?.querySelector('summary')).not.toBeNull();
    for (const route of ['index_subtotal_test.html', 'delivery_order_test.html',
      'multiple_page_preview.html', ...Array.from({ length: 21 }, (_, i) => `index${String(i + 1).padStart(3, '0')}.html`)]) {
      expect(details?.querySelector(`a[href="${route}"]`), route).not.toBeNull();
    }
  });
});


describe('homepage language preference', () => {
  const load = async (storage) => {
    const { initHomepage } = await import('../homepage/language.js');
    const doc = parse();
    initHomepage(doc, storage);
    return doc;
  };

  it('restores Chinese and translates every marked text and accessible name, then returns to English', async () => {
    let saved = 'zh';
    const doc = await load(() => ({ getItem: () => saved, setItem: (_, value) => { saved = value; } }));
    const original = parse();
    for (const attr of ['data-i18n', 'data-i18n-label', 'data-i18n-alt']) {
      for (const node of doc.querySelectorAll(`[${attr}]`)) {
        const key = node.getAttribute(attr);
        const fallback = original.querySelector(`[${attr}="${key}"]`);
        const value = el => attr === 'data-i18n' ? el.textContent : el.getAttribute(attr === 'data-i18n-label' ? 'aria-label' : 'alt');
        expect(value(node), key).toMatch(/[\u3400-\u9fff]/u);
        expect(value(node), key).not.toBe(value(fallback));
      }
    }
    expect(doc.documentElement.lang).toBe('zh-CN');
    expect(doc.querySelector('[data-lang="zh"]').getAttribute('aria-pressed')).toBe('true');
    doc.querySelector('[data-lang="en"]').click();
    expect(saved).toBe('en');
    expect(doc.documentElement.lang).toBe('en');
    expect(doc.title).toBe(original.title);
    expect(doc.querySelector('main').textContent).toBe(original.querySelector('main').textContent);
  });

  it.each(['fr', 'toString', '__proto__', '', null])('falls back to English for unsupported saved value %s', async saved => {
    const doc = await load(() => ({ getItem: () => saved, setItem() {} }));
    expect(doc.documentElement.lang).toBe('en');
    expect(doc.querySelector('[data-lang="en"]').getAttribute('aria-pressed')).toBe('true');
  });

  it.each(['access', 'read', 'write'])('keeps language switching usable when storage %s throws', async failure => {
    const doc = await load(() => {
      if (failure === 'access') throw new Error('Storage unavailable');
      return {
        getItem() { if (failure === 'read') throw new Error('Read denied'); return null; },
        setItem() { if (failure === 'write') throw new Error('Quota exceeded'); }
      };
    });
    expect(doc.documentElement.lang).toBe('en');
    doc.querySelector('[data-lang="zh"]').click();
    expect(doc.documentElement.lang).toBe('zh-CN');
    expect(doc.querySelector('[data-lang="zh"]').getAttribute('aria-pressed')).toBe('true');
  });
});