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

describe("set_column_widths (high-level semantic tool)", () => {
  function projectWithTable() {
    const project = createEmptyProject();
    project.templateHtml = `<div class="printform"><table class="pf-items"><thead><tr><th>No</th><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>1</td><td>Widget</td><td>10.00</td></tr><tr><td>2</td><td>Gadget</td><td>20.00</td></tr></tbody></table></div>`;
    return project;
  }

  // Matches the real shape used by studio-v2/samples/*: a .prowheader table
  // (one header row) and a sibling .prowitem table (one repeating row
  // template) rather than thead+tbody inside a single <table>.
  function projectWithSplitHeaderAndRowTables() {
    const project = createEmptyProject();
    project.templateHtml = `<div class="printform">
      <table class="prowheader pf-grid"><thead><tr><th style="width:7%">No</th><th>Description</th><th style="width:18%">Amount</th></tr></thead></table>
      <table class="prowitem pf-grid" data-pf-each="/items"><tbody><tr><td style="width:7%">1</td><td>Widget</td><td style="width:18%">10.00</td></tr></tbody></table>
    </div>`;
    return project;
  }

  it("applies each width to the matching column across every row, header and body alike", () => {
    const candidate = applyOperations(projectWithTable(), [
      { type: "set_column_widths", tableSelector: ".pf-items", widths: ["10%", "70%", "20%"] }
    ]);
    const table = document.createElement("template");
    table.innerHTML = candidate.templateHtml;
    const rows = Array.from(table.content.querySelectorAll("tr"));
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      const widths = Array.from(row.cells).map((cell) => cell.style.width);
      expect(widths).toEqual(["10%", "70%", "20%"]);
    });
  });

  it("keeps a comma-separated selector's separate header/row tables in sync in one call", () => {
    const candidate = applyOperations(projectWithSplitHeaderAndRowTables(), [
      { type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["9%", "73%", "18%"] }
    ]);
    const doc = document.createElement("template");
    doc.innerHTML = candidate.templateHtml;
    const headerWidths = Array.from(doc.content.querySelector(".prowheader tr").cells).map((cell) => cell.style.width);
    const rowWidths = Array.from(doc.content.querySelector(".prowitem tr").cells).map((cell) => cell.style.width);
    expect(headerWidths).toEqual(["9%", "73%", "18%"]);
    expect(rowWidths).toEqual(["9%", "73%", "18%"]);
  });

  it("accepts an empty string or 'auto' to leave a column unconstrained (e.g. a flexible description column)", () => {
    const candidate = applyOperations(projectWithTable(), [
      { type: "set_column_widths", tableSelector: ".pf-items", widths: ["10%", "", "auto"] }
    ]);
    const table = document.createElement("template");
    table.innerHTML = candidate.templateHtml;
    const firstRowWidths = Array.from(table.content.querySelector("tr").cells).map((cell) => cell.style.width);
    expect(firstRowWidths[0]).toBe("10%");
    expect(firstRowWidths[1]).toBe("");
  });

  it("rejects a widths array whose length does not match the table's column count", () => {
    expect(() => applyOperations(projectWithTable(), [
      { type: "set_column_widths", tableSelector: ".pf-items", widths: ["50%", "50%"] }
    ])).toThrowError(expect.objectContaining({ code: "COLUMN_WIDTHS_COUNT_MISMATCH" }));
  });

  it("rejects a selector that matches no <table> element at all", () => {
    const project = projectWithTable();
    expect(() => applyOperations(project, [
      { type: "set_column_widths", tableSelector: ".pf-items thead", widths: ["1%"] }
    ])).toThrowError(expect.objectContaining({ code: "COLUMN_WIDTHS_TARGET_INVALID" }));
  });

  it("rejects a width value with no recognized unit at the schema level", () => {
    expect(() => applyOperations(projectWithTable(), [
      { type: "set_column_widths", tableSelector: ".pf-items", widths: ["10%", "big", "20%"] }
    ])).toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
  });
});

describe("set_font_scale (high-level semantic tool)", () => {
  it("shifts the whole 7-step type scale from the new base, replacing the prior injection in place", () => {
    const project = createEmptyProject();
    expect(project.themeCss).toContain("--pf-font-default: 9pt");
    const candidate = applyOperations(project, [{ type: "set_font_scale", basePt: 11 }]);
    expect(candidate.themeCss).toContain("--pf-font-default: 11pt");
    expect(candidate.themeCss).toContain("--pf-font-minus-3: 8pt");
    expect(candidate.themeCss).toContain("--pf-font-plus-3: 14pt");
    // Exactly one injected block, not a second copy alongside the old one.
    expect(candidate.themeCss.match(/PrintForm type scale:/g)).toHaveLength(1);
    // The rest of the theme (color, font-family) survives untouched.
    expect(candidate.themeCss).toContain("color: #111");
  });

  it("rejects a base size outside the supported 6-14pt range", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [{ type: "set_font_scale", basePt: 20 }]))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
    expect(() => applyOperations(project, [{ type: "set_font_scale", basePt: 2 }]))
      .toThrowError(expect.objectContaining({ code: "INVALID_OPERATION_SHAPE" }));
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
