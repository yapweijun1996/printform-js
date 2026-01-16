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

      const allParagraphs = Array.from(contentWrapper.querySelectorAll("p"));
      var headingNode = null;
      if (allParagraphs.length > 1) {
        headingNode = allParagraphs.shift();
      }
      const paragraphs = allParagraphs;

      if (paragraphs.length === 0) {
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const headingHTML = headingNode ? headingNode.outerHTML : "";
      const paragraphHTML = paragraphs.reduce(function(accumulator, node) {
        const chunks = splitParagraphIntoHtmlChunks(node, PTAC_MAX_WORDS_PER_SEGMENT);
        return accumulator.concat(chunks);
      }, []);

      if (paragraphHTML.length === 0) {
        contentWrapper.innerHTML = headingHTML;
        ptacRoot.classList.add("ptac-rowitem", "ptac_segment");
        ptacRoot.dataset.ptacSegment = "true";
        return;
      }

      const segments = [];
      if (headingHTML) {
        segments.push(headingHTML + paragraphHTML[0]);
        for (var segIndex = 1; segIndex < paragraphHTML.length; segIndex += 1) {
          segments.push(paragraphHTML[segIndex]);
        }
      } else {
        for (var segIndexAlt = 0; segIndexAlt < paragraphHTML.length; segIndexAlt += 1) {
          segments.push(paragraphHTML[segIndexAlt]);
        }
      }

      if (segments.length === 0) {
        contentWrapper.innerHTML = headingHTML;
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

