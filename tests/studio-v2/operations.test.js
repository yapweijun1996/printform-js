import { describe, it, expect } from "vitest";
import { applyOperations, sanitizeExecutableContent } from "../../studio-v2/core/operations.js";
import { createEmptyProject } from "../../studio-v2/core/project-model.js";
import { TRUST } from "../../studio-v2/core/constants.js";

describe("setJsonPath prototype-pollution guard", () => {
  it("rejects a __proto__ path segment instead of walking into Object.prototype", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [
      { type: "set_manifest_value", path: "/__proto__/polluted", value: true }
    ])).toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_PATH" }));
    expect({}.polluted).toBeUndefined();
  });

  it("rejects constructor and prototype segments at any depth", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [
      { type: "set_manifest_value", path: "/assets/constructor/polluted", value: true }
    ])).toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_PATH" }));
    expect(() => applyOperations(project, [
      { type: "set_manifest_value", path: "/a/prototype/b", value: true }
    ])).toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_PATH" }));
    expect({}.polluted).toBeUndefined();
  });

  it("still allows ordinary nested paths, creating intermediate objects", () => {
    const project = createEmptyProject();
    const candidate = applyOperations(project, [
      { type: "set_manifest_value", path: "/assets/allowExternalHttps", value: true }
    ]);
    expect(candidate.manifest.assets.allowExternalHttps).toBe(true);
  });
});

describe("themeCss </style> breakout demotes trust", () => {
  it("flags a theme payload that closes </style> early and opens a <script>", () => {
    const project = createEmptyProject();
    const candidate = applyOperations(project, [
      { type: "replace_theme", value: "}</style><script>alert(1)</script><style>{" }
    ]);
    expect(candidate.trust).toBe(TRUST.untrusted);
  });

  it("keeps ordinary CSS trusted", () => {
    const project = createEmptyProject();
    const candidate = applyOperations(project, [
      { type: "replace_theme", value: "#pf-mount { color: red; }" }
    ]);
    expect(candidate.trust).toBe(TRUST.trusted);
  });
});

describe("operation shape validation (discriminated union by type)", () => {
  it("rejects an extra field a client made up, for a known operation type", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [
      { type: "set_manifest_value", path: "/title", value: "x", bogusExtraField: 1 }
    ])).toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
  });

  it("rejects a known operation type missing a required field", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [{ type: "set_manifest_value", path: "/title" }]))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
    expect(() => applyOperations(project, [{ type: "set_asset_slot", slot: "logo" }]))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
  });

  it("rejects a field with the wrong JSON type instead of coercing it", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [{ type: "set_manifest_value", path: 123, value: "x" }]))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
    expect(() => applyOperations(project, [{ type: "replace_theme", value: { not: "a string" } }]))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
  });

  it("rejects an asset slot name that does not match the documented pattern", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [{ type: "set_asset_slot", slot: "Not-Valid!", source: "/x.png" }]))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
  });

  it("still reports an entirely unknown operation type as UNSUPPORTED_OPERATION, not a shape error", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [{ type: "delete_everything", value: 1 }]))
      .toThrowError(expect.objectContaining({ code: "UNSUPPORTED_OPERATION" }));
  });

  it("accepts a well-formed set_text operation and applies it", () => {
    const project = createEmptyProject();
    const candidate = applyOperations(project, [{ type: "set_text", selector: "h1", value: "New Title" }]);
    expect(candidate.templateHtml).toContain("New Title");
  });

  it("rejects set_attribute missing its required name field", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [{ type: "set_attribute", selector: "h1", value: "x" }]))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
  });

  it("accepts set_attribute with a null value (existing remove-attribute behavior)", () => {
    const project = createEmptyProject();
    project.templateHtml = '<div class="printform"><h1 data-pf-text="/title" title="x"></h1></div>';
    const candidate = applyOperations(project, [{ type: "set_attribute", selector: "h1", name: "title", value: null }]);
    expect(candidate.templateHtml).not.toContain("title=");
  });
});

describe("sanitizeExecutableContent", () => {
  it("strips <script>, on* handlers and javascript: URLs from the template", () => {
    const dirty = {
      templateHtml: '<div class="printform" onclick="x()"><script>evil()</script><a href="javascript:alert(1)">x</a></div>',
      themeCss: ""
    };
    const sanitized = sanitizeExecutableContent(dirty);
    expect(sanitized.templateHtml).not.toMatch(/<script/i);
    expect(sanitized.templateHtml).not.toMatch(/onclick/i);
    expect(sanitized.templateHtml).not.toMatch(/javascript:/i);
  });

  it("strips </style> and <script> tags from the theme without leaving a dangling close tag", () => {
    const dirty = { templateHtml: "", themeCss: "}</style><script>y</script><style>{ body{color:red} }" };
    const sanitized = sanitizeExecutableContent(dirty);
    expect(sanitized.themeCss).not.toMatch(/<\/?(script|style)/i);
  });

  it("re-trusting after sanitization no longer demotes on the next operation", () => {
    const dirty = createEmptyProject();
    dirty.templateHtml = '<div class="printform"><script>evil()</script></div>';
    dirty.themeCss = "}</style><script>y</script>";
    const sanitized = sanitizeExecutableContent(dirty);
    const resetProject = { ...dirty, ...sanitized, trust: TRUST.trusted };
    const candidate = applyOperations(resetProject, [
      { type: "set_manifest_value", path: "/title", value: "Clean again" }
    ]);
    expect(candidate.trust).toBe(TRUST.trusted);
  });
});
