import { chinese } from './zh.js';

export function initHomepage(doc, getStorage = () => window.localStorage) {
  // English lives in usable HTML; capture it once rather than maintain a second dictionary.
  const bindings = [];
  for (const [marker, attribute] of [
    ['data-i18n', null], ['data-i18n-label', 'aria-label'], ['data-i18n-alt', 'alt']
  ]) {
    for (const node of doc.querySelectorAll(`[${marker}]`)) {
      bindings.push({ node, attribute, key: node.getAttribute(marker),
        english: attribute ? node.getAttribute(attribute) : node.textContent });
    }
  }
  const buttons = doc.querySelectorAll('[data-lang]');
  const apply = value => {
    const language = value === 'zh' ? 'zh' : 'en';
    doc.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    for (const { node, attribute, key, english } of bindings) {
      const text = language === 'zh' && Object.hasOwn(chinese, key) ? chinese[key] : english;
      if (attribute) node.setAttribute(attribute, text);
      else node.textContent = text;
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.lang === language));
    }
    return language;
  };
  let saved;
  try { saved = getStorage().getItem('printform_lang'); } catch { /* Storage is optional. */ }
  apply(saved);
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const language = apply(button.dataset.lang);
      try { getStorage().setItem('printform_lang', language); } catch { /* Keep this visit usable. */ }
    });
  }
  doc.querySelector('.languages').hidden = false;
}
