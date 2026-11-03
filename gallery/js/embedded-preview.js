// Only known source chrome and paper ancestors receive screen-only overrides.
export function adaptEmbeddedPreview(doc, settings = false, width = 375) {
  const chrome = doc.querySelector('body > .toolbar, body > nav.controls');
  if (chrome && !chrome.closest('.printform_page, .physical_page_wrapper')) {
    chrome.dataset.galleryChrome = '';
    chrome.querySelector('#print')?.setAttribute('data-gallery-source-print', '');
  }
  for (const sheet of doc.querySelectorAll('.physical_page_wrapper, .printform_page')) {
    for (let parent = sheet.parentElement; parent && parent !== doc.body; parent = parent.parentElement) {
      parent.dataset.galleryPaperAncestor = '';
    }
  }
  doc.documentElement.dataset.galleryView = settings ? 'settings' : 'preview';
  doc.documentElement.style.setProperty('--gallery-settings-width', `${width}px`);
  if (doc.getElementById('gallery-viewer-screen')) return;
  const style = doc.createElement('style');
  style.id = 'gallery-viewer-screen';
  style.textContent = `@media screen {
    html[data-gallery-view="preview"], html[data-gallery-view="preview"] body { overflow: hidden !important; }
    [data-gallery-view="preview"] [data-gallery-chrome] { display: none !important; }
    [data-gallery-view="preview"] [data-gallery-paper-ancestor] { overflow: visible !important; }
    [data-gallery-view] [data-gallery-chrome] { box-sizing: border-box; width: var(--gallery-settings-width); max-width: var(--gallery-settings-width); margin: 0; padding: 12px; }
    [data-gallery-view] [data-gallery-chrome] input,
    [data-gallery-view] [data-gallery-chrome] select,
    [data-gallery-view] [data-gallery-chrome] button { min-height: 44px; max-width: 100%; font-size: 16px; }
    [data-gallery-view] [data-gallery-chrome] select { height: 44px; }
    [data-gallery-view] [data-gallery-source-print] { display: none !important; }
  }`;
  doc.head.append(style);
}

export function sourceState(frame) {
  const win = frame.contentWindow, doc = frame.contentDocument;
  const failed = doc.body?.dataset.state === 'error' || win.SCHOOL_ERROR || doc.querySelector('#status[role="alert"]');
  if (failed) return 'previewError';
  const flags = ['SCHOOL_READY', 'ASTER_READY', 'ATLAS_READY', 'LUMEN_READY', 'MERIDIAN_READY'];
  const blocked = flags.some(key => typeof win[key] === 'boolean' && !win[key]);
  const state = doc.body?.dataset.state;
  return win.__printFormProcessed === true && !blocked && !doc.querySelector('#print')?.disabled &&
    (!state || state === 'ready') ? '' : 'previewLoading';
}
