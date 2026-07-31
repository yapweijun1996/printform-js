// Per-type shapes for the `operations` array accepted by preview_changes /
// apply_changes. A discriminated union keyed by `operation.type`: each
// schema's `additionalProperties: false` rejects extra fields, and
// `required` rejects missing ones, using the SAME restricted JSON Schema
// engine (core/schema.js) already used to validate project sample data —
// no second validation engine, no drift between the two.
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

export const OPERATION_SCHEMAS = Object.freeze({
  set_manifest_value: objectSchema({ type: nonEmptyString, path: nonEmptyString, value: anyValue }, ["type", "path", "value"]),
  replace_manifest: objectSchema({ type: nonEmptyString, value: { type: "object" } }, ["type", "value"]),
  replace_schema: objectSchema({ type: nonEmptyString, value: { type: "object" } }, ["type", "value"]),
  replace_i18n: objectSchema({ type: nonEmptyString, value: { type: "object" } }, ["type", "value"]),
  replace_sample_data: objectSchema({ type: nonEmptyString, value: { type: "object" } }, ["type", "value"]),
  replace_theme: objectSchema({ type: nonEmptyString, value: { type: "string" } }, ["type", "value"]),
  replace_template: objectSchema({ type: nonEmptyString, value: { type: "string" } }, ["type", "value"]),
  set_asset_slot: objectSchema({ type: nonEmptyString, slot: slotName, source: nonEmptyString }, ["type", "slot", "source"]),
  set_text: objectSchema({ type: nonEmptyString, selector: nonEmptyString, value: anyValue }, ["type", "selector", "value"]),
  // value is intentionally NOT required: applyOperation treats a present-but-null
  // value as "remove the attribute" and an absent value as String(undefined) —
  // both are existing, exercised behaviors this schema must not break.
  set_attribute: objectSchema({ type: nonEmptyString, selector: nonEmptyString, name: nonEmptyString, value: anyValue }, ["type", "selector", "name"]),
  // High-level semantic tools (ROADMAP.md E8): one call instead of N raw
  // set_attribute/set_text edits for a whole table or the print type scale.
  set_column_widths: objectSchema({
    type: nonEmptyString,
    tableSelector: nonEmptyString,
    widths: { type: "array", minItems: 1, items: widthValue }
  }, ["type", "tableSelector", "widths"]),
  set_font_scale: objectSchema({
    type: nonEmptyString,
    basePt: { type: "number", minimum: FONT_BASE_MIN_PT, maximum: FONT_BASE_MAX_PT }
  }, ["type", "basePt"]),
  set_brand_color: objectSchema({ type: nonEmptyString, hex: hexColor }, ["type", "hex"])
});
