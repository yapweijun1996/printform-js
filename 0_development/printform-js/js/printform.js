/* eslint-disable no-console */

import { DEFAULT_CONFIG, DEFAULT_PADDT_CONFIG, getPrintformConfig } from "./printform/config.js";
import { DomHelpers } from "./printform/dom.js";
import { PrintFormFormatter } from "./printform/formatter.js";

// 检测是否为移动设备
function isMobileDevice() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

// 根据设备类型获取适当的延迟时间
function getDeviceDelay() {
  return isMobileDevice() ? 50 : 1; // 移动端使用 50ms,桌面使用 1ms
}

function withDividerClassAppend(globalScope, classAppend, fn) {
  const prior = globalScope.__printFormDividerClassAppend;
  globalScope.__printFormDividerClassAppend = typeof classAppend === "string" ? classAppend : "";
  try {
    return fn();
  } finally {
    if (prior === undefined) {
      delete globalScope.__printFormDividerClassAppend;
    } else {
      globalScope.__printFormDividerClassAppend = prior;
    }
  }
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
      const perFormOverrides = { ...overrides };
      if (perFormOverrides.divPageBreakBeforeClassAppend === undefined && formEl && formEl.dataset) {
        const datasetValue = formEl.dataset.divPageBreakBeforeClassAppend;
        if (typeof datasetValue === "string" && datasetValue.trim()) {
          perFormOverrides.divPageBreakBeforeClassAppend = datasetValue.trim();
        }
      }
      const dividerClassAppend = perFormOverrides.divPageBreakBeforeClassAppend;
      const config = getPrintformConfig(formEl, perFormOverrides);
      try {
        await pauseInMilliseconds(getDeviceDelay());
      } catch (error) {
        console.error("pauseInMilliseconds error", error);
      }
      try {
        const formatted = withDividerClassAppend(globalScope, dividerClassAppend, () => {
          const formatter = new PrintFormFormatter(formEl, config);
          return formatter.format();
        });
        if (index > 0 && formatted && formatted.parentNode) {
          formatted.parentNode.insertBefore(DomHelpers.createPageBreakDivider(dividerClassAppend), formatted);
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
  const globalScope = typeof window !== "undefined" ? window : globalThis;
  const perFormOverrides = { ...overrides };
  if (perFormOverrides.divPageBreakBeforeClassAppend === undefined && formEl && formEl.dataset) {
    const datasetValue = formEl.dataset.divPageBreakBeforeClassAppend;
    if (typeof datasetValue === "string" && datasetValue.trim()) {
      perFormOverrides.divPageBreakBeforeClassAppend = datasetValue.trim();
    }
  }
  const dividerClassAppend = perFormOverrides.divPageBreakBeforeClassAppend;
  const config = getPrintformConfig(formEl, perFormOverrides);
  return withDividerClassAppend(globalScope, dividerClassAppend, () => {
    const formatter = new PrintFormFormatter(formEl, config);
    return formatter.format();
  });
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
      // 改进的加载时机处理,特别针对移动端
      function ensureReadyAndFormat() {
        const isMobile = isMobileDevice();
        const delay = isMobile ? 150 : 50; // 移动端需要更多时间让样式完全应用

        if (doc.readyState === 'complete') {
          // 文档已完全加载,添加延迟确保样式已应用
          setTimeout(() => {
            formatAllPrintForms();
          }, delay);
        } else {
          // 使用 load 事件而不是 DOMContentLoaded,确保 CSS 已加载
          globalScope.addEventListener('load', () => {
            setTimeout(() => {
              formatAllPrintForms();
            }, delay);
          });
        }
      }

      // 同时监听 DOMContentLoaded 作为后备
      doc.addEventListener("DOMContentLoaded", ensureReadyAndFormat);
    }
  }
}

export default api;
