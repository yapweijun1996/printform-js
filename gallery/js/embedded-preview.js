// The school invoice toolbar is a sibling of the generated paper, never its content.
export function adaptEmbeddedPreview(doc, language) {
  const nav = doc.querySelector('body > nav.controls[aria-label="Invoice preview controls"]');
  if (!nav || !doc.querySelector('body > #invoice-root') || !nav.querySelector('#paper') || !nav.querySelector('#sample')) return;
  let toggle = doc.getElementById('gallery-preview-options');
  if (!toggle) {
    const style = doc.createElement('style');
    style.textContent = `
      #gallery-preview-options { display: none; }
      @media screen and (max-width: 680px), screen and (max-height: 450px) {
        #gallery-preview-options { display: block; min-height: 44px; width: 100%; padding: 8px 12px; font: 16px sans-serif; color: #203249; background: #fff; border: 1px solid #8b9aab; text-align: left; }
        body > nav.controls[data-gallery-collapsed="true"] { display: block; padding: 2px 8px; }
        body > nav.controls[data-gallery-collapsed="true"] > :not(#status) { display: none; }
        body > nav.controls:not([data-gallery-collapsed="true"]) { padding: 8px; gap: 8px; }
        body > nav.controls select, body > nav.controls input { font-size: 16px; min-height: 44px; }
        body > nav.controls #print { display: none; }
        body > #invoice-root { padding-top: 12px; }
      }
      @media print { #gallery-preview-options { display: none !important; } }
    `;
    doc.head.append(style);
    toggle = doc.createElement('button');
    toggle.id = 'gallery-preview-options';
    toggle.type = 'button';
    nav.id = nav.id || 'gallery-preview-controls';
    toggle.setAttribute('aria-controls', nav.id);
    toggle.setAttribute('aria-expanded', 'false');
    nav.dataset.galleryCollapsed = 'true';
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(expanded));
      nav.dataset.galleryCollapsed = String(!expanded);
    });
    nav.before(toggle);
  }
  toggle.textContent = language === 'zh' ? '预览选项' : 'Preview options';
}
