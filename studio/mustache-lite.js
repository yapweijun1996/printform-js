/*
 * mustache-lite — a minimal, dependency-free {{ }} template renderer.
 *
 * Supports the subset of Mustache that PrintForm Studio's Phase 3 needs:
 *   {{field}}          escaped variable
 *   {{{field}}} {{&field}}  unescaped (raw HTML) variable
 *   {{#section}}...{{/section}}   loop over an array, or render once if truthy
 *   {{^section}}...{{/section}}   render only when falsy / empty array
 *   dotted paths: {{a.b.c}}
 *   nested field lookup falls back up the enclosing section's context stack,
 *   so a field from the top-level data is still visible inside a loop.
 *
 * Deliberately NOT supported: partials, lambdas, comments, custom delimiters.
 * This file has no dependencies and no build step — it is included as-is
 * both inside Studio and inside every exported "data-bound" HTML package,
 * so `window.PrintFormTemplate.render(data)` works with zero setup.
 */
(function (global) {
  "use strict";

  var TAG_RE = /\{\{(\{|&)?\s*([\w.]+)\s*(\})?\}\}|\{\{(#|\^|\/)\s*([\w.]+)\s*\}\}/g;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Parses the template string into a tree of
  // {type:'text',value} | {type:'var',name,unescaped} | {type:'section',name,inverted,children}
  function parse(template) {
    var root = [];
    var stack = [root];
    var lastIndex = 0;
    var match;

    TAG_RE.lastIndex = 0;
    while ((match = TAG_RE.exec(template))) {
      var textBefore = template.slice(lastIndex, match.index);
      if (textBefore) stack[stack.length - 1].push({ type: "text", value: textBefore });
      lastIndex = match.index + match[0].length;

      var unescapedMark = match[1];
      var varName = match[2];
      var sectionMark = match[4];
      var sectionName = match[5];

      if (sectionMark === "#" || sectionMark === "^") {
        var node = { type: "section", name: sectionName, inverted: sectionMark === "^", children: [] };
        stack[stack.length - 1].push(node);
        stack.push(node.children);
      } else if (sectionMark === "/") {
        if (stack.length > 1) stack.pop();
      } else if (varName) {
        stack[stack.length - 1].push({ type: "var", name: varName, unescaped: Boolean(unescapedMark) });
      }
    }

    var trailing = template.slice(lastIndex);
    if (trailing) stack[stack.length - 1].push({ type: "text", value: trailing });
    return root;
  }

  function lookup(contextStack, dottedName) {
    var parts = dottedName.split(".");
    for (var i = contextStack.length - 1; i >= 0; i -= 1) {
      var value = contextStack[i];
      var found = true;
      for (var p = 0; p < parts.length; p += 1) {
        if (value !== null && typeof value === "object" && parts[p] in value) {
          value = value[parts[p]];
        } else {
          found = false;
          break;
        }
      }
      if (found) return value;
    }
    return undefined;
  }

  function isFalsy(value) {
    if (value === undefined || value === null || value === false || value === "") return true;
    if (Array.isArray(value)) return value.length === 0;
    return false;
  }

  function renderNodes(nodes, contextStack) {
    var out = "";
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      if (node.type === "text") {
        out += node.value;
      } else if (node.type === "var") {
        var value = lookup(contextStack, node.name);
        if (value === undefined || value === null) value = "";
        out += node.unescaped ? String(value) : escapeHtml(value);
      } else if (node.type === "section") {
        var sectionValue = lookup(contextStack, node.name);
        if (node.inverted) {
          if (isFalsy(sectionValue)) out += renderNodes(node.children, contextStack);
        } else if (Array.isArray(sectionValue)) {
          for (var j = 0; j < sectionValue.length; j += 1) {
            out += renderNodes(node.children, contextStack.concat([sectionValue[j]]));
          }
        } else if (!isFalsy(sectionValue)) {
          var nextContext = sectionValue === true ? {} : sectionValue;
          out += renderNodes(node.children, contextStack.concat([nextContext]));
        }
      }
    }
    return out;
  }

  // Returns true if the template contains any {{ }} tokens at all — callers
  // use this to skip rendering entirely for plain (non-data-bound) templates.
  function hasPlaceholders(template) {
    TAG_RE.lastIndex = 0;
    return TAG_RE.test(template || "");
  }

  function render(template, data) {
    if (!template) return template;
    var tree = parse(template);
    return renderNodes(tree, [data || {}]);
  }

  // Walks the template and reports every field/section it references, in
  // document order, without needing sample data. Used by Studio to generate
  // a starter JSON skeleton. Returns:
  //   { fields: ["company", "invoiceNo", ...],
  //     sections: [{ name: "items", fields: ["no","name","qty"] }, ...] }
  function scan(template) {
    var tree = parse(template);
    var fields = [];
    var sections = [];

    function walk(nodes, sectionFieldSet) {
      nodes.forEach(function (node) {
        if (node.type === "var") {
          if (sectionFieldSet) {
            sectionFieldSet.add(node.name);
          } else if (fields.indexOf(node.name) === -1) {
            fields.push(node.name);
          }
        } else if (node.type === "section") {
          if (!node.inverted) {
            var fieldSet = new Set();
            walk(node.children, fieldSet);
            sections.push({ name: node.name, fields: Array.from(fieldSet) });
          } else {
            walk(node.children, sectionFieldSet);
          }
        }
      });
    }

    walk(tree, null);
    return { fields: fields, sections: sections };
  }

  var MustacheLite = { render: render, scan: scan, hasPlaceholders: hasPlaceholders, escapeHtml: escapeHtml };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = MustacheLite;
  } else {
    global.MustacheLite = MustacheLite;
  }
})(typeof window !== "undefined" ? window : this);
