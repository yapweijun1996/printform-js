/*
 * PrintForm Studio bridge — injected into every preview iframe.
 *
 * Two modes, read from <html data-studio-mode="...">:
 *   "preview"   (default) — printform.js runs normally; bridge reports
 *                console output + page-count metrics once formatting settles.
 *   "structure" — printform.js is NOT loaded (Studio strips the script tag
 *                before injecting this file); bridge instead makes each
 *                direct child of .printform clickable/selectable so the
 *                Block Editor panel can edit raw pre-pagination blocks.
 *
 * Must stay dependency-free — it runs inside a blob: document with no
 * bundler.
 */
(function () {
  "use strict";

  var SIDE = document.documentElement.getAttribute("data-studio-side") || "A";
  var MODE = document.documentElement.getAttribute("data-studio-mode") || "preview";

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

  function post(type, payload) {
    try {
      parent.postMessage({ source: "printform-studio-bridge", side: SIDE, type: type, payload: payload }, "*");
    } catch (e) {
      /* parent gone — nothing to do */
    }
  }

  ["log", "info", "warn", "error"].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      var args = Array.prototype.slice.call(arguments);
      var text = args
        .map(function (a) {
          if (typeof a === "string") return a;
          try { return JSON.stringify(a); } catch (e) { return String(a); }
        })
        .join(" ");
      post("console", { level: level, text: text });
      return original.apply(console, args);
    };
  });

  window.addEventListener("error", function (event) {
    post("console", { level: "error", text: event.message + " (" + event.filename + ":" + event.lineno + ")" });
  });

  // ---------------------------------------------------------------- preview
  function collectMetrics() {
    var logicalPages = document.querySelectorAll(".printform_page");
    var physicalPages = document.querySelectorAll(".physical_page_wrapper");
    var processed = document.querySelectorAll(".printform_formatter_processed");
    return {
      logicalPages: logicalPages.length,
      physicalPages: physicalPages.length,
      formatted: processed.length > 0,
      docHeight: document.documentElement.scrollHeight
    };
  }

  // printform.js auto-runs on load; the original .printform is removed once
  // formatting finishes, so poll for that state transition.
  var attempts = 0;
  function waitForFormat() {
    attempts += 1;
    var pending = document.querySelector(".printform");
    var processed = document.querySelector(".printform_formatter_processed");
    if ((processed && !pending) || attempts > 150) {
      post("done", collectMetrics());
      return;
    }
    setTimeout(waitForFormat, 100);
  }

  // --------------------------------------------------------------- structure
  var STRUCTURE_STYLE = [
    ".studio-block { outline: 1px dashed rgba(37,99,235,0.35); outline-offset: -1px; cursor: pointer; position: relative; }",
    ".studio-block:hover { outline: 1px dashed #2563eb; background: rgba(37,99,235,0.04); }",
    ".studio-block.studio-selected { outline: 2px solid #2563eb; outline-offset: -2px; background: rgba(37,99,235,0.08); }",
    ".studio-block::before { content: attr(data-studio-label); position: absolute; top: -1px; left: -1px; font: 10px/1.4 monospace; background: #2563eb; color: #fff; padding: 0 4px; opacity: 0; pointer-events: none; z-index: 999; }",
    ".studio-block:hover::before, .studio-block.studio-selected::before { opacity: 1; }"
  ].join("\n");

  function setupStructureMode() {
    var style = document.createElement("style");
    style.textContent = STRUCTURE_STYLE;
    document.head.appendChild(style);

    var form = document.querySelector(".printform");
    if (!form) {
      post("blocks-ready", { count: 0, rowCount: 0 });
      return;
    }

    var children = Array.prototype.slice.call(form.children);
    var wrappers = [];
    children.forEach(function (el, index) {
      var type = classify(el);
      // Every printform template lays out blocks with <table style="table-layout:
      // fixed"> plus a "width:inherit" column that's meant to take the remaining
      // space. Putting .studio-block's outline/::before label directly on that
      // <table> corrupts Chromium's fixed-table column-width algorithm — even an
      // empty ::before rule alone collapses a 15px/auto/15px split into three
      // equal thirds, squashing every product row. Wrap the block in a plain div
      // instead and keep the table itself undecorated; the click handler and
      // outerHTML capture still target the original element.
      var wrapper = document.createElement("div");
      wrapper.className = "studio-block";
      wrapper.setAttribute("data-studio-index", String(index));
      wrapper.setAttribute("data-studio-label", type);
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);
      wrappers.push(wrapper);
      wrapper.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        wrappers.forEach(function (w) { w.classList.remove("studio-selected"); });
        wrapper.classList.add("studio-selected");
        post("block-select", { index: index, type: type, outerHTML: el.outerHTML });
      });
    });

    var rowCount = children.filter(function (el) { return classify(el) === "prowitem"; }).length;
    post("blocks-ready", { count: children.length, rowCount: rowCount });
  }

  window.addEventListener("message", function (event) {
    var data = event.data;
    if (!data || data.source !== "printform-studio") return;
    if (data.type === "highlight") {
      var form = document.querySelector(".printform");
      if (!form) return;
      Array.prototype.forEach.call(form.children, function (c) { c.classList.remove("studio-selected"); });
      var target = form.children[data.payload.index];
      if (target) {
        target.classList.add("studio-selected");
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  });

  function boot() {
    if (MODE === "structure") {
      setupStructureMode();
      return;
    }
    if (document.readyState === "complete") {
      waitForFormat();
    } else {
      window.addEventListener("load", function () {
        setTimeout(waitForFormat, 50);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
