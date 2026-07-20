/*
 * PrintForm Studio — Phase 1 (Config Playground)
 *
 * Data flow:
 *   config-reference.json → config panel (fully generated, zero hardcoding)
 *   templates.json        → template picker
 *   template HTML + config → synthesized HTML → blob URL → iframe reload
 *   bridge.js (inside iframe) → postMessage → inspector
 *
 * The exported HTML is byte-identical to what the preview renders.
 */
(function () {
  "use strict";

  // ---------- i18n ----------
  var I18N = {
    zh: {
      compare: "对比模式",
      panelConfig: "配置",
      panelInspector: "检查器",
      printPreview: "打印预览",
      export: "导出 HTML",
      search: "搜索配置项…",
      inspector: "检查器",
      logicalPages: "逻辑页",
      physicalPages: "物理页",
      copyConfig: "复制配置 JSON",
      resetAll: "全部重置",
      resetCurrentSide: "重置当前侧",
      logs: "分页日志",
      printHint: "Studio 预览用于快速迭代;最终效果请以浏览器打印预览为准。",
      copyAB: "复制 A→B",
      loading: "加载中…",
      pages: "页",
      blocks: "个区块",
      copied: "已复制",
      resetConfirm: "重置当前侧所有配置修改?",
      import: "导入 HTML",
      modeStructure: "结构编辑",
      modePreview: "返回预览",
      rowCount: "行数",
      apply: "应用",
      duplicate: "复制",
      delete: "删除",
      clickBlockHint: "点击预览中的任一区块进行编辑;仅 .prowitem 支持复制/删除。",
      dataBinding: "数据绑定",
      dataEmptyHint: "此模板不含 {{占位符}},无需绑定数据。可在结构编辑模式下手动添加 {{field}} 或 {{#items}}...{{/items}}。",
      regenerateData: "重新生成示例数据",
      exportPackage: "导出数据绑定包",
      regenerateConfirm: "用新的示例数据骨架覆盖当前 JSON?",
      moreMenu: "更多选项",
      printformNotInlined: "printform.js 尚未内联 —— 此导出文件只有留在本仓库目录内打开才能正常运行,移到别处会报脚本 404。请稍候几秒后重新导出。",
      restoredNotice: "已恢复上次会话的配置修改(A 侧 {a} 项、B 侧 {b} 项),下方面板可能不是模板默认值。",
      cancel: "取消",
      ok: "确定",
      popupBlocked: "打印预览被浏览器拦截了 —— 请在地址栏允许本站弹出窗口,然后重试。"
    },
    en: {
      compare: "Compare",
      panelConfig: "Config",
      panelInspector: "Inspector",
      printPreview: "Print Preview",
      export: "Export HTML",
      search: "Search config…",
      inspector: "Inspector",
      logicalPages: "Logical pages",
      physicalPages: "Physical pages",
      copyConfig: "Copy config JSON",
      resetAll: "Reset all",
      resetCurrentSide: "Reset current side",
      logs: "Pagination log",
      printHint: "Studio preview is for fast iteration; verify final output with the browser's print preview.",
      copyAB: "Copy A→B",
      loading: "Loading…",
      pages: "pages",
      blocks: "blocks",
      copied: "Copied",
      resetConfirm: "Reset all config changes on the current side?",
      import: "Import HTML",
      modeStructure: "Edit Blocks",
      modePreview: "Back to Preview",
      rowCount: "Rows",
      apply: "Apply",
      duplicate: "Duplicate",
      delete: "Delete",
      clickBlockHint: "Click any block in the preview to edit it; only .prowitem supports duplicate/delete.",
      dataBinding: "Data Binding",
      dataEmptyHint: "This template has no {{placeholders}}. Add {{field}} or {{#items}}...{{/items}} via Structure mode to enable data binding.",
      regenerateData: "Regenerate sample data",
      exportPackage: "Export data-bound package",
      regenerateConfirm: "Overwrite the current JSON with a fresh sample skeleton?",
      moreMenu: "More options",
      printformNotInlined: "printform.js isn't inlined yet — this export will only run while it stays inside this repo folder; moving it elsewhere will 404. Wait a few seconds and export again.",
      restoredNotice: "Restored config changes from your last session (side A: {a}, side B: {b}) — the panel below may not match the template's defaults.",
      cancel: "Cancel",
      ok: "OK",
      popupBlocked: "The browser blocked the print preview popup — allow popups for this site in the address bar, then try again."
    }
  };

  var BLOCK_TYPES = [
    "pheader", "pdocinfo", "pdocinfo002", "pdocinfo003", "pdocinfo004", "pdocinfo005",
    "prowheader", "prowitem", "ptac", "paddt",
    "pfooter", "pfooter002", "pfooter003", "pfooter004", "pfooter005",
    "pfooter_logo", "pfooter_pagenum"
  ];

  function classify(el) {
    var classes = (el.className || "").toString().split(/\s+/);
    for (var i = 0; i < BLOCK_TYPES.length; i += 1) {
      if (classes.indexOf(BLOCK_TYPES[i]) !== -1) return BLOCK_TYPES[i];
    }
    return el.tagName ? el.tagName.toLowerCase() : "unknown";
  }

  // ---------- state ----------
  var state = {
    lang: localStorage.getItem("pfstudio.lang") || "zh",
    templateId: localStorage.getItem("pfstudio.template") || null,
    compare: localStorage.getItem("pfstudio.compare") === "1",
    activeSide: "A",
    // overrides: htmlAttr → string value, per side
    overrides: { A: {}, B: {} },
    descriptors: [],       // flattened main + paddt descriptors
    templates: [],
    templateHtml: null,    // pristine fetched/imported HTML (Phase-2 edits never touch this)
    workingHtml: null,     // templateHtml + Phase-2 block edits — what preview/export render from
    templateBaseline: {},  // data-* attrs actually present on the template's .printform
    metrics: { A: null, B: null },
    viewMode: "preview",   // "preview" | "structure"
    selectedBlockIndex: null,
    selectedBlockSide: null,
    blockCount: 0,
    rowCount: 0,
    sampleData: {},        // JSON data bound to {{ }} placeholders (Phase 3)
    mustacheLiteSource: null, // cached source text of mustache-lite.js, for package export
    printformSource: null   // cached source text of the current template's printform.js, for export inlining
  };

  try {
    var saved = JSON.parse(localStorage.getItem("pfstudio.overrides") || "null");
    if (saved && saved.A && saved.B) state.overrides = saved;
  } catch (e) { /* corrupted storage — start fresh */ }

  function persist() {
    localStorage.setItem("pfstudio.lang", state.lang);
    localStorage.setItem("pfstudio.compare", state.compare ? "1" : "0");
    if (state.templateId) localStorage.setItem("pfstudio.template", state.templateId);
    localStorage.setItem("pfstudio.overrides", JSON.stringify(state.overrides));
  }

  function t(key) { return (I18N[state.lang] && I18N[state.lang][key]) || key; }

  // ---------- dom helpers ----------
  function $(sel) { return document.querySelector(sel); }

  function applyI18n() {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
    });
    $("#lang-toggle").textContent = state.lang === "zh" ? "EN" : "中文";
    document.documentElement.lang = state.lang;
  }

  // ---------- config panel ----------
  function descLabel(d) {
    return state.lang === "en" && d.descriptionEn ? d.descriptionEn : d.description;
  }
  function catLabel(d) {
    return state.lang === "en" && d.categoryEn ? d.categoryEn : d.category;
  }

  function currentOverrides() { return state.overrides[state.activeSide]; }

  function defaultAsString(d) {
    var v = d.defaultValue;
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "y" : "n";
    return String(v);
  }

  // The panel's resting state must reflect what the template actually declares,
  // not the library defaults — templates routinely override defaults inline.
  function baselineValue(d) {
    if (Object.prototype.hasOwnProperty.call(state.templateBaseline, d.htmlAttr)) {
      return state.templateBaseline[d.htmlAttr];
    }
    return defaultAsString(d);
  }

  function effectiveValue(d) {
    var o = currentOverrides();
    if (Object.prototype.hasOwnProperty.call(o, d.htmlAttr)) return o[d.htmlAttr];
    return baselineValue(d);
  }

  function isChanged(d) {
    return Object.prototype.hasOwnProperty.call(currentOverrides(), d.htmlAttr);
  }

  function setOverride(d, value) {
    var o = currentOverrides();
    if (value === baselineValue(d)) {
      delete o[d.htmlAttr];
    } else {
      o[d.htmlAttr] = value;
    }

    var touchedSiblings = clearConflictingPaperSizeFields(d, value);

    persist();
    scheduleReload(state.activeSide);
    if (touchedSiblings) {
      buildConfigPanel();
    } else {
      refreshItemState(d);
    }
  }

  // papersize-width/height and the paper-size preset are mutually exclusive
  // in the library — explicit pixel dimensions always win over the preset
  // (see the manualWidthProvided/manualHeightProvided check in
  // src/printform/config.js, which treats ANY non-empty width/height —
  // including ones baked straight into the template's own HTML — as
  // "manually provided" and skips the preset entirely). Every built-in
  // template hard-codes papersize-width/height, so picking "A4" from the
  // config panel was a complete, silent no-op: nothing in the UI explained
  // why the page never changed size. Whichever field the user just touched
  // wins; the other is cleared back to auto/empty so it can't block it.
  function clearConflictingPaperSizeFields(d, value) {
    if (value === "") return false; // clearing back to baseline never conflicts
    var o = currentOverrides();
    var touched = false;
    function clearField(htmlAttr) {
      var fd = state.descriptors.find(function (x) { return x.htmlAttr === htmlAttr; });
      if (!fd) return;
      if (baselineValue(fd) === "") {
        if (Object.prototype.hasOwnProperty.call(o, htmlAttr)) {
          delete o[htmlAttr];
          touched = true;
        }
      } else if (o[htmlAttr] !== "") {
        o[htmlAttr] = "";
        touched = true;
      }
    }
    if (d.htmlAttr === "data-paper-size") {
      clearField("data-papersize-width");
      clearField("data-papersize-height");
    } else if (d.htmlAttr === "data-papersize-width" || d.htmlAttr === "data-papersize-height") {
      clearField("data-paper-size");
    }
    return touched;
  }

  function refreshItemState(d) {
    var item = document.querySelector('[data-attr="' + d.htmlAttr + '"]');
    if (item) item.classList.toggle("changed", isChanged(d));
  }

  var BOOL_TOKENS = { y: true, yes: true, true: true, 1: true, n: false, no: false, false: false, 0: false };

  function isBooleanDescriptor(d) {
    if (typeof d.defaultValue === "boolean") return true;
    var s = String(d.defaultValue).toLowerCase();
    return d.type === "Boolean" || s === "y" || s === "n" || s === "yes" || s === "no";
  }

  function isMultilineDescriptor(d) {
    return /content/i.test(d.key);
  }

  function buildConfigPanel() {
    var host = $("#config-groups");
    host.innerHTML = "";
    var filter = ($("#config-search").value || "").toLowerCase();

    // group by (localized) category, preserving descriptor order
    var groups = [];
    var byCat = {};
    state.descriptors.forEach(function (d) {
      var cat = catLabel(d);
      var text = (d.htmlAttr + " " + descLabel(d)).toLowerCase();
      if (filter && text.indexOf(filter) === -1) return;
      if (!byCat[cat]) {
        byCat[cat] = [];
        groups.push(cat);
      }
      byCat[cat].push(d);
    });

    groups.forEach(function (cat) {
      var details = document.createElement("details");
      details.className = "config-group";
      details.open = Boolean(filter) || groups.length <= 2;
      var summary = document.createElement("summary");
      summary.innerHTML = "<span>" + cat + "</span> <span class='count'>(" + byCat[cat].length + ")</span>";
      details.appendChild(summary);
      byCat[cat].forEach(function (d) {
        details.appendChild(buildConfigItem(d));
      });
      host.appendChild(details);
    });
  }

  function buildConfigItem(d) {
    var item = document.createElement("div");
    item.className = "config-item";
    item.setAttribute("data-attr", d.htmlAttr);
    if (isChanged(d)) item.classList.add("changed");

    var label = document.createElement("span");
    label.className = "label";
    label.textContent = d.htmlAttr.replace(/^data-/, "");
    label.title = d.htmlAttr + "\n" + descLabel(d) + "\n" + (state.lang === "zh" ? "模板值" : "template") + ": " + (baselineValue(d) || "(empty)");
    item.appendChild(label);

    var resetBtn = document.createElement("button");
    resetBtn.className = "reset-btn";
    resetBtn.textContent = "↺";
    resetBtn.title = "reset";
    resetBtn.addEventListener("click", function () {
      delete currentOverrides()[d.htmlAttr];
      persist();
      scheduleReload(state.activeSide);
      buildConfigPanel();
    });
    item.appendChild(resetBtn);

    var value = effectiveValue(d);

    if (isBooleanDescriptor(d)) {
      var sw = document.createElement("label");
      sw.className = "switch";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.checked = BOOL_TOKENS[String(value).toLowerCase()] === true;
      var track = document.createElement("span");
      track.className = "track";
      input.addEventListener("change", function () {
        setOverride(d, input.checked ? "y" : "n");
      });
      sw.appendChild(input);
      sw.appendChild(track);
      item.appendChild(sw);
    } else if (d.options) {
      var select = document.createElement("select");
      d.options.forEach(function (opt) {
        var o = document.createElement("option");
        o.value = opt;
        o.textContent = opt === "" ? "(auto)" : opt;
        select.appendChild(o);
      });
      select.value = value;
      select.addEventListener("change", function () { setOverride(d, select.value); });
      item.appendChild(select);
    } else if (isMultilineDescriptor(d)) {
      item.classList.add("multiline");
      var ta = document.createElement("textarea");
      ta.value = value;
      ta.spellcheck = false;
      var taTimer = null;
      ta.addEventListener("input", function () {
        clearTimeout(taTimer);
        taTimer = setTimeout(function () { setOverride(d, ta.value); }, 500);
      });
      item.appendChild(ta);
    } else if (d.type === "Number") {
      var num = document.createElement("input");
      num.type = "number";
      num.value = value;
      num.placeholder = baselineValue(d);
      num.addEventListener("change", function () { setOverride(d, num.value); });
      item.appendChild(num);
    } else {
      var txt = document.createElement("input");
      txt.type = "text";
      txt.value = value;
      txt.placeholder = baselineValue(d);
      txt.addEventListener("change", function () { setOverride(d, txt.value); });
      item.appendChild(txt);
    }

    return item;
  }

  // ---------- HTML synthesis ----------
  function escapeAttr(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Data binding (Phase 3): {{ }} tokens must be resolved on the RAW STRING,
  // before DOMParser ever sees the markup — parsing first and templating
  // second would let the parser reshuffle stray text nodes (e.g. inside
  // <table>) before mustache-lite gets a chance to see them as one block.
  function renderWithData(html) {
    if (!html || !window.MustacheLite || !window.MustacheLite.hasPlaceholders(html)) return html;
    try {
      var rendered = window.MustacheLite.render(html, state.sampleData || {});
      hideDataJsonError();
      return rendered;
    } catch (e) {
      showDataJsonError((state.lang === "zh" ? "渲染错误: " : "Render error: ") + (e && e.message ? e.message : e));
      return html;
    }
  }

  function showDataJsonError(message) {
    var el = $("#data-json-error");
    if (!el) return;
    el.textContent = message;
    el.style.display = "";
  }

  function hideDataJsonError() {
    var el = $("#data-json-error");
    if (el) el.style.display = "none";
  }

  function findPrintformScriptTag(doc) {
    var scripts = Array.prototype.slice.call(doc.querySelectorAll("script[src]"));
    return scripts.find(function (s) {
      return /printform(\.min)?\.js(\?|$)/i.test(s.getAttribute("src") || "");
    }) || null;
  }

  // Replaces the template's <script src="…printform.js"> with the inlined
  // source text IN PLACE, so the exported file has no on-disk dependency once
  // the <base> tag (only valid inside this repo) is stripped for export.
  // Safe whenever the script's original document position already executes
  // before anything that needs window.PrintForm (true for a plain HTML
  // export, since it's the same load order the template already runs with).
  function inlinePrintformScript(doc) {
    if (!state.printformSource) return false;
    var target = findPrintformScriptTag(doc);
    if (!target) return false;
    target.removeAttribute("src");
    target.textContent = state.printformSource;
    return true;
  }

  // Same inlining, but REMOVES the script from its original spot and hands
  // it back so the caller can place it explicitly. synthesizePackageHtml's
  // bootstrap script calls window.PrintForm.formatAll() as soon as it runs —
  // if the printform.js tag were left in its original template position
  // (typically at the end of <body>, after where .printform used to sit),
  // it would still execute AFTER that call, and formatAll() would silently
  // no-op because window.PrintForm doesn't exist yet.
  function extractInlinedPrintformScript(doc) {
    if (!state.printformSource) return null;
    var target = findPrintformScriptTag(doc);
    if (!target) return null;
    target.remove();
    target.removeAttribute("src");
    target.textContent = state.printformSource;
    return target;
  }

  function synthesizeHtml(side, forExport) {
    var html = renderWithData(state.workingHtml);
    if (!html) return null;
    var overrides = state.overrides[side];

    // 1. Apply overrides onto the first .printform element via DOM parsing —
    //    regex on HTML is fragile; DOMParser keeps the rest byte-stable except
    //    where we serialize, so we only swap the .printform opening tag zone
    //    by re-serializing the whole document (acceptable: export equals preview).
    var doc = new DOMParser().parseFromString(html, "text/html");
    var forms = doc.querySelectorAll(".printform");
    forms.forEach(function (form) {
      Object.keys(overrides).forEach(function (attr) {
        form.setAttribute(attr, overrides[attr]);
      });
    });

    // 2. Resolve relative asset/script paths against the template's directory.
    var base = doc.createElement("base");
    base.setAttribute("href", state.templateBaseHref);
    var head = doc.querySelector("head");
    if (head) head.insertBefore(base, head.firstChild);

    // 3. Preview-only additions (never in export): side marker + bridge script.
    if (!forExport) {
      doc.documentElement.setAttribute("data-studio-side", side);
      doc.documentElement.setAttribute("data-studio-mode", "preview");
      var bridge = doc.createElement("script");
      bridge.setAttribute("src", new URL("./bridge.js", location.href).href);
      var body = doc.querySelector("body");
      if (body) body.insertBefore(bridge, body.firstChild);
    } else {
      // Export must be a self-contained file: inline printform.js (no on-disk
      // "dist/" folder travels with a download) and drop the <base> tag,
      // which only resolved correctly inside this repo's own folder layout.
      // If inlining fails — state.printformSource hasn't loaded yet, or an
      // imported template references its script by a path that doesn't
      // resolve under templateBaseHref — leave the <base> tag in place
      // rather than dropping it anyway: a base-relative export still works
      // when opened from inside this repo, whereas a bare relative src with
      // no base at all 404s unconditionally, everywhere, including here.
      var inlined = inlinePrintformScript(doc);
      if (inlined) {
        var b = doc.querySelector("head > base");
        if (b) b.remove();
      }
    }

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  // Structure view: same overrides applied for visual context, but the
  // printform.js script tag is stripped so pagination never runs — the raw
  // .pheader/.prowitem/... blocks stay on screen for the block editor to
  // click and edit.
  function synthesizeStructureHtml(side) {
    var html = renderWithData(state.workingHtml);
    if (!html) return null;
    var overrides = state.overrides[side];

    var doc = new DOMParser().parseFromString(html, "text/html");
    var forms = doc.querySelectorAll(".printform");
    forms.forEach(function (form) {
      Object.keys(overrides).forEach(function (attr) {
        form.setAttribute(attr, overrides[attr]);
      });
    });

    Array.prototype.slice.call(doc.querySelectorAll('script[src*="printform"]')).forEach(function (s) {
      s.remove();
    });

    var base = doc.createElement("base");
    base.setAttribute("href", state.templateBaseHref);
    var head = doc.querySelector("head");
    if (head) head.insertBefore(base, head.firstChild);

    doc.documentElement.setAttribute("data-studio-side", side);
    doc.documentElement.setAttribute("data-studio-mode", "structure");
    var bridge = doc.createElement("script");
    bridge.setAttribute("src", new URL("./bridge.js", location.href).href);
    var body = doc.querySelector("body");
    if (body) body.insertBefore(bridge, body.firstChild);

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  // Parses workingHtml, hands the .printform element + its direct children
  // to `mutator`, then re-serializes and reloads every preview. This is the
  // single write path for all Phase-2 block edits.
  function withWorkingDoc(mutator) {
    var doc = new DOMParser().parseFromString(state.workingHtml, "text/html");
    var form = doc.querySelector(".printform");
    if (!form) return;
    var children = Array.prototype.slice.call(form.children);
    mutator(doc, form, children);
    state.workingHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    reloadAll();
  }

  function applyBlockEdit(index, html) {
    withWorkingDoc(function (doc, form, children) {
      var target = children[index];
      if (!target) return;
      var wrapper = doc.createElement("div");
      wrapper.innerHTML = html;
      var replacement = wrapper.firstElementChild;
      if (replacement) target.replaceWith(replacement);
    });
  }

  function duplicateBlock(index) {
    withWorkingDoc(function (doc, form, children) {
      var target = children[index];
      if (!target) return;
      target.after(target.cloneNode(true));
    });
  }

  function deleteBlock(index) {
    withWorkingDoc(function (doc, form, children) {
      var target = children[index];
      if (!target) return;
      var rows = children.filter(function (c) { return classify(c) === "prowitem"; });
      if (classify(target) === "prowitem" && rows.length <= 1) return; // keep at least one row
      target.remove();
    });
  }

  function setRowCount(n) {
    withWorkingDoc(function (doc, form, children) {
      var rows = children.filter(function (c) { return classify(c) === "prowitem"; });
      if (!rows.length) return;
      var last = rows[rows.length - 1];
      while (rows.length < n) {
        var clone = last.cloneNode(true);
        last.after(clone);
        last = clone;
        rows.push(clone);
      }
      while (rows.length > n && rows.length > 1) {
        rows.pop().remove();
      }
    });
  }

  // ---------- data binding (Phase 3) ----------
  function buildSampleSkeleton(html) {
    if (!window.MustacheLite) return {};
    var scan = window.MustacheLite.scan(html);
    var data = {};
    scan.fields.forEach(function (name) {
      data[name] = (state.lang === "zh" ? "示例 " : "Sample ") + name;
    });
    scan.sections.forEach(function (section) {
      var rows = [];
      for (var i = 1; i <= 3; i += 1) {
        var row = {};
        section.fields.forEach(function (f) {
          if (/qty|count|num|quantity/i.test(f)) row[f] = i;
          else if (/price|amount|subtotal|total|cost/i.test(f)) row[f] = (i * 10).toFixed(2);
          else row[f] = f + " " + i;
        });
        rows.push(row);
      }
      data[section.name] = rows;
    });
    return data;
  }

  function initSampleDataForTemplate(html) {
    var hasPlaceholders = window.MustacheLite && window.MustacheLite.hasPlaceholders(html);
    var panel = $("#data-panel");
    var emptyHint = $("#data-empty-hint");
    var jsonArea = $("#data-json");
    var actions = $("#data-actions");

    hideDataJsonError();

    if (!hasPlaceholders) {
      state.sampleData = {};
      emptyHint.style.display = "";
      jsonArea.style.display = "none";
      actions.style.display = "none";
      panel.open = false;
      return;
    }

    emptyHint.style.display = "none";
    jsonArea.style.display = "";
    actions.style.display = "flex";
    panel.open = true;

    var saved = null;
    try {
      saved = JSON.parse(localStorage.getItem("pfstudio.data." + state.templateId) || "null");
    } catch (e) { /* corrupted storage — fall back to a fresh skeleton */ }

    state.sampleData = saved || buildSampleSkeleton(html);
    jsonArea.value = JSON.stringify(state.sampleData, null, 2);
  }

  // Package export: ships the RAW template (placeholders intact) inside a
  // <template> element — not a <script type="text/plain">, because <script>
  // is a raw-text element whose content ends at the first literal
  // "</script" sequence, which would corrupt arbitrary template HTML.
  // <template> content is parsed as normal DOM, so {{ }} tokens (which never
  // contain "<" or ">") round-trip through it untouched.
  function synthesizePackageHtml() {
    var html = state.workingHtml;
    if (!html) return null;
    var overrides = state.overrides[state.activeSide];

    var doc = new DOMParser().parseFromString(html, "text/html");
    var form = doc.querySelector(".printform");
    if (!form) return null;
    Object.keys(overrides).forEach(function (attr) { form.setAttribute(attr, overrides[attr]); });

    var rawOuterHtml = form.outerHTML;

    // Pull printform.js out of wherever the template originally put it (often
    // the end of <body>) so it can be re-inserted BEFORE the bootstrap script
    // below — that script calls window.PrintForm.formatAll() as soon as it
    // runs, so the library must already be loaded by then, not merely
    // "present somewhere later in the document."
    var printformScript = extractInlinedPrintformScript(doc);

    var mountDiv = doc.createElement("div");
    mountDiv.id = "printform-mount";
    form.replaceWith(mountDiv);

    var templateEl = doc.createElement("template");
    templateEl.id = "printform-raw-template";
    templateEl.innerHTML = rawOuterHtml;

    var mustacheScript = doc.createElement("script");
    mustacheScript.textContent = state.mustacheLiteSource || "";

    var sampleDataJson = JSON.stringify(state.sampleData || {}).replace(/<\/script/gi, "<\\/script");
    var bootstrapScript = doc.createElement("script");
    bootstrapScript.textContent = [
      "window.PrintFormTemplate = {",
      "  render: function (data) {",
      "    var raw = document.getElementById('printform-raw-template').innerHTML;",
      "    var rendered = window.MustacheLite.render(raw, data || {});",
      "    var mount = document.getElementById('printform-mount');",
      "    mount.innerHTML = rendered;",
      "    if (window.PrintForm && typeof window.PrintForm.formatAll === 'function') {",
      "      return window.PrintForm.formatAll({ force: true });",
      "    }",
      "    return Promise.resolve();",
      "  }",
      "};",
      "window.PrintFormTemplate.render(" + sampleDataJson + ");"
    ].join("\n");

    // Order matters: the library (PrintForm, MustacheLite) must be defined
    // before the bootstrap script that calls into it.
    if (printformScript) {
      mountDiv.after(templateEl, printformScript, mustacheScript, bootstrapScript);
    } else {
      // state.printformSource hasn't finished loading yet (rare — it's
      // fetched right after the template loads); ship without pagination
      // rather than silently mis-ordering scripts.
      mountDiv.after(templateEl, mustacheScript, bootstrapScript);
    }

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  function exportDataPackage() {
    warnIfPrintformNotInlined();
    var html = synthesizePackageHtml();
    if (html === null) return;
    var blob = new Blob([html], { type: "text/html" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.templateId + "-package.html";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  // ---------- preview ----------
  var reloadTimers = { A: null, B: null };
  var blobUrls = { A: null, B: null };

  function scheduleReload(side) {
    clearTimeout(reloadTimers[side]);
    reloadTimers[side] = setTimeout(function () { reload(side); }, 300);
  }

  function reload(side) {
    var html = state.viewMode === "structure" ? synthesizeStructureHtml(side) : synthesizeHtml(side, false);
    if (html === null) return;
    var frame = side === "A" ? $("#frame-a") : $("#frame-b");
    var status = side === "A" ? $("#status-a") : $("#status-b");
    status.textContent = t("loading");
    if (blobUrls[side]) URL.revokeObjectURL(blobUrls[side]);
    blobUrls[side] = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    frame.src = blobUrls[side];
    clearLogs(side);
    // Re-apply the last known scale immediately (avoids a flash of
    // full-size, overflowing content while the new page reformats); the
    // "done" bridge message refines it once the real height is known.
    applyPreviewScale(side);
  }

  function reloadAll() {
    reload("A");
    if (state.compare) reload("B");
  }

  // ---------- scale-to-fit preview ----------
  // The paper is a fixed-pixel-width document (750px etc. — configured, not
  // responsive), rendered inside an iframe whose CSS pixels don't shrink on
  // their own. Below the "Actual size" width, the only way to see the whole
  // page without horizontal scrolling is to visually scale it down, the way
  // every print-preview UI (browser print dialog, Google Docs, PDF.js) does.
  function getPaperWidthForSide(side) {
    var d = state.descriptors.find(function (x) { return x.htmlAttr === "data-papersize-width"; });
    var fallback = 750;
    if (!d) return fallback;
    var o = state.overrides[side];
    var raw;
    if (Object.prototype.hasOwnProperty.call(o, d.htmlAttr)) raw = o[d.htmlAttr];
    else if (Object.prototype.hasOwnProperty.call(state.templateBaseline, d.htmlAttr)) raw = state.templateBaseline[d.htmlAttr];
    else raw = d.defaultValue;
    var n = parseFloat(raw);
    return n > 0 ? n : fallback;
  }

  function applyPreviewScale(side) {
    var frame = side === "A" ? $("#frame-a") : $("#frame-b");
    var sizer = side === "A" ? $("#sizer-a") : $("#sizer-b");
    var viewport = side === "A" ? $("#viewport-a") : $("#viewport-b");
    var zoomEl = side === "A" ? $("#zoom-a") : $("#zoom-b");
    if (!frame || !sizer || !viewport) return;

    var naturalWidth = getPaperWidthForSide(side);
    var m = state.metrics[side];
    // Before the first "done" message, fall back to a plausible single-page
    // aspect ratio rather than 0 — a 0-height sizer would hide the iframe
    // entirely (0-height clip) during the reformat flash reload() guards.
    var naturalHeight = m && m.docHeight ? m.docHeight : naturalWidth * 1.4;

    var available = viewport.clientWidth - 32; // minus .preview-viewport padding
    var scale = available > 0 ? Math.min(1, available / naturalWidth) : 1;
    if (!isFinite(scale) || scale <= 0) scale = 1;

    frame.style.width = naturalWidth + "px";
    frame.style.height = naturalHeight + "px";
    frame.style.transform = "scale(" + scale + ")";
    sizer.style.width = Math.round(naturalWidth * scale) + "px";
    sizer.style.height = Math.round(naturalHeight * scale) + "px";
    if (zoomEl) zoomEl.textContent = Math.round(scale * 100) + "%";
  }

  function setupPreviewScaling() {
    ["A", "B"].forEach(function (side) {
      var viewport = side === "A" ? $("#viewport-a") : $("#viewport-b");
      if (!viewport || typeof ResizeObserver === "undefined") return;
      new ResizeObserver(function () { applyPreviewScale(side); }).observe(viewport);
    });
    // Belt-and-suspenders, same rationale as setupResponsiveTopbar: some
    // automated/embedded browser contexts don't reliably deliver
    // ResizeObserver callbacks. A plain window resize listener re-applies
    // scale directly so it never gets stuck at a stale percentage.
    window.addEventListener("resize", function () {
      applyPreviewScale("A");
      applyPreviewScale("B");
    });
  }

  // ---------- inspector ----------
  var logBuffers = { A: [], B: [] };

  function clearLogs(side) {
    logBuffers[side] = [];
    renderLogs();
  }

  function renderLogs() {
    var view = $("#log-view");
    var lines = [];
    var sides = state.compare ? ["A", "B"] : [state.activeSide === "B" ? "B" : "A"];
    sides.forEach(function (s) {
      logBuffers[s].forEach(function (entry) {
        var prefix = state.compare ? "[" + s + "] " : "";
        lines.push('<div class="' + entry.level + '">' + prefix + escapeAttr(entry.text) + "</div>");
      });
    });
    view.innerHTML = lines.join("");
    view.scrollTop = view.scrollHeight;
  }

  function renderMetrics() {
    var m = state.metrics[state.compare ? state.activeSide : "A"];
    $("#m-logical").textContent = m ? m.logicalPages : "–";
    $("#m-physical").textContent = m ? m.physicalPages : "–";
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "printform-studio-bridge") return;
    var side = data.side === "B" ? "B" : "A";
    if (data.type === "console") {
      logBuffers[side].push(data.payload);
      if (logBuffers[side].length > 500) logBuffers[side].shift();
      renderLogs();
    } else if (data.type === "done") {
      state.metrics[side] = data.payload;
      var status = side === "A" ? $("#status-a") : $("#status-b");
      status.textContent = data.payload.logicalPages + " " + t("pages");
      renderMetrics();
      applyPreviewScale(side);
    } else if (data.type === "blocks-ready") {
      state.blockCount = data.payload.count;
      state.rowCount = data.payload.rowCount;
      var range = $("#row-count-range");
      range.max = Math.max(10, state.rowCount + 20);
      range.value = state.rowCount;
      $("#row-count-value").textContent = state.rowCount;
      // Structure mode never sends "done" (no pagination runs), so the status
      // line and scale must be driven from this message instead — otherwise
      // it's stuck on whatever "N pages"/"Loading…" text preview mode left
      // behind, which reads as a hung/broken preview.
      var structStatus = side === "A" ? $("#status-a") : $("#status-b");
      structStatus.textContent = data.payload.count + " " + t("blocks");
      var structFrame = side === "A" ? $("#frame-a") : $("#frame-b");
      var structDoc = structFrame && structFrame.contentDocument;
      if (structDoc) {
        state.metrics[side] = state.metrics[side] || {};
        state.metrics[side].docHeight = structDoc.documentElement.scrollHeight;
      }
      applyPreviewScale(side);
    } else if (data.type === "block-select") {
      state.selectedBlockIndex = data.payload.index;
      state.selectedBlockSide = side;
      $("#be-selected").style.display = "";
      $("#be-type").textContent = data.payload.type;
      $("#be-html").value = data.payload.outerHTML;
      var isRow = data.payload.type === "prowitem";
      $("#be-duplicate").disabled = !isRow;
      $("#be-delete").disabled = !isRow;
    }
  });

  // ---------- actions ----------
  function setActiveSide(side) {
    state.activeSide = side;
    $("#side-a-btn").classList.toggle("active", side === "A");
    $("#side-b-btn").classList.toggle("active", side === "B");
    buildConfigPanel();
    renderMetrics();
    renderLogs();
  }

  function setCompare(on) {
    state.compare = on;
    $("#compare-toggle").classList.toggle("toggled", on);
    $("#slot-b").style.display = on ? "" : "none";
    $("#ab-selector").classList.toggle("visible", on);
    if (!on) setActiveSide("A");
    persist();
    if (on) reload("B");
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    $("#mode-toggle").textContent = t(mode === "structure" ? "modePreview" : "modeStructure");
    $("#mode-toggle").classList.toggle("toggled", mode === "structure");
    $("#block-editor").style.display = mode === "structure" ? "" : "none";
    state.selectedBlockIndex = null;
    $("#be-selected").style.display = "none";
    reloadAll();
  }

  function warnIfPrintformNotInlined() {
    if (state.printformSource) return;
    logBuffers[state.activeSide].push({ level: "warn", text: t("printformNotInlined") });
    renderLogs();
  }

  function exportHtml() {
    warnIfPrintformNotInlined();
    var html = synthesizeHtml(state.activeSide, true);
    if (html === null) return;
    var blob = new Blob([html], { type: "text/html" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = state.templateId + "-configured.html";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

  function openPrintPreview() {
    var html = synthesizeHtml(state.activeSide, false);
    if (html === null) return;
    var w = window.open("about:blank");
    if (!w) {
      // Popup blockers make window.open() return null/undefined instead of
      // throwing — silently doing nothing here reads as a dead button.
      logBuffers[state.activeSide].push({ level: "warn", text: t("popupBlocked") });
      renderLogs();
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  function copyConfigJson() {
    var o = currentOverrides();
    var json = JSON.stringify(o, null, 2);
    navigator.clipboard.writeText(json).then(function () {
      var btn = $("#copy-config");
      var original = btn.textContent;
      btn.textContent = t("copied");
      setTimeout(function () { btn.textContent = original; }, 1200);
    });
  }

  // window.confirm() blocks the page's JS thread — on some embedded/webview
  // contexts (observed firsthand: an in-app preview browser) the native
  // dialog never actually renders, so the block never lifts and the whole
  // app appears to hang with no way to recover short of a reload. This is a
  // plain DOM overlay instead: never blocks, resolves a Promise<boolean>.
  function showConfirm(message) {
    return new Promise(function (resolve) {
      var modal = $("#confirm-modal");
      var okBtn = $("#confirm-modal-ok");
      var cancelBtn = $("#confirm-modal-cancel");
      $("#confirm-modal-text").textContent = message;
      modal.style.display = "flex";

      function cleanup(result) {
        modal.style.display = "none";
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onBackdrop);
        document.removeEventListener("keydown", onKeydown);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onBackdrop(e) { if (e.target === modal) cleanup(false); }
      function onKeydown(e) { if (e.key === "Escape") cleanup(false); }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      modal.addEventListener("click", onBackdrop);
      document.addEventListener("keydown", onKeydown);
    });
  }

  function resetAll() {
    showConfirm(t("resetConfirm")).then(function (ok) {
      if (!ok) return;
      state.overrides[state.activeSide] = {};
      persist();
      buildConfigPanel();
      scheduleReload(state.activeSide);
    });
  }

  // localStorage restores state.overrides silently on every load (see the
  // top of the file) — a returning user gets that back deliberately, so the
  // config panel reflects their last session instead of resetting every
  // reload. But a FIRST-TIME-LOOKING visitor (or a returning one who forgot)
  // has no way to tell "this panel shows the template's real defaults" from
  // "this panel shows leftover edits from three sessions ago" — the panel
  // looks identical either way. Surface the difference once, non-blocking,
  // dismissible, with a one-click way to actually start fresh.
  function setupRestoreBanner() {
    var countA = Object.keys(state.overrides.A).length;
    var countB = Object.keys(state.overrides.B).length;
    if (countA + countB === 0) return;

    var banner = $("#restore-banner");
    var text = $("#restore-banner-text");
    text.textContent = t("restoredNotice").replace("{a}", countA).replace("{b}", countB);
    banner.style.display = "";

    $("#restore-banner-dismiss").addEventListener("click", function () {
      banner.style.display = "none";
    });
    $("#restore-banner-reset").addEventListener("click", function () {
      state.overrides = { A: {}, B: {} };
      persist();
      buildConfigPanel();
      reloadAll();
      banner.style.display = "none";
    });
  }

  // ---------- template loading ----------
  function parseBaseline(html) {
    // Read the template's own data-* declarations — they are the config
    // panel's resting baseline, not the library defaults.
    state.templateBaseline = {};
    var doc = new DOMParser().parseFromString(html, "text/html");
    var form = doc.querySelector(".printform");
    if (form) {
      Array.prototype.forEach.call(form.attributes, function (attr) {
        if (attr.name.indexOf("data-") === 0) {
          state.templateBaseline[attr.name] = attr.value;
        }
      });
    }
  }

  // Finds the template's own <script src="…printform(.min).js"> tag, resolves
  // it against templateBaseHref, and caches the fetched source text so export
  // can inline it — a downloaded file has no "../../dist/" folder next to it,
  // so shipping it as a src reference would 404 the moment it leaves this repo.
  function loadPrintformSource(html) {
    state.printformSource = null;
    var doc = new DOMParser().parseFromString(html, "text/html");
    var scripts = Array.prototype.slice.call(doc.querySelectorAll("script[src]"));
    var target = scripts.find(function (s) {
      return /printform(\.min)?\.js(\?|$)/i.test(s.getAttribute("src") || "");
    });
    if (!target) return;
    var url = new URL(target.getAttribute("src"), state.templateBaseHref).href;
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("fetch " + r.status);
        return r.text();
      })
      .then(function (src) { state.printformSource = src; })
      .catch(function () { /* export falls back to a src reference if inlining fails */ });
  }

  function loadTemplate(id) {
    var tpl = state.templates.find(function (x) { return x.id === id; });
    if (!tpl) return Promise.reject(new Error("unknown template: " + id));
    state.templateId = id;
    persist();

    var htmlPromise;
    if (tpl.html !== undefined) {
      // Imported file: no known folder, assume it was exported from the repo
      // root (matching how every built-in template resolves ./dist, ./img).
      state.templateBaseHref = new URL("../", location.href).href;
      htmlPromise = Promise.resolve(tpl.html);
    } else {
      var url = new URL(tpl.path, location.href);
      state.templateBaseHref = new URL("./", url).href;
      htmlPromise = fetch(url).then(function (r) {
        if (!r.ok) throw new Error("fetch " + r.status);
        return r.text();
      });
    }

    return htmlPromise.then(function (html) {
      state.templateHtml = html;
      state.workingHtml = html;
      parseBaseline(html);
      initSampleDataForTemplate(html);
      buildConfigPanel();
      reloadAll();
      loadPrintformSource(html);
    });
  }

  function importTemplateFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var html = String(reader.result || "");
      var id = "imported:" + Date.now();
      state.templates.push({ id: id, html: html, name: { zh: "📥 " + file.name, en: "📥 " + file.name } });
      buildTemplatePicker();
      $("#template-select").value = id;
      loadTemplate(id);
    };
    reader.readAsText(file);
  }

  function buildTemplatePicker() {
    var sel = $("#template-select");
    sel.innerHTML = "";
    state.templates.forEach(function (tpl) {
      var o = document.createElement("option");
      o.value = tpl.id;
      o.textContent = tpl.name[state.lang] || tpl.name.zh;
      sel.appendChild(o);
    });
    sel.value = state.templateId;
  }

  // ---------- responsive topbar (mobile "more" menu) ----------
  // When the topbar's content would overflow its own width, secondary
  // buttons move into #more-menu. These are the SAME DOM nodes (moved via
  // append/before), never copies — that way toggled state and translated
  // label text stay correct no matter which container currently holds
  // them, with nothing to keep in sync by hand.
  var SECONDARY_BUTTON_IDS = [
    "import-html", "compare-toggle", "mode-toggle",
    "toggle-config", "toggle-inspector", "lang-toggle", "print-preview"
  ];

  function setupResponsiveTopbar() {
    var topbar = $("#topbar");
    var moreMenu = $("#more-menu");
    var moreToggle = $("#more-menu-toggle");
    var spacer = topbar.querySelector(".spacer");

    function closeMenu() {
      moreMenu.classList.remove("open");
      moreToggle.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      // position:fixed, so this must be computed fresh from the toggle
      // button's live screen position every time — it's viewport-relative,
      // not relative to any scrolled/clipped ancestor.
      var rect = moreToggle.getBoundingClientRect();
      moreMenu.style.top = (rect.bottom + 6) + "px";
      moreMenu.style.right = (window.innerWidth - rect.right) + "px";
      moreMenu.style.left = "auto";
      moreMenu.classList.add("open");
      moreToggle.setAttribute("aria-expanded", "true");
    }

    function applyLayout(isCompact) {
      topbar.classList.toggle("compact", isCompact);
      if (isCompact) {
        moreMenu.append.apply(moreMenu, SECONDARY_BUTTON_IDS.map(function (id) { return $("#" + id); }));
      } else {
        closeMenu();
        // import-html / compare-toggle / mode-toggle sit before the spacer;
        // the rest sit after it, right before Export HTML.
        spacer.before($("#import-html"), $("#compare-toggle"), $("#mode-toggle"));
        $("#export-html").before($("#toggle-config"), $("#toggle-inspector"), $("#lang-toggle"), $("#print-preview"));
      }
    }

    moreToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      if (moreMenu.classList.contains("open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    moreMenu.addEventListener("click", function (e) {
      if (e.target.closest("button")) closeMenu();
    });

    document.addEventListener("click", function (e) {
      if (!$("#more-menu-wrap").contains(e.target)) closeMenu();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    // Whether the topbar needs to go compact is a function of its actual
    // content width, not the viewport — a fixed px breakpoint (the previous
    // approach) mismatches reality both ways: a long template name or the
    // longer English button labels can overflow well above any reasonable
    // breakpoint, while a short name in a narrow-but-not-tiny window fits
    // fine below one. Force-expand, measure real overflow, then commit the
    // layout that's actually correct for the content currently on screen.
    function checkFit() {
      applyLayout(false);
      var isOverflowing = topbar.scrollWidth > topbar.clientWidth + 1;
      if (isOverflowing) applyLayout(true);
    }

    checkFit();
    window.addEventListener("resize", checkFit);
    // Belt-and-suspenders: some environments resize the viewport without
    // firing resize reliably either (seen with a few automated/embedded
    // browser contexts) — a ResizeObserver on the topbar itself catches
    // container-width changes resize sometimes misses.
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(checkFit).observe(topbar);
    }
    window.addEventListener("resize", closeMenu);

    return checkFit;
  }

  // Below PANEL_QUERY's width, #config-pane and #inspector-pane switch (via
  // CSS, see the matching @media block) from permanent 240px/220px columns
  // to full-screen overlays inside #main — three fixed-width columns don't
  // fit on a phone, and squeezing them together left preview-pane a sliver.
  // Both start hidden on mobile so the preview is what a phone visitor sees
  // first; toggle-config/toggle-inspector (already in the topbar's ⋯ menu at
  // this width) and each pane's own close (×) button open/close them.
  var PANEL_QUERY = "(max-width: 900px)";

  function setupMobilePanels() {
    var mql = window.matchMedia(PANEL_QUERY);

    function closeConfig() { document.body.classList.add("hide-config"); }
    function closeInspector() { document.body.classList.add("hide-inspector"); }

    $("#close-config").addEventListener("click", closeConfig);
    $("#close-inspector").addEventListener("click", closeInspector);

    function applyDefault(isMobile) {
      if (isMobile) {
        // Force both closed — never enter the squeezed 3-column state,
        // whether this is the initial mobile load or a mid-session resize
        // down from desktop with panels already open.
        closeConfig();
        closeInspector();
      }
      // Becoming desktop again intentionally leaves hide-config/hide-inspector
      // untouched — don't fight whatever the user had open there.
    }

    applyDefault(mql.matches);
    mql.addEventListener("change", function (e) { applyDefault(e.matches); });
    // Same belt-and-suspenders reasoning as setupResponsiveTopbar.
    window.addEventListener("resize", function () { applyDefault(mql.matches); });
  }

  // ---------- boot ----------
  var checkTopbarFit = null;

  function boot() {
    applyI18n();
    checkTopbarFit = setupResponsiveTopbar();
    setupMobilePanels();
    setupPreviewScaling();
    setupRestoreBanner();

    fetch("./mustache-lite.js")
      .then(function (r) { return r.text(); })
      .then(function (src) { state.mustacheLiteSource = src; })
      .catch(function () { /* package export unavailable without it; regular preview still works */ });

    Promise.all([
      fetch("../docs/config-reference.json").then(function (r) { return r.json(); }),
      fetch("./templates.json").then(function (r) { return r.json(); })
    ]).then(function (results) {
      var configRef = results[0];
      state.descriptors = (configRef.mainConfig || []).concat(configRef.paddtConfig || []);
      state.templates = results[1].templates || [];

      if (!state.templateId || !state.templates.some(function (x) { return x.id === state.templateId; })) {
        state.templateId = state.templates[0] && state.templates[0].id;
      }

      buildTemplatePicker();
      buildConfigPanel();
      if (state.compare) setCompare(true);
      return loadTemplate(state.templateId);
    }).catch(function (err) {
      $("#log-view").innerHTML = '<div class="error">boot failed: ' + escapeAttr(err.message) + "</div>";
    });

    // topbar events
    $("#template-select").addEventListener("change", function (e) { loadTemplate(e.target.value); });
    $("#lang-toggle").addEventListener("click", function () {
      state.lang = state.lang === "zh" ? "en" : "zh";
      persist();
      applyI18n();
      buildTemplatePicker();
      buildConfigPanel();
      ["A", "B"].forEach(function (side) {
        var m = state.metrics[side];
        if (m) {
          var status = side === "A" ? $("#status-a") : $("#status-b");
          status.textContent = m.logicalPages + " " + t("pages");
        }
      });
      $("#mode-toggle").textContent = t(state.viewMode === "structure" ? "modePreview" : "modeStructure");
      // English/Chinese button labels differ in length enough to flip
      // whether the topbar fits — re-measure now that applyI18n() swapped
      // every label's text.
      if (checkTopbarFit) checkTopbarFit();
      var restoreBanner = $("#restore-banner");
      if (restoreBanner.style.display !== "none") {
        var countA = Object.keys(state.overrides.A).length;
        var countB = Object.keys(state.overrides.B).length;
        $("#restore-banner-text").textContent = t("restoredNotice").replace("{a}", countA).replace("{b}", countB);
      }
    });
    $("#compare-toggle").addEventListener("click", function () { setCompare(!state.compare); });
    $("#mode-toggle").addEventListener("click", function () {
      setViewMode(state.viewMode === "structure" ? "preview" : "structure");
    });
    $("#toggle-config").addEventListener("click", function () { document.body.classList.toggle("hide-config"); });
    $("#toggle-inspector").addEventListener("click", function () { document.body.classList.toggle("hide-inspector"); });
    $("#export-html").addEventListener("click", exportHtml);
    $("#print-preview").addEventListener("click", openPrintPreview);
    $("#import-html").addEventListener("click", function () { $("#import-file-input").click(); });
    $("#import-file-input").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) importTemplateFile(file);
      e.target.value = "";
    });

    // config pane events
    $("#config-search").addEventListener("input", buildConfigPanel);
    $("#side-a-btn").addEventListener("click", function () { setActiveSide("A"); });
    $("#side-b-btn").addEventListener("click", function () { setActiveSide("B"); });
    $("#copy-a-to-b").addEventListener("click", function () {
      state.overrides.B = JSON.parse(JSON.stringify(state.overrides.A));
      persist();
      if (state.activeSide === "B") buildConfigPanel();
      reload("B");
    });

    // inspector events
    $("#copy-config").addEventListener("click", copyConfigJson);
    $("#reset-all").addEventListener("click", resetAll);

    // block editor events (Phase 2)
    $("#be-apply").addEventListener("click", function () {
      if (state.selectedBlockIndex === null) return;
      applyBlockEdit(state.selectedBlockIndex, $("#be-html").value);
    });
    $("#be-duplicate").addEventListener("click", function () {
      if (state.selectedBlockIndex === null) return;
      duplicateBlock(state.selectedBlockIndex);
      $("#be-selected").style.display = "none";
      state.selectedBlockIndex = null;
    });
    $("#be-delete").addEventListener("click", function () {
      if (state.selectedBlockIndex === null) return;
      deleteBlock(state.selectedBlockIndex);
      $("#be-selected").style.display = "none";
      state.selectedBlockIndex = null;
    });
    var rowTimer = null;
    $("#row-count-range").addEventListener("input", function (e) {
      $("#row-count-value").textContent = e.target.value;
      clearTimeout(rowTimer);
      rowTimer = setTimeout(function () { setRowCount(Number(e.target.value)); }, 400);
    });

    // data binding events (Phase 3)
    var dataTimer = null;
    $("#data-json").addEventListener("input", function (e) {
      clearTimeout(dataTimer);
      var text = e.target.value;
      dataTimer = setTimeout(function () {
        try {
          var parsed = JSON.parse(text);
          state.sampleData = parsed;
          localStorage.setItem("pfstudio.data." + state.templateId, JSON.stringify(parsed));
          hideDataJsonError();
          reloadAll();
        } catch (err) {
          showDataJsonError((state.lang === "zh" ? "JSON 解析错误: " : "JSON parse error: ") + err.message);
        }
      }, 500);
    });
    $("#data-regenerate").addEventListener("click", function () {
      showConfirm(t("regenerateConfirm")).then(function (ok) {
        if (!ok) return;
        state.sampleData = buildSampleSkeleton(state.workingHtml);
        $("#data-json").value = JSON.stringify(state.sampleData, null, 2);
        localStorage.setItem("pfstudio.data." + state.templateId, JSON.stringify(state.sampleData));
        hideDataJsonError();
        reloadAll();
      });
    });
    $("#data-export-package").addEventListener("click", exportDataPackage);
  }

  boot();
})();
