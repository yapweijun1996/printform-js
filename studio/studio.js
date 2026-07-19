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
      resetConfirm: "重置当前侧所有配置修改?"
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
      resetConfirm: "Reset all config changes on the current side?"
    }
  };

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
    templateHtml: null,    // raw HTML of the selected template
    templateBaseline: {},  // data-* attrs actually present on the template's .printform
    metrics: { A: null, B: null }
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

  function synthesizeHtml(side, forExport) {
    var html = state.templateHtml;
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

  // ---------- preview ----------
  var reloadTimers = { A: null, B: null };
  var blobUrls = { A: null, B: null };

  function scheduleReload(side) {
    clearTimeout(reloadTimers[side]);
    reloadTimers[side] = setTimeout(function () { reload(side); }, 300);
  }

  function reload(side) {
    var html = synthesizeHtml(side, false);
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
  function loadTemplate(id) {
    var tpl = state.templates.find(function (x) { return x.id === id; });
    if (!tpl) return Promise.reject(new Error("unknown template: " + id));
    state.templateId = id;
    persist();
    var url = new URL(tpl.path, location.href);
    state.templateBaseHref = new URL("./", url).href;
    return fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("fetch " + r.status);
        return r.text();
      })
      .then(function (html) {
        state.templateHtml = html;
        // Read the template's own data-* declarations — they are the panel's
        // resting baseline, not the library defaults.
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
        buildConfigPanel();
        reloadAll();
      });
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

  // ---------- boot ----------
  function boot() {
    applyI18n();

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
    });
    $("#compare-toggle").addEventListener("click", function () { setCompare(!state.compare); });
    $("#toggle-config").addEventListener("click", function () { document.body.classList.toggle("hide-config"); });
    $("#toggle-inspector").addEventListener("click", function () { document.body.classList.toggle("hide-inspector"); });
    $("#export-html").addEventListener("click", exportHtml);
    $("#print-preview").addEventListener("click", openPrintPreview);

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
  }

  boot();
})();
