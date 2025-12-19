/* eslint-disable no-console */

import { DEFAULT_CONFIG, DEFAULT_PADDT_CONFIG, getPrintformConfig } from "./printform/config.js";
import { DomHelpers } from "./printform/dom.js";
import { PrintFormFormatter } from "./printform/formatter.js";

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
    const globalScope = typeof window !== "undefined" ? window : globalThis;
    if (globalScope.__printFormProcessing) {
      return;
    }
    if (!overrides.force && globalScope.__printFormProcessed) {
      return;
    }
    globalScope.__printFormProcessing = true;

    try {
      const doc = globalScope.document;
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

      globalScope.__printFormProcessed = true;
    } finally {
      globalScope.__printFormProcessing = false;
    }
  }

  function formatSinglePrintForm(formEl, overrides = {}) {
    const config = getPrintformConfig(formEl, overrides);
    const formatter = new PrintFormFormatter(formEl, config);
    return formatter.format();
  }

  const api = {
    formatAll: formatAllPrintForms,
    format: formatSinglePrintForm,
    DEFAULT_CONFIG,
    DEFAULT_PADDT_CONFIG
  };

  const globalScope = typeof window !== "undefined" ? window : null;
  if (globalScope) {
    if (globalScope.__printFormScriptLoaded__) {
      globalScope.PrintForm = globalScope.PrintForm || api;
    } else {
      globalScope.__printFormScriptLoaded__ = true;
      globalScope.PrintForm = globalScope.PrintForm || {};
      Object.assign(globalScope.PrintForm, api);
      const doc = globalScope.document;
      if (doc && doc.addEventListener) {
        doc.addEventListener("DOMContentLoaded", () => {
          formatAllPrintForms();
        });
      }
    }
  }

  export default api;
