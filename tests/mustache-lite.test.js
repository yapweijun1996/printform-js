import { describe, it, expect, beforeAll } from "vitest";

// studio/mustache-lite.js is a UMD-style script (module.exports when CJS is
// present, else window.MustacheLite) with no ESM export — Node/Vite's
// CJS interop surfaces it as the default export of a dynamic import.
let MustacheLite;
beforeAll(async () => {
  const mod = await import("../studio/mustache-lite.js");
  MustacheLite = mod.default;
});

describe("mustache-lite escaping", () => {
  it("escapes single quotes and backticks in addition to & < > \"", () => {
    // Regression: an escaped {{field}} placed inside a single-quoted HTML
    // attribute (alt='{{name}}') could break out of the attribute if ' were
    // left unescaped — see studio-v2/core/project-model.js CSP notes for the
    // same class of bug in the exported-package escaper.
    expect(MustacheLite.escapeHtml("x' onerror='alert(1)")).toBe("x&#39; onerror=&#39;alert(1)");
    expect(MustacheLite.escapeHtml("`cmd`")).toBe("&#96;cmd&#96;");
    expect(MustacheLite.escapeHtml('&<>"')).toBe("&amp;&lt;&gt;&quot;");
  });

  it("renders an attribute-embedded field safely even with a quote-breakout payload", () => {
    const html = MustacheLite.render("<img alt='{{name}}'>", { name: "x' onerror='alert(1)" });
    expect(html).toBe("<img alt='x&#39; onerror=&#39;alert(1)'>");
  });
});

describe("mustache-lite strict section matching", () => {
  it("throws on a mismatched closing tag instead of silently reshuffling blocks", () => {
    // {{#items}} closed with the wrong name (a typo like {{/item}}) must not
    // silently pop the open section and continue — that reorders/loses
    // content with no diagnostic.
    expect(() => MustacheLite.render("{{#items}}x{{/item}}", {})).toThrow(/Mismatched closing tag/);
  });

  it("throws on an unclosed section", () => {
    expect(() => MustacheLite.render("{{#a}}x", {})).toThrow(/Unclosed section/);
  });

  it("throws on a stray closing tag with no open section", () => {
    expect(() => MustacheLite.render("x{{/a}}", {})).toThrow(/Unexpected closing tag/);
  });

  it("still renders correctly nested sections", () => {
    const html = MustacheLite.render("{{#a}}{{#b}}{{x}}{{/b}}{{/a}}", { a: true, b: true, x: "ok" });
    expect(html).toBe("ok");
  });
});
