/*
 * PrintForm Studio bridge — injected into every preview iframe.
 * Captures debug console output and formatted-page metrics, then reports
 * them to the Studio shell via postMessage. Must stay dependency-free.
 */
(function () {
  "use strict";

  var SIDE = document.documentElement.getAttribute("data-studio-side") || "A";

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

  if (document.readyState === "complete") {
    waitForFormat();
  } else {
    window.addEventListener("load", function () {
      setTimeout(waitForFormat, 50);
    });
  }
})();
