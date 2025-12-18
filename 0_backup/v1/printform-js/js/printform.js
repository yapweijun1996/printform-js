/* eslint-disable no-console */

(function(global) {
  if (global && global.__printFormScriptLoaded__) {
    return;
  }

  const PrintForm = global.PrintForm = global.PrintForm || {};
  const Internal = PrintForm._internal = PrintForm._internal || {};

  const getPrintformConfig = Internal.getPrintformConfig;
  const PrintFormFormatter = Internal.PrintFormFormatter;
  const DomHelpers = Internal.DomHelpers;

  if (!getPrintformConfig || !PrintFormFormatter || !DomHelpers) {
    throw new Error(
      "printform.js requires js/printform/*.js modules to be loaded first."
    );
  }
  if (global) {
    global.__printFormScriptLoaded__ = true;
  }

  function pauseInMilliseconds(time) {
    return new Promise((resolve, reject) => {
      if (typeof time === "number" && time > 0) {
        setTimeout(resolve, time);
      } else {
        reject(new Error("Invalid time value"));
      }
    });
  }

  async function formatAllPrintForms(overrides = {}) {
    if (global.__printFormProcessing) {
      return;
    }
    if (!overrides.force && global.__printFormProcessed) {
      return;
    }
    global.__printFormProcessing = true;

    try {
      const doc = global.document;
      if (!doc) return;

      const forms = Array.from(doc.querySelectorAll(".printform"));
      for (let index = 0; index < forms.length; index += 1) {
        const formEl = forms[index];
        const config = getPrintformConfig(formEl, overrides);
        try {
          await pauseInMilliseconds(1);
        } catch (error) {
          console.error("pauseInMilliseconds error", error);
        }
        try {
          const formatter = new PrintFormFormatter(formEl, config);
          const formatted = formatter.format();
          if (index > 0 && formatted && formatted.parentNode) {
            formatted.parentNode.insertBefore(DomHelpers.createPageBreakDivider(), formatted);
          }
        } catch (error) {
          console.error("printform format error", error);
        }
      }

      global.__printFormProcessed = true;
    } finally {
      global.__printFormProcessing = false;
    }
  }

  function formatSinglePrintForm(formEl, overrides = {}) {
    const config = getPrintformConfig(formEl, overrides);
    const formatter = new PrintFormFormatter(formEl, config);
    return formatter.format();
  }

  PrintForm.formatAll = formatAllPrintForms;
  PrintForm.format = formatSinglePrintForm;

  const doc = global.document;
  if (doc && doc.addEventListener) {
    doc.addEventListener("DOMContentLoaded", () => {
      formatAllPrintForms();
    });
  }
})(typeof window !== "undefined" ? window : this);
