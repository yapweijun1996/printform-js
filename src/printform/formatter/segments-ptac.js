/* eslint-disable no-console */

import { PTAC_MAX_WORDS_PER_SEGMENT, splitParagraphIntoHtmlChunks } from "../text.js";

export function attachPtacSegmentMethods(FormatterClass) {
  FormatterClass.prototype.expandPtacSegments = function expandPtacSegments() {
    if (this.formEl.dataset.ptacExpanded === "true") {
      return;
    }
    const ptacTables = Array.from(this.formEl.querySelectorAll(".ptac"));
    if (ptacTables.length === 0) {
      this.formEl.dataset.ptacExpanded = "true";
      return;
    }

    ptacTables.forEach((ptacRoot) => {
      if (!ptacRoot || ptacRoot.dataset.ptacSegment === "true") {
        return;
      }

      const contentWrapper = ptacRoot.querySelector("td > div") || ptacRoot.querySelector("td");
      if (!contentWrapper) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const allChildren = Array.from(contentWrapper.children);

      if (allChildren.length === 0) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const segments = [];

      // Iterate through all children
      allChildren.forEach(child => {
        if (child.tagName.toLowerCase() === 'p') {
          // It's a paragraph, check if it needs splitting
          const chunks = splitParagraphIntoHtmlChunks(child, PTAC_MAX_WORDS_PER_SEGMENT);
          chunks.forEach(chunk => segments.push(chunk));
        } else {
          // It's not a paragraph (e.g., h2, h3, div, etc.), keep it as is
          segments.push(child.outerHTML);
        }
      });

      if (segments.length === 0) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      contentWrapper.innerHTML = segments[0];
      ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
      ptacRoot.dataset.ptacSegment = "true";

      var lastNode = ptacRoot;
      for (var index = 1; index < segments.length; index += 1) {
        const clone = ptacRoot.cloneNode(true);
        clone.classList.remove("tb_page_break_before");
        clone.dataset.ptacSegment = "true";
        const cloneWrapper = clone.querySelector("td > div") || clone.querySelector("td");
        if (cloneWrapper) {
          cloneWrapper.innerHTML = segments[index];
        }
        lastNode.parentNode.insertBefore(clone, lastNode.nextSibling);
        lastNode = clone;
      }
    });

    this.formEl.dataset.ptacExpanded = "true";
  };
}

