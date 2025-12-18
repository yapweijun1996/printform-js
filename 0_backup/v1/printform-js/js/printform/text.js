/* eslint-disable no-console */

(function(global) {
  if (global && global.__printFormTextLoaded__) {
    return;
  }
  if (global) {
    global.__printFormTextLoaded__ = true;
  }

  const PrintForm = global.PrintForm = global.PrintForm || {};
  const Internal = PrintForm._internal = PrintForm._internal || {};

  const ROW_SELECTOR = ".prowitem, .ptac-rowitem, .paddt-rowitem";

  var PTAC_MAX_WORDS_PER_SEGMENT = 200;
  var PADDT_MAX_WORDS_PER_SEGMENT = 200;

  function convertWordsToHtml(node, words) {
    var clone = node.cloneNode(false);
    clone.textContent = words.join(" ");
    return clone.outerHTML || "";
  }

  function splitParagraphIntoHtmlChunks(node, maxWords) {
    if (!node) {
      return [];
    }
    var text = (node.textContent || "").trim();
    if (!text) {
      return [node.outerHTML || ""];
    }
    var words = text.split(/\s+/).filter(function(word) {
      return word && word.length > 0;
    });
    if (words.length <= maxWords) {
      return [node.outerHTML || ""];
    }
    var chunks = [];
    var buffer = [];
    for (var index = 0; index < words.length; index += 1) {
      buffer.push(words[index]);
      if (buffer.length >= maxWords) {
        chunks.push(convertWordsToHtml(node, buffer));
        buffer = [];
      }
    }
    if (buffer.length > 0) {
      chunks.push(convertWordsToHtml(node, buffer));
    }
    return chunks;
  }

  // ===== paddt 文本分割/转换封装 (中文解释: paddt 文本处理包装) =====
  function splitPaddtParagraphIntoHtmlChunks(node, maxWords) {
    return splitParagraphIntoHtmlChunks(node, maxWords);
  }

  Internal.ROW_SELECTOR = ROW_SELECTOR;
  Internal.PTAC_MAX_WORDS_PER_SEGMENT = PTAC_MAX_WORDS_PER_SEGMENT;
  Internal.PADDT_MAX_WORDS_PER_SEGMENT = PADDT_MAX_WORDS_PER_SEGMENT;
  Internal.splitParagraphIntoHtmlChunks = splitParagraphIntoHtmlChunks;
  Internal.splitPaddtParagraphIntoHtmlChunks = splitPaddtParagraphIntoHtmlChunks;
})(typeof window !== "undefined" ? window : this);
