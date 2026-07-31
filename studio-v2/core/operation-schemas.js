// Per-type shapes for the `operations` array accepted by preview_changes /
// apply_changes. A discriminated union keyed by `operation.type`: each
// schema's `additionalProperties: false` rejects extra fields, and
// `required` rejects missing ones, using the SAME restricted JSON Schema
// engine (core/schema.js) already used to validate project sample data —
// no second validation engine, no drift between the two.
const objectSchema = (properties, required) => ({ type: "object", properties, required, additionalProperties: false });
const anyValue = {};
const nonEmptyString = { type: "string", minLength: 1 };
const slotName = { type: "string", pattern: "^[a-z][a-z0-9-]*$" };

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
  set_attribute: objectSchema({ type: nonEmptyString, selector: nonEmptyString, name: nonEmptyString, value: anyValue }, ["type", "selector", "name"])
});
