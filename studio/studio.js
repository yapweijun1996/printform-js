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
      logs: "分页日志",
      printHint: "Studio 预览用于快速迭代;最终效果请以浏览器打印预览为准。",
      copyAB: "复制 A→B",
      loading: "加载中…",
      pages: "页",
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
      moreMenu: "更多选项"
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
      logs: "Pagination log",
      printHint: "Studio preview is for fast iteration; verify final output with the browser's print preview.",
      copyAB: "Copy A→B",
      loading: "Loading…",
      pages: "pages",
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
      moreMenu: "More options"
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
    mustacheLiteSource: null // cached source text of mustache-lite.js, for package export
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
    persist();
    scheduleReload(state.activeSide);
    refreshItemState(d);
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
      // Export keeps overrides but not the <base> (paths were relative to the
      // template's own folder, where the export will typically live too).
      var b = doc.querySelector("head > base");
      if (b) b.remove();
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

    mountDiv.after(templateEl, mustacheScript, bootstrapScript);

    var base = doc.createElement("base");
    base.setAttribute("href", state.templateBaseHref);
    var head = doc.querySelector("head");
    if (head) head.insertBefore(base, head.firstChild);

    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  function exportDataPackage() {
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
  }

  function reloadAll() {
    reload("A");
    if (state.compare) reload("B");
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
    } else if (data.type === "blocks-ready") {
      state.blockCount = data.payload.count;
      state.rowCount = data.payload.rowCount;
      var range = $("#row-count-range");
      range.max = Math.max(10, state.rowCount + 20);
      range.value = state.rowCount;
      $("#row-count-value").textContent = state.rowCount;
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

  function exportHtml() {
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
    if (!w) return;
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

  function resetAll() {
    if (!confirm(t("resetConfirm"))) return;
    state.overrides[state.activeSide] = {};
    persist();
    buildConfigPanel();
    scheduleReload(state.activeSide);
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
  // Below COMPACT_QUERY's width, secondary buttons move into #more-menu.
  // These are the SAME DOM nodes (moved via append/before), never copies —
  // that way toggled state and translated label text stay correct no
  // matter which container currently holds them, with nothing to keep in
  // sync by hand.
  var COMPACT_QUERY = "(max-width: 680px)";
  var SECONDARY_BUTTON_IDS = [
    "import-html", "compare-toggle", "mode-toggle",
    "toggle-config", "toggle-inspector", "lang-toggle", "print-preview"
  ];

  function setupResponsiveTopbar() {
    var topbar = $("#topbar");
    var moreMenu = $("#more-menu");
    var moreToggle = $("#more-menu-toggle");
    var spacer = topbar.querySelector(".spacer");
    var mql = window.matchMedia(COMPACT_QUERY);

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

    window.addEventListener("resize", closeMenu);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });

    applyLayout(mql.matches);
    mql.addEventListener("change", function (e) { applyLayout(e.matches); });
    // Belt-and-suspenders: some environments resize the viewport without
    // firing matchMedia's change event (seen with a few automated/embedded
    // browser contexts). A plain resize listener re-checks mql.matches
    // directly, so layout never gets stuck compact/expanded.
    window.addEventListener("resize", function () { applyLayout(mql.matches); });
  }

  // ---------- boot ----------
  function boot() {
    applyI18n();
    setupResponsiveTopbar();

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
      if (!confirm(t("regenerateConfirm"))) return;
      state.sampleData = buildSampleSkeleton(state.workingHtml);
      $("#data-json").value = JSON.stringify(state.sampleData, null, 2);
      localStorage.setItem("pfstudio.data." + state.templateId, JSON.stringify(state.sampleData));
      hideDataJsonError();
      reloadAll();
    });
    $("#data-export-package").addEventListener("click", exportDataPackage);
  }

  boot();
})();
