// Per-type definitions for the `operations` array accepted by preview_changes
// / apply_changes. This is the operation SSOT: the validator, catalog and
// examples all read from this table, so the model cannot be shown a shape
// that the command bus rejects.
import { FONT_BASE_MAX_PT, FONT_BASE_MIN_PT } from "./typography.js";

const objectSchema = (properties, required) => ({ type: "object", properties, required, additionalProperties: false });
const anyValue = {};
const nonEmptyString = { type: "string", minLength: 1 };
const slotName = { type: "string", pattern: "^[a-z][a-z0-9-]*$" };
// "" or "auto" clears/leaves a column unconstrained — real templates in this
// repo deliberately leave one column (e.g. a description column) without an
// explicit width so it absorbs whatever space the fixed-width columns don't
// use; the tool must be able to express that, not force every column rigid.
const widthValue = { type: "string", pattern: "^$|^auto$|^\\d+(\\.\\d+)?(%|px|mm|pt)$" };
const hexColor = { type: "string", pattern: "^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$" };

export const OPERATION_DEFINITIONS = Object.freeze({
  set_manifest_value: {
    description: "Set one JSON manifest value by pointer path.", risk: "medium",
    schema: objectSchema({ type: nonEmptyString, path: nonEmptyString, value: anyValue }, ["type", "path", "value"]),
    example: { type: "set_manifest_value", path: "/title", value: "Updated print title" }
  },
  replace_manifest: {
    description: "Replace the complete manifest object.", risk: "high",
    schema: objectSchema({ type: nonEmptyString, value: { type: "object" } }, ["type", "value"]),
    example: { type: "replace_manifest", value: { title: "Invoice", locale: "en-MY" } }
  },
  replace_schema: {
    description: "Replace the complete JSON data contract schema.", risk: "high",
    schema: objectSchema({ type: nonEmptyString, value: { type: "object" } }, ["type", "value"]),
    example: { type: "replace_schema", value: { type: "object", properties: {} } }
  },
  replace_i18n: {
    description: "Replace the complete translation catalog.", risk: "high",
    schema: objectSchema({ type: nonEmptyString, value: { type: "object" } }, ["type", "value"]),
    example: { type: "replace_i18n", value: {} }
  },
  replace_sample_data: {
    description: "Replace synthetic sample data used for preview validation.", risk: "high",
    schema: objectSchema({ type: nonEmptyString, value: { type: "object" } }, ["type", "value"]),
    example: { type: "replace_sample_data", value: { items: [] } }
  },
  replace_theme: {
    description: "Replace the stylesheet used by the isolated print document.", risk: "high",
    schema: objectSchema({ type: nonEmptyString, value: { type: "string" } }, ["type", "value"]),
    example: { type: "replace_theme", value: "#pf-mount { color: #173d9a; }" }
  },
  replace_template: {
    description: "Replace the complete declarative print template.", risk: "high",
    schema: objectSchema({ type: nonEmptyString, value: { type: "string" } }, ["type", "value"]),
    example: { type: "replace_template", value: "<div class=\"printform\"></div>" }
  },
  set_asset_slot: {
    description: "Set one named declarative image asset slot.", risk: "medium",
    schema: objectSchema({ type: nonEmptyString, slot: slotName, source: nonEmptyString }, ["type", "slot", "source"]),
    example: { type: "set_asset_slot", slot: "letterhead-logo", source: "data:image/png;base64,placeholder" }
  },
  set_text: {
    description: "Replace textContent for one uniquely selected template element.", risk: "medium",
    schema: objectSchema({ type: nonEmptyString, selector: nonEmptyString, value: anyValue }, ["type", "selector", "value"]),
    example: { type: "set_text", selector: "h1.pf-brand", value: "Company name" }
  },
  // value is intentionally NOT required: applyOperation treats a present-but-null
  // value as "remove the attribute" and an absent value as String(undefined) —
  // both are existing, exercised behaviors this schema must not break.
  set_attribute: {
    description: "Set or remove one attribute on a uniquely selected element.", risk: "medium",
    schema: objectSchema({ type: nonEmptyString, selector: nonEmptyString, name: nonEmptyString, value: anyValue }, ["type", "selector", "name"]),
    example: { type: "set_attribute", selector: "h1.pf-brand", name: "data-layout-note", value: "brand" }
  },
  // High-level semantic tools (ROADMAP.md E8): one call instead of N raw
  // set_attribute/set_text edits for a whole table or the print type scale.
  set_column_widths: {
    description: "Set all column widths for a semantic print table group.", risk: "low",
    schema: objectSchema({
      type: nonEmptyString,
      tableSelector: nonEmptyString,
      widths: { type: "array", minItems: 1, items: widthValue }
    }, ["type", "tableSelector", "widths"]),
    example: { type: "set_column_widths", tableSelector: ".prowheader, .prowitem", widths: ["7%", "48%", "11%", "16%", "18%"] }
  },
  set_font_scale: {
    description: "Set the document base print font size in points.", risk: "low",
    schema: objectSchema({
      type: nonEmptyString,
      basePt: { type: "number", minimum: FONT_BASE_MIN_PT, maximum: FONT_BASE_MAX_PT }
    }, ["type", "basePt"]),
    example: { type: "set_font_scale", basePt: 9 }
  },
  set_brand_color: {
    description: "Set the semantic PrintForm brand color.", risk: "low",
    schema: objectSchema({ type: nonEmptyString, hex: hexColor }, ["type", "hex"]),
    example: { type: "set_brand_color", hex: "#173d9a" }
  }
});

export const OPERATION_SCHEMAS = Object.freeze(Object.fromEntries(
  Object.entries(OPERATION_DEFINITIONS).map(([type, definition]) => [type, definition.schema])
));
