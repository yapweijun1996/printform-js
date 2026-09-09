import { getFormSpec } from "./form-spec.js";

const BASE_OPTIONS = Object.freeze([
  { value: "all", label: "All sections", selection: "Entire document", scope: { kind: "document" } },
  { value: "layout", label: "Layout & typography", selection: "Layout & typography", scope: { kind: "layout" } },
  { value: "theme", label: "Theme & brand", selection: "Theme & brand", scope: { kind: "theme" } },
]);

export function getAgentScopeOptions(project) {
  const components = getFormSpec(project || {}).components || [];
  const tableIds = [...new Set(components
    .filter((component) => component?.role === "table-header" || component?.role === "table-row")
    .map((component) => component.tableId || "default"))];
  const tableOptions = tableIds.map((tableId) => ({
    value: tableIds.length === 1 && tableId === "default" ? "table" : `table:${tableId}`,
    label: `Table ${tableId}`,
    selection: `Table ${tableId}`,
    scope: { kind: "table", tableId },
  }));
  const componentOptions = components.filter((component) => component?.id).map((component) => {
    const role = component.role ? ` (${component.role})` : "";
    const label = `${component.type || "Component"}${role}`;
    return {
      value: `component:${component.id}`,
      label: `Component ${label}`,
      selection: `${label} [${component.id}]`,
      scope: { kind: "component", componentId: component.id },
    };
  });
  return [...BASE_OPTIONS.slice(0, 2), ...tableOptions, ...componentOptions, BASE_OPTIONS[2]].map((option) => ({
    ...option,
    scope: { ...option.scope },
  }));
}
