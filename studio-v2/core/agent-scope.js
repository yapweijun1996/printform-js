import { findComponent } from "./form-spec.js";

const SCOPE_KINDS = new Set(["document", "layout", "theme", "table", "component"]);
const THEME_OPERATIONS = new Set(["set_brand_color"]);
const LAYOUT_OPERATIONS = new Set(["set_font_scale", "set_column_widths", "update_component", "set_pagination_rule"]);
const TABLE_OPERATIONS = new Set(["set_column_widths", "update_component", "bind_field", "set_pagination_rule"]);
const COMPONENT_OPERATIONS = new Set(["update_component", "bind_field", "set_pagination_rule"]);
const LAYOUT_COMPONENT_PATCHES = new Set(["keepTogether", "styleToken"]);

export function normalizeScope(scope) {
  if (scope === undefined) scope = { kind: "document" };
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) throw scopeFailure();
  const kind = scope.kind;
  if (!SCOPE_KINDS.has(kind)) throw scopeFailure();
  const normalized = {
    kind,
    id: scope?.id == null ? null : String(scope.id),
    tableId: scope?.tableId == null ? null : String(scope.tableId),
    tableSelector: scope?.tableSelector == null ? null : String(scope.tableSelector),
    componentId: scope?.componentId == null ? null : String(scope.componentId),
  };
  if (kind === "table" && !normalized.tableId && !normalized.tableSelector) throw scopeFailure();
  if (kind === "component" && !normalized.componentId) throw scopeFailure();
  return Object.freeze(normalized);
}

function scopeFailure() {
  return Object.assign(new Error("The operation is outside the active Agent scope"), { code: "SCOPE_VIOLATION" });
}

function componentFor(project, id) {
  return findComponent(project, id);
}

function tableIdentity(node) {
  return node?.getAttribute?.("data-pf-table-id") || node?.getAttribute?.("data-pf-table") || "default";
}

function matchingTableIds(project, selector) {
  if (typeof document === "undefined") return new Set();
  const template = document.createElement("template");
  template.innerHTML = String(project?.templateHtml || "");
  let nodes;
  try { nodes = Array.from(template.content.querySelectorAll(selector)); }
  catch { return new Set(); }
  const tables = nodes.filter((node) => node.tagName === "TABLE");
  return tables.length ? new Set(tables.map(tableIdentity)) : new Set();
}

function selectorTargetsTable(project, selector, tableId) {
  const tableIds = matchingTableIds(project, selector);
  return tableIds.size === 1 && tableIds.has(tableId);
}

function selectorTargetsSingleTable(project, selector) {
  return matchingTableIds(project, selector).size === 1;
}

function assertComponentMutation(scope, operation, project) {
  if (!["update_component", "bind_field", "set_pagination_rule"].includes(operation.type)) return;
  const component = componentFor(project, operation.componentId);
  if (!component) throw scopeFailure();
  const componentTableId = component.tableId || "default";
  if (scope.kind === "table" && componentTableId !== scope.tableId) throw scopeFailure();
  if (operation.type !== "update_component") return;
  const patch = operation.patch || {};
  if (Object.prototype.hasOwnProperty.call(patch, "tableId") && String(patch.tableId) !== componentTableId) throw scopeFailure();
  if (scope.kind === "layout" && Object.keys(patch).some((key) => !LAYOUT_COMPONENT_PATCHES.has(key))) throw scopeFailure();
}

function assertTarget(scope, operation, project) {
  if (scope.kind === "document") return;
  const type = operation.type;
  if (scope.kind === "theme" && !THEME_OPERATIONS.has(type)) throw scopeFailure();
  if (scope.kind === "layout" && !LAYOUT_OPERATIONS.has(type)) throw scopeFailure();
  if (scope.kind === "table") {
    if (!TABLE_OPERATIONS.has(type)) throw scopeFailure();
    if (!scope.tableId && !scope.tableSelector) throw scopeFailure();
    if (type === "set_column_widths") {
      if (scope.tableSelector && (
        operation.tableSelector !== scope.tableSelector ||
        !selectorTargetsSingleTable(project, operation.tableSelector)
      )) throw scopeFailure();
      if (scope.tableId && !selectorTargetsTable(project, operation.tableSelector, scope.tableId)) throw scopeFailure();
    }
    if (type !== "set_column_widths") {
      if (!scope.tableId) throw scopeFailure();
    }
  }
  if (scope.kind === "component") {
    if (!COMPONENT_OPERATIONS.has(type) || operation.componentId !== scope.componentId) throw scopeFailure();
  }
  assertComponentMutation(scope, operation, project);
}

export function assertOperationsInScope(project, operations, scope = { kind: "document" }) {
  const normalized = normalizeScope(scope);
  if (!Array.isArray(operations)) throw Object.assign(new Error("Operations must be an array"), { code: "INVALID_OPERATION_SET" });
  operations.forEach((operation) => assertTarget(normalized, operation || {}, project));
  return normalized;
}

export function scopeFingerprint(scope) {
  const value = normalizeScope(scope);
  return JSON.stringify(value);
}

export function scopeError() {
  return scopeFailure();
}
