import { adaptEmbeddedPreview } from './embedded-preview.js';

const labels = {
  en: ['Preview', 'Settings', 'Fit width', 'Zoom out', 'Zoom in', 'Zoom percentage', 'Previous page', 'Next page', 'Page', 'Document viewport', 'Settings change the source layout; zoom only changes the view.'],
  zh: ['预览', '设置', '适合宽度', '缩小', '放大', '缩放百分比', '上一页', '下一页', '页码', '文档阅读区', '设置会重新排版源文档；缩放只改变阅读比例。']
};

export function createDocumentViewer(dialog) {
  const viewport = dialog.querySelector('.frame-wrap');
  viewport.classList.add('document-viewport');
  viewport.tabIndex = 0;
  const stage = document.createElement('div');
  stage.className = 'viewer-stage';
  viewport.append(stage);
  stage.append(viewport.querySelector('iframe'));
  const bar = document.createElement('div');
  bar.className = 'viewer-controls';
  bar.innerHTML = `<div class="viewer-modes"><button type="button" data-settings aria-expanded="false"></button><button type="button" data-read></button><button type="button" data-preview></button></div>
    <div class="viewer-tools"><button type="button" data-out>−</button>
    <label class="viewer-zoom"><input data-zoom type="number" max="200" step="any" value="100"><span class="viewer-zoom-unit" aria-hidden="true">%</span></label><button type="button" data-in>+</button>
    <div class="viewer-presets"><button type="button" data-presets aria-expanded="false" aria-controls="viewer-preset-menu">▾</button>
    <div id="viewer-preset-menu" class="viewer-preset-menu" hidden><button type="button" data-fit></button><button type="button" data-preset="1">100%</button><button type="button" data-preset="1.5">150%</button><button type="button" data-preset="2">200%</button></div></div></div>
    <div class="viewer-pages"><button type="button" data-prev>‹</button><label class="viewer-page"><input data-page type="number" min="1" value="1"><span class="viewer-page-total" data-page-total>/ 0</span></label><button type="button" data-next>›</button></div>`;
  viewport.before(bar);
  const hint = document.createElement('p');
  hint.className = 'viewer-hint';
  hint.hidden = true;
  viewport.before(hint);
  const readingHint = document.createElement('p');
  readingHint.className = 'viewer-reading-hint';
  readingHint.hidden = true;
  viewport.before(readingHint);
  const query = selector => bar.querySelector(selector);
  let frame, sheets = [], bounds, scale = 1, fit = true, settings = false, page = 0;
  let observer, resize, scheduled, requested, hintTimer;
  function closePresets(restoreFocus = false) {
    query('.viewer-preset-menu').hidden = true;
    query('[data-presets]').setAttribute('aria-expanded', 'false');
    if (restoreFocus) query('[data-presets]').focus();
  }
  function menuEscape(event) {
    if (event.key === 'Escape' && !query('.viewer-preset-menu').hidden) {
      event.preventDefault(); event.stopImmediatePropagation(); closePresets(true);
    }
  }
  dialog.addEventListener('keydown', menuEscape, true);
  dialog.addEventListener('close', () => { if (!dialog.open) closePresets(); });
  document.addEventListener('pointerdown', event => {
    if (!query('.viewer-presets').contains(event.target)) closePresets();
  }, true);
  const current = () => {
    if (!bounds || settings) return;
    const y = viewport.scrollTop / scale + bounds.top + 2;
    const atEnd = viewport.scrollTop > 0 && viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 1;
    // A requested sheet can share the clamped scroll position with other sheets.
    // Keep that intent across scroll events/redraws, but not a real position change.
    if (requested && Math.abs(viewport.scrollTop - requested.top) > 1) requested = null;
    page = requested ? requested.index : atEnd ? sheets.length - 1 : Math.max(0, sheets.findLastIndex(rect => rect.top <= y));
    // Layout/font observers may run while a page jump is still being edited.
    const input = query('[data-page]');
    if (document.activeElement !== input) input.value = page + 1;
    query('[data-prev]').disabled = page === 0;
    query('[data-next]').disabled = page >= sheets.length - 1;
  };
  function draw() {
    if (!frame || !bounds) return;
    if (fit) scale = Math.min(1, viewport.clientWidth / bounds.width);
    const doc = frame.contentDocument;
    adaptEmbeddedPreview(doc, settings, viewport.clientWidth);
    viewport.classList.toggle('is-settings', settings);
    hint.hidden = !settings;
    query('[data-settings]').setAttribute('aria-expanded', String(settings));
    query('[data-preview]').setAttribute('aria-pressed', String(!settings));
    query('[data-preview]').hidden = !settings;
    query('[data-read]').hidden = settings;
    query('.viewer-tools').hidden = settings;
    query('.viewer-pages').hidden = settings || sheets.length <= 1;
    bar.classList.toggle('is-single-page', sheets.length <= 1);
    // Source context remains unscaled. Only its screen presentation is transformed.
    Object.assign(frame.style, {
      width: '1440px', height: `${settings ? viewport.clientHeight : Math.ceil(bounds.bottom + 8)}px`,
      transform: settings ? 'none' : `translate(${-bounds.left * scale}px, ${-bounds.top * scale}px) scale(${scale})`
    });
    Object.assign(stage.style, { width: `${settings ? viewport.clientWidth : bounds.width * scale}px`, height: `${settings ? viewport.clientHeight : bounds.height * scale}px` });
    // Observer redraws must not replace a zoom value still being edited.
    const zoomInput = query('[data-zoom]');
    if (document.activeElement !== zoomInput) zoomInput.value = Math.round(scale * 100);
    query('[data-out]').disabled = scale <= .5;
    query('[data-in]').disabled = scale >= 2;
    query('[data-page-total]').textContent = `/ ${sheets.length}`;
    query('[data-page]').max = sheets.length;
    current();
  }
  function measure() {
    if (!frame?.isConnected) return;
    const doc = frame.contentDocument;
    adaptEmbeddedPreview(doc, settings, viewport.clientWidth);
    const physical = [...doc.querySelectorAll('.physical_page_wrapper')];
    const nodes = physical.length ? physical : [...doc.querySelectorAll('.printform_page')];
    sheets = nodes.map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left + frame.contentWindow.scrollX, top: rect.top + frame.contentWindow.scrollY,
        right: rect.right + frame.contentWindow.scrollX, bottom: rect.bottom + frame.contentWindow.scrollY };
    }).filter(rect => rect.right > rect.left && rect.bottom > rect.top);
    if (!sheets.length) return;
    const left = Math.min(...sheets.map(rect => rect.left)), top = sheets[0].top;
    const right = Math.max(...sheets.map(rect => rect.right)), bottom = Math.max(...sheets.map(rect => rect.bottom));
    bounds = { left, top, right, bottom, width: right - left, height: bottom - top };
    draw();
  }
  const schedule = () => {
    cancelAnimationFrame(scheduled);
    scheduled = requestAnimationFrame(measure);
  };
  function go(value) {
    if (!sheets.length) return;
    if (!Number.isInteger(value) || value < 1 || value > sheets.length) {
      query('[data-page]').value = page + 1;
      return;
    }
    const index = Math.min(sheets.length - 1, Math.max(0, value - 1));
    viewport.scrollTop = (sheets[index].top - bounds.top) * scale;
    requested = { index, top: viewport.scrollTop };
    current();
  }
  function zoom(value) {
    if (!bounds) return;
    const y = viewport.scrollTop / scale, x = viewport.scrollLeft / scale;
    fit = false;
    scale = Math.min(2, Math.max(.5, Number.isFinite(value) ? value : .5));
    // Explicit commits normalize even while the input retains focus.
    query('[data-zoom]').value = Math.round(scale * 100);
    draw();
    viewport.scrollTo(x * scale, y * scale);
  }
  function mode(value) {
    readingHint.hidden = true;
    closePresets();
    settings = value;
    frame?.contentWindow.scrollTo(0, 0);
    measure();
    viewport.scrollTo(0, 0);
  }
  query('[data-settings]').addEventListener('click', () => mode(!settings));
  query('[data-preview]').addEventListener('click', () => { mode(false); viewport.focus({ preventScroll: true }); });
  query('[data-presets]').addEventListener('click', () => {
    const menu = query('.viewer-preset-menu');
    menu.hidden = !menu.hidden;
    query('[data-presets]').setAttribute('aria-expanded', String(!menu.hidden));
  });
  query('[data-fit]').addEventListener('click', () => { closePresets(true); readingHint.hidden = true; fit = true; draw(); viewport.scrollLeft = 0; });
  bar.querySelectorAll('[data-preset]').forEach(button => button.addEventListener('click', () => { closePresets(true); readingHint.hidden = true; zoom(Number(button.dataset.preset)); }));
  query('[data-read]').addEventListener('click', () => {
    closePresets(); zoom(1); readingHint.hidden = false; viewport.focus({ preventScroll: true });
    clearTimeout(hintTimer); hintTimer = setTimeout(() => { readingHint.hidden = true; }, 4000);
  });
  query('[data-out]').addEventListener('click', () => zoom(scale - .1));
  query('[data-in]').addEventListener('click', () => zoom(scale + .1));
  query('[data-zoom]').addEventListener('change', event => zoom(Number(event.target.value) / 100));
  query('[data-page]').addEventListener('change', event => go(Number(event.target.value)));
  query('[data-page]').addEventListener('blur', current);
  query('[data-prev]').addEventListener('click', () => go(page));
  query('[data-next]').addEventListener('click', () => go(page + 2));
  viewport.addEventListener('scroll', current);
  const trackScroll = () => { requested = null; current(); };
  viewport.addEventListener('wheel', trackScroll, { passive: true });
  viewport.addEventListener('touchmove', trackScroll, { passive: true });
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport || settings) return;
    if (['Home', 'End', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' '].includes(event.key)) trackScroll();
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      viewport.scrollLeft += event.key === 'ArrowRight' ? 40 : -40;
      event.preventDefault();
    }
    if (event.key === 'Home') { viewport.scrollTo(0, 0); event.preventDefault(); }
    if (event.key === 'End') { viewport.scrollTo(viewport.scrollWidth, viewport.scrollHeight); event.preventDefault(); }
  });
  const outerResize = new ResizeObserver(schedule);
  outerResize.observe(viewport);
  return {
    localize(language) {
      const words = labels[language] || labels.en;
      for (const [index, selector] of ['[data-preview]', '[data-settings]', '[data-fit]', '[data-out]', '[data-in]', '[data-zoom]', '[data-prev]', '[data-next]', '[data-page]'].entries()) {
        const node = query(selector);
        node.setAttribute('aria-label', words[index]);
        if (index === 0) node.textContent = language === 'zh' ? '返回预览' : 'Back to Preview';
        if (index === 1) node.textContent = '⚙';
        if (index === 2) node.textContent = words[index];
      }
      viewport.setAttribute('aria-label', words[9]);
      hint.textContent = words[10];
      query('[data-read]').textContent = language === 'zh' ? '阅读' : 'Read';
      query('[data-read]').setAttribute('aria-label', language === 'zh' ? '放大阅读' : 'Read');
      query('[data-preview]').setAttribute('aria-label', language === 'zh' ? '返回预览' : 'Back to Preview');
      query('[data-presets]').setAttribute('aria-label', language === 'zh' ? '缩放预设' : 'Zoom Presets');
      readingHint.textContent = language === 'zh' ? '平移和滚动以阅读' : 'Pan and scroll to read';
    },
    reset() {
      observer?.disconnect(); resize?.disconnect(); cancelAnimationFrame(scheduled); clearTimeout(hintTimer); closePresets();
      frame = null; bounds = null; sheets = []; fit = true; settings = false; page = 0; requested = null;
      stage.removeAttribute('style'); viewport.scrollTo(0, 0);
      viewport.classList.remove('is-settings');
      bar.classList.remove('is-single-page');
      query('[data-settings]').setAttribute('aria-expanded', 'false');
      query('[data-preview]').setAttribute('aria-pressed', 'true');
      query('[data-preview]').hidden = true;
      query('[data-read]').hidden = false;
      query('[data-page-total]').textContent = '/ 0';
      query('[data-page]').value = '1';
      query('.viewer-pages').hidden = true;
      hint.hidden = true; readingHint.hidden = true; query('.viewer-tools').hidden = false;
    },
    bind(candidate) {
      frame = candidate;
      const source = candidate.contentDocument;
      source.addEventListener('keydown', event => {
        if (dialog.open && frame === candidate && candidate.contentDocument === source) menuEscape(event);
      }, true);
      source.addEventListener('pointerdown', () => {
        if (frame === candidate && candidate.contentDocument === source) closePresets();
      }, true);
      frame.style.width = '1440px';
      observer = new MutationObserver(schedule);
      observer.observe(frame.contentDocument.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state', 'disabled'] });
      resize = new ResizeObserver(schedule);
      resize.observe(frame.contentDocument.body);
      measure();
      frame.contentDocument.fonts.ready.then(() => { if (frame === candidate) schedule(); });
    },
    refresh: measure
  };
}
