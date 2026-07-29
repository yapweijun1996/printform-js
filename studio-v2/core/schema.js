const ANNOTATIONS = new Set(["$schema", "$id", "title", "description", "default", "examples"]);
const SUPPORTED = new Set([
  ...ANNOTATIONS, "type", "properties", "required", "items", "enum", "const",
  "minLength", "maxLength", "pattern", "format", "minimum", "maximum",
  "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minItems", "maxItems",
  "uniqueItems", "additionalProperties"
]);
const TYPES = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);

function issue(code, path, message, keyword, severity = "error") {
  return { code, path: path || "/", message, keyword, severity };
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function matchesType(value, expected) {
  const actual = valueType(value);
  if (expected === "number") return actual === "number" || actual === "integer";
  return actual === expected;
}

function validateFormat(value, format) {
  if (format === "date") return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
  if (format === "date-time") return !Number.isNaN(Date.parse(value));
  if (format === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === "uri") {
    try { return Boolean(new URL(value)); } catch { return false; }
  }
  return false;
}

function inspectSchema(schema, path, errors) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    errors.push(issue("INVALID_SCHEMA", path, "Schema node must be an object", "schema"));
    return;
  }
  Object.keys(schema).forEach((keyword) => {
    if (!SUPPORTED.has(keyword)) errors.push(issue("UNSUPPORTED_SCHEMA_KEYWORD", path, `Unsupported keyword: ${keyword}`, keyword));
  });
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  types.forEach((type) => {
    if (!TYPES.has(type)) errors.push(issue("UNSUPPORTED_SCHEMA_TYPE", path, `Unsupported type: ${type}`, "type"));
  });
  if (schema.properties) Object.entries(schema.properties).forEach(([key, child]) => inspectSchema(child, `${path}/properties/${key}`, errors));
  if (schema.items) inspectSchema(schema.items, `${path}/items`, errors);
  if (schema.format && !["date", "date-time", "email", "uri"].includes(schema.format)) {
    errors.push(issue("UNSUPPORTED_SCHEMA_FORMAT", path, `Unsupported format: ${schema.format}`, "format"));
  }
}

function validateValue(schema, value, path, errors) {
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => matchesType(value, type))) {
    errors.push(issue("TYPE_MISMATCH", path, `Expected ${types.join(" or ")}, received ${valueType(value)}`, "type"));
    return;
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(issue("CONST_MISMATCH", path, "Value does not match const", "const"));
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) errors.push(issue("ENUM_MISMATCH", path, "Value is not in enum", "enum"));
  if (typeof value === "string") validateString(schema, value, path, errors);
  if (typeof value === "number") validateNumber(schema, value, path, errors);
  if (Array.isArray(value)) validateArray(schema, value, path, errors);
  if (value && typeof value === "object" && !Array.isArray(value)) validateObject(schema, value, path, errors);
}

function validateString(schema, value, path, errors) {
  if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(issue("MIN_LENGTH", path, `Minimum length is ${schema.minLength}`, "minLength"));
  if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(issue("MAX_LENGTH", path, `Maximum length is ${schema.maxLength}`, "maxLength"));
  if (schema.pattern) {
    try { if (!new RegExp(schema.pattern, "u").test(value)) errors.push(issue("PATTERN", path, "Value does not match pattern", "pattern")); }
    catch { errors.push(issue("INVALID_PATTERN", path, "Schema pattern is invalid", "pattern")); }
  }
  if (schema.format && !validateFormat(value, schema.format)) errors.push(issue("FORMAT", path, `Value is not a valid ${schema.format}`, "format"));
}

function validateNumber(schema, value, path, errors) {
  if (schema.minimum !== undefined && value < schema.minimum) errors.push(issue("MINIMUM", path, `Minimum is ${schema.minimum}`, "minimum"));
  if (schema.maximum !== undefined && value > schema.maximum) errors.push(issue("MAXIMUM", path, `Maximum is ${schema.maximum}`, "maximum"));
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) errors.push(issue("EXCLUSIVE_MINIMUM", path, `Must exceed ${schema.exclusiveMinimum}`, "exclusiveMinimum"));
  if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) errors.push(issue("EXCLUSIVE_MAXIMUM", path, `Must be below ${schema.exclusiveMaximum}`, "exclusiveMaximum"));
  if (schema.multipleOf && Math.abs(value / schema.multipleOf - Math.round(value / schema.multipleOf)) > 1e-9) errors.push(issue("MULTIPLE_OF", path, `Must be a multiple of ${schema.multipleOf}`, "multipleOf"));
}

function validateArray(schema, value, path, errors) {
  if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(issue("MIN_ITEMS", path, `Minimum items is ${schema.minItems}`, "minItems"));
  if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(issue("MAX_ITEMS", path, `Maximum items is ${schema.maxItems}`, "maxItems"));
  if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(issue("UNIQUE_ITEMS", path, "Items must be unique", "uniqueItems"));
  if (schema.items) value.forEach((item, index) => validateValue(schema.items, item, `${path}/${index}`, errors));
}

function validateObject(schema, value, path, errors) {
  (schema.required || []).forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(issue("REQUIRED", `${path}/${key}`, `Required property is missing: ${key}`, "required"));
  });
  Object.entries(value).forEach(([key, child]) => {
    if (schema.properties && schema.properties[key]) validateValue(schema.properties[key], child, `${path}/${key}`, errors);
    else if (schema.additionalProperties === false) errors.push(issue("ADDITIONAL_PROPERTY", `${path}/${key}`, `Unexpected property: ${key}`, "additionalProperties"));
    else if (schema.additionalProperties && typeof schema.additionalProperties === "object") validateValue(schema.additionalProperties, child, `${path}/${key}`, errors);
  });
}

export function validateSchemaProfile(schema) {
  const errors = [];
  inspectSchema(schema, "#", errors);
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function validateData(schema, data) {
  const profile = validateSchemaProfile(schema);
  if (!profile.valid) return profile;
  const errors = [];
  validateValue(schema, data, "", errors);
  return { valid: errors.length === 0, errors, warnings: [] };
}
