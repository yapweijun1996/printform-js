/* eslint-disable no-console */

import { normalizeHeight } from "./helpers.js";

  function createDummyRowTable(config, height) {
    const table = document.createElement("table");
    table.className = "dummy_row";
    table.setAttribute("width", `${config.papersizeWidth}px`);
    table.setAttribute("cellspacing", "0");
    table.setAttribute("cellpadding", "0");
    table.innerHTML = `<tr style="height:${normalizeHeight(height)}px;"><td style="border:0px solid black;"></td></tr>`;
    return table;
  }

  function createDummyRowItemTable(config) {
    const table = document.createElement("table");
    table.className = "dummy_row_item";
    table.setAttribute("width", `${config.papersizeWidth}px`);
    table.setAttribute("cellspacing", "0");
    table.setAttribute("cellpadding", "0");
    if (config.customDummyRowItemContent) {
      table.innerHTML = config.customDummyRowItemContent;
    } else {
      table.innerHTML = `<tr style="height:${normalizeHeight(config.heightOfDummyRowItem)}px;"><td style="border:0px solid black;"></td></tr>`;
    }
    return table;
  }

  function appendDummyRowItems(config, target, diffHeight) {
    const itemHeight = normalizeHeight(config.heightOfDummyRowItem);
    const remaining = normalizeHeight(diffHeight);
    if (itemHeight <= 0 || remaining <= 0) return;
    const count = Math.floor(remaining / itemHeight);
    for (let index = 0; index < count; index += 1) {
      target.appendChild(createDummyRowItemTable(config));
    }
  }

  function appendDummyRow(config, target, diffHeight) {
    const remaining = normalizeHeight(diffHeight);
    if (remaining <= 0) return;
    target.appendChild(createDummyRowTable(config, remaining));
  }

  function applyDummyRowItemsStep(config, container, heightPerPage, currentHeight) {
    if (!config.insertDummyRowItemWhileFormatTable) {
      return normalizeHeight(currentHeight);
    }
    const remaining = normalizeHeight(heightPerPage - currentHeight);
    if (remaining > 0) {
      appendDummyRowItems(config, container, remaining);
      const itemHeight = normalizeHeight(config.heightOfDummyRowItem);
      if (itemHeight > 0) {
        const remainder = normalizeHeight(remaining % itemHeight);
        return normalizeHeight(heightPerPage - remainder);
      }
    }
    return normalizeHeight(currentHeight);
  }

  function applyDummyRowStep(config, container, heightPerPage, currentHeight) {
    if (!config.insertDummyRowWhileFormatTable) {
      return normalizeHeight(currentHeight);
    }
    const remaining = normalizeHeight(heightPerPage - currentHeight);
    if (remaining > 0) {
      appendDummyRow(config, container, remaining);
      return normalizeHeight(currentHeight + remaining);
    }
    return normalizeHeight(currentHeight);
  }

  function applyFooterSpacerWithDummyStep(config, container, heightPerPage, currentHeight, skipDummyRowItems) {
    if (!config.insertFooterSpacerWithDummyRowItemWhileFormatTable || skipDummyRowItems) {
      return {
        currentHeight: normalizeHeight(currentHeight),
        skipFooterSpacer: false
      };
    }
    const remaining = normalizeHeight(heightPerPage - currentHeight);
    let workingHeight = normalizeHeight(currentHeight);
    if (remaining > 0) {
      appendDummyRowItems(config, container, remaining);
      const itemHeight = normalizeHeight(config.heightOfDummyRowItem);
      if (itemHeight > 0) {
        const remainder = normalizeHeight(remaining % itemHeight);
        workingHeight = normalizeHeight(heightPerPage - remainder);
      }
    }
    return {
      currentHeight: workingHeight,
      skipFooterSpacer: true
    };
  }

  function applyFooterSpacerStep(config, container, heightPerPage, currentHeight, footerState, spacerTemplate) {
    if (!config.insertFooterSpacerWhileFormatTable) return;
    const clone = spacerTemplate.cloneNode(true);
    let remaining = normalizeHeight(heightPerPage - currentHeight);
    if (footerState && footerState.nonRepeating) {
      remaining -= normalizeHeight(footerState.nonRepeating);
    }
    clone.style.height = `${Math.max(0, remaining)}px`;
    container.appendChild(clone);
  }

  function markAsProcessed(element, baseClass) {
    if (!element || !baseClass) return;
    if (element.classList.contains(`${baseClass}_processed`)) return;
    element.classList.remove(baseClass);
    element.classList.add(`${baseClass}_processed`);
  }

  function measureHeight(element) {
    return element ? normalizeHeight(element.offsetHeight || element.getBoundingClientRect().height) : 0;
  }

  function createPageBreakDivider() {
    const div = document.createElement("div");
    div.classList.add("div_page_break_before");
    div.style.pageBreakBefore = "always";
    div.style.height = "0px";
    return div;
  }

  function appendClone(target, element, logFn, label) {
    if (!element) return null;
    const clone = element.cloneNode(true);
    target.appendChild(clone);
    if (logFn) logFn(`append ${label}`);
    return clone;
  }

  function appendRowItem(target, element, logFn, index, label) {
    if (!element) return;
    const clone = element.cloneNode(true);
    target.appendChild(clone);
    if (logFn) {
      const resolvedLabel = label || "prowitem";
      logFn(`append ${resolvedLabel} ${index}`);
    }
  }

  export const DomHelpers = {
    markAsProcessed,
    measureHeight,
    createPageBreakDivider,
    appendClone,
    appendRowItem
  };

  export { applyDummyRowItemsStep, applyDummyRowStep, applyFooterSpacerWithDummyStep, applyFooterSpacerStep };
