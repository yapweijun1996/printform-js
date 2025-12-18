/* eslint-disable no-console */

(function(global) {
  if (global && global.__printFormHelpersLoaded__) {
    return;
  }
  if (global) {
    global.__printFormHelpersLoaded__ = true;
  }

  const PrintForm = global.PrintForm = global.PrintForm || {};
  const Internal = PrintForm._internal = PrintForm._internal || {};

  const TRUE_TOKENS = new Set(["y", "yes", "true", "1"]);
  const FALSE_TOKENS = new Set(["n", "no", "false", "0"]);

  function parseBooleanFlag(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const lowered = String(value).trim().toLowerCase();
    if (TRUE_TOKENS.has(lowered)) return true;
    if (FALSE_TOKENS.has(lowered)) return false;
    return fallback;
  }

  function parseNumber(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function parseString(value, fallback) {
    if (value === undefined || value === null || value === "") return fallback;
    return String(value);
  }

  function normalizeHeight(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.round(num));
  }

  function ensurePageNumberPlaceholder(element) {
    if (!element) return null;
    if (element.__pageNumberPlaceholder) {
      return element.__pageNumberPlaceholder;
    }
    const doc = element.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc) return null;
    let container = element.querySelector("[data-page-number-container]");
    if (!container) {
      container = element.querySelector("td:last-child") || element.querySelector("td") || element;
    }
    const placeholder = doc.createElement("span");
    placeholder.className = "printform_page_number_placeholder";
    container.appendChild(placeholder);
    element.__pageNumberPlaceholder = placeholder;
    return placeholder;
  }

  function ensurePhysicalPageNumberPlaceholder(element) {
    if (!element) return null;
    if (element.__physicalPageNumberPlaceholder) {
      return element.__physicalPageNumberPlaceholder;
    }
    const doc = element.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc) return null;
    let container = element.querySelector("[data-physical-page-number-container]");
    if (!container) {
      container = element.querySelector("td:last-child") || element.querySelector("td") || element;
    }
    const placeholder = doc.createElement("span");
    placeholder.className = "printform_physical_page_number_placeholder";
    container.appendChild(placeholder);
    element.__physicalPageNumberPlaceholder = placeholder;
    return placeholder;
  }

  function updatePageNumberContent(element, pageNumber, totalPages) {
    if (!element) return;
    const numberTargets = element.querySelectorAll("[data-page-number]");
    if (numberTargets.length > 0) {
      numberTargets.forEach(function(target) {
        target.textContent = pageNumber;
      });
    }
    const totalTargets = element.querySelectorAll("[data-page-total]");
    const totalValue = totalPages !== undefined && totalPages !== null ? totalPages : "";
    if (totalTargets.length > 0) {
      totalTargets.forEach(function(target) {
        target.textContent = totalValue;
      });
    }
    if (numberTargets.length === 0 && totalTargets.length === 0) {
      const fallback = ensurePageNumberPlaceholder(element);
      if (fallback) {
        fallback.textContent = totalPages !== undefined && totalPages !== null
          ? "Page " + pageNumber + " of " + totalPages
          : "Page " + pageNumber;
      }
    }
  }

  function updatePhysicalPageNumberContent(element, pageNumber, totalPages) {
    if (!element) return;
    const numberTargets = element.querySelectorAll("[data-physical-page-number]");
    if (numberTargets.length > 0) {
      numberTargets.forEach(function(target) {
        target.textContent = pageNumber;
      });
    }
    const totalTargets = element.querySelectorAll("[data-physical-page-total]");
    const totalValue = totalPages !== undefined && totalPages !== null ? totalPages : "";
    if (totalTargets.length > 0) {
      totalTargets.forEach(function(target) {
        target.textContent = totalValue;
      });
    }
    if (numberTargets.length === 0 && totalTargets.length === 0) {
      const fallback = ensurePhysicalPageNumberPlaceholder(element);
      if (fallback) {
        fallback.textContent = totalPages !== undefined && totalPages !== null
          ? "Sheet " + pageNumber + " of " + totalPages
          : "Sheet " + pageNumber;
      }
    }
  }

  Internal.parseBooleanFlag = parseBooleanFlag;
  Internal.parseNumber = parseNumber;
  Internal.parseString = parseString;
  Internal.normalizeHeight = normalizeHeight;
  Internal.updatePageNumberContent = updatePageNumberContent;
  Internal.updatePhysicalPageNumberContent = updatePhysicalPageNumberContent;
})(typeof window !== "undefined" ? window : this);
