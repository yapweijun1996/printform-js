/* eslint-disable no-console */

import { PADDT_MAX_WORDS_PER_SEGMENT, splitPaddtParagraphIntoHtmlChunks } from "../text.js";

export function attachPaddtSegmentMethods(FormatterClass) {
  FormatterClass.prototype.expandPaddtSegments = function expandPaddtSegments() {
    if (this.formEl.dataset.paddtExpanded === "true") {
      return;
    }
    const paddtTables = Array.from(this.formEl.querySelectorAll(".paddt"));
    if (paddtTables.length === 0) {
      this.formEl.dataset.paddtExpanded = "true";
      return;
    }

    var maxWords = (this.paddtConfig && this.paddtConfig.paddtMaxWordsPerSegment) || PADDT_MAX_WORDS_PER_SEGMENT;

    paddtTables.forEach((paddtRoot) => {
      if (!paddtRoot || paddtRoot.dataset.paddtSegment === "true") {
        return;
      }

      const contentWrapper = paddtRoot.querySelector("td > div") || paddtRoot.querySelector("td");
      if (!contentWrapper) {
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      const allParagraphs = Array.from(contentWrapper.querySelectorAll("p"));
      var headingNode = null;
      if (allParagraphs.length > 1) {
        headingNode = allParagraphs.shift();
      }
      const paragraphs = allParagraphs;

      if (paragraphs.length === 0) {
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      const headingHTML = headingNode ? headingNode.outerHTML : "";
      const paragraphHTML = paragraphs.reduce(function(accumulator, node) {
        const chunks = splitPaddtParagraphIntoHtmlChunks(node, maxWords);
        return accumulator.concat(chunks);
      }, []);

      if (paragraphHTML.length === 0) {
        contentWrapper.innerHTML = headingHTML;
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
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
        paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
        paddtRoot.dataset.paddtSegment = "true";
        return;
      }

      contentWrapper.innerHTML = segments[0];
      paddtRoot.classList.add("paddt-rowitem", "paddt_segment");
      paddtRoot.dataset.paddtSegment = "true";

      var lastNode = paddtRoot;
      for (var index = 1; index < segments.length; index += 1) {
        const clone = paddtRoot.cloneNode(true);
        clone.dataset.paddtSegment = "true";
        const cloneWrapper = clone.querySelector("td > div") || clone.querySelector("td");
        if (cloneWrapper) {
          cloneWrapper.innerHTML = segments[index];
        }
        lastNode.parentNode.insertBefore(clone, lastNode.nextSibling);
        lastNode = clone;
      }
    });

    this.formEl.dataset.paddtExpanded = "true";
  };
}

