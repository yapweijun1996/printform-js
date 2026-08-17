import { stableStringify } from "../core/json.js";
import { currentFontBasePt } from "../core/typography.js";
import { currentBrandColor } from "../core/branding.js";
import { inspectColumnGroups } from "../core/column-inspection.js";
import { inspectPageSettings, inspectRepeatFlags } from "../core/page-inspection.js";
import { applyDataContractEdits, inspectDataContract } from "../core/data-contract-inspection.js";
import { t } from "./ui-i18n.js";

const $ = (selector) => document.querySelector(selector);
const EDITOR_KEYS = ["manifest", "schema", "i18n", "theme", "template", "sampleData"];

function parseSampleValue(type, input) {
  if (type === "boolean") return input.checked;
  if (type === "integer") return Math.trunc(Number(input.value));
  if (type === "number") return Number(input.value);
  return input.value;
}

function parseEnumValue(type, text) {
  const value = text.trim();
  if (!value) return undefined;
  return value.split(",").map((item) => (type === "number" || type === "integer" ? Number(item.trim()) : item.trim()));
}

function renderRepeatFlags(flags) {
  const container = $("#repeat-flags-fields");
  container.replaceChildren();
  flags.forEach((flag) => {
    const label = document.createElement("label");
    label.className = "repeat-flag-card";
    const input = document.createElement("input");
    input.className = "repeat-flag-input";
    input.type = "checkbox"; input.checked = flag.value; input.dataset.attribute = flag.attribute;
    const copy = document.createElement("span");
    copy.className = "repeat-flag-copy";
    copy.textContent = t(`repeatFlag.${flag.key}`);
    const syncState = () => label.classList.toggle("is-checked", input.checked);
    input.addEventListener("change", syncState);
    syncState();
    label.append(input, copy); container.append(label);
  });
  $("#apply-repeat-flags-button").disabled = !flags.length;
}

function renderColumnWidthGroups(groups, onApply) {
  const container = $("#column-widths-groups");
  container.replaceChildren();
  groups.forEach((group) => {
    const wrapper = document.createElement("div"); wrapper.className = "column-widths-group";
    const fields = document.createElement("div"); fields.className = "column-widths-fields";
    group.columns.forEach((column) => {
      const label = document.createElement("label"); label.textContent = column.label;
      const input = document.createElement("input"); input.type = "text"; input.value = column.width; input.placeholder = t("editor.columnWidthPlaceholder");
      label.append(input); fields.append(label);
    });
    const button = document.createElement("button"); button.type = "button"; button.className = "secondary"; button.textContent = t("editor.applyColumnWidths");
    button.addEventListener("click", () => onApply(group.tableSelector, fields));
    wrapper.append(fields, button); container.append(wrapper);
  });
}

function renderDataContractFields(fields, container) {
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    if (field.type === "object") {
      const details = document.createElement("details"); details.className = "dc-group";
      const summary = document.createElement("summary"); summary.textContent = `${field.key}${field.required ? " *" : ""}`;
      const body = document.createElement("div"); body.className = "dc-group-body"; renderDataContractFields(field.fields || [], body);
      details.append(summary, body); container.append(details); return;
    }
    const row = document.createElement("div"); row.className = "dc-field"; row.dataset.path = field.path; row.dataset.type = field.type;
    const name = document.createElement("div"); name.className = "dc-field-name"; name.textContent = `${field.key}${field.required ? " *" : ""}`; row.append(name);
    if (field.type === "array") { const note = document.createElement("span"); note.className = "dc-array-note"; note.textContent = t("editor.dataContractArrayNote"); name.append(note); container.append(row); return; }
    const controls = document.createElement("div"); controls.className = "dc-field-row";
    const requiredLabel = document.createElement("label"); const requiredInput = document.createElement("input"); requiredInput.type = "checkbox"; requiredInput.checked = field.required; requiredInput.dataset.role = "required"; requiredLabel.append(requiredInput, document.createTextNode(t("editor.dataContractRequired"))); controls.append(requiredLabel);
    const sampleInput = document.createElement("input"); sampleInput.dataset.role = "sample";
    if (field.type === "boolean") { sampleInput.type = "checkbox"; sampleInput.checked = Boolean(field.sampleValue); } else { sampleInput.type = ["number", "integer"].includes(field.type) ? "number" : "text"; if (field.type === "integer") sampleInput.step = "1"; sampleInput.value = field.sampleValue ?? ""; }
    const sampleLabel = document.createElement("label"); sampleLabel.append(document.createTextNode(t("editor.dataContractSample")), sampleInput); controls.append(sampleLabel);
    const constraintKeys = field.type === "string" ? ["minLength", "maxLength"] : ["number", "integer"].includes(field.type) ? ["minimum", "maximum"] : [];
    constraintKeys.forEach((key) => { const input = document.createElement("input"); input.type = "number"; input.dataset.role = key; input.value = field.constraints?.[key] ?? ""; const label = document.createElement("label"); label.append(document.createTextNode(t(`editor.dataContract.${key}`)), input); controls.append(label); });
    if (field.type !== "boolean") { const input = document.createElement("input"); input.type = "text"; input.dataset.role = "enum"; input.placeholder = t("editor.dataContractEnumPlaceholder"); input.value = Array.isArray(field.constraints?.enum) ? field.constraints.enum.join(", ") : ""; const label = document.createElement("label"); label.append(document.createTextNode(t("editor.dataContractEnum")), input); controls.append(label); }
    row.append(controls); container.append(row);
  });
}

function renderDataContract(fields) {
  const container = $("#data-contract-fields"); container.replaceChildren(); renderDataContractFields(fields, container); $("#apply-data-contract-button").disabled = !fields.length;
}

function readDataContractOperations(bus) {
  const edits = {};
  $("#data-contract-fields").querySelectorAll('.dc-field[data-path]:not([data-type="array"])').forEach((row) => {
    const type = row.dataset.type; const edit = { required: row.querySelector('[data-role="required"]').checked, sampleValue: parseSampleValue(type, row.querySelector('[data-role="sample"]')) };
    ["minLength", "maxLength", "minimum", "maximum"].forEach((key) => { const input = row.querySelector(`[data-role="${key}"]`); if (input) edit[key] = input.value === "" ? undefined : Number(input.value); });
    const enumInput = row.querySelector('[data-role="enum"]'); if (enumInput) edit.enum = parseEnumValue(type, enumInput.value); edits[row.dataset.path] = edit;
  });
  const next = applyDataContractEdits(bus.project.schema, bus.project.sampleData, edits);
  return [{ type: "replace_schema", value: next.schema }, { type: "replace_sample_data", value: next.sampleData }];
}

export function createEditorPanel({ getBus, onApplyColumnWidths, onApplyDataContract }) {
  const editors = Object.fromEntries(EDITOR_KEYS.map((key) => [key, $(`#${key === "sampleData" ? "sample" : key}-editor`)]));
  function setEditors(project) {
    editors.manifest.value = stableStringify(project.manifest); editors.schema.value = stableStringify(project.schema); editors.i18n.value = stableStringify(project.i18n || {}); editors.theme.value = project.themeCss; editors.template.value = project.templateHtml; editors.sampleData.value = stableStringify(project.sampleData);
    $("#locale-select").value = project.manifest.locale || "en-MY"; $("#revision-label").textContent = t("editor.revision", { revision: getBus().revision }); $("#font-scale-input").value = currentFontBasePt(project.themeCss);
    $("#brand-color-text").value = currentBrandColor(project.themeCss) || ""; $("#brand-color-input").value = /^#[0-9a-fA-F]{6}$/.test(currentBrandColor(project.themeCss) || "") ? currentBrandColor(project.themeCss) : "#000000";
    const groups = inspectColumnGroups(project.templateHtml, project); renderColumnWidthGroups(groups, onApplyColumnWidths);
    const page = inspectPageSettings(project.templateHtml); $("#page-width-input").value = page?.width ?? ""; $("#page-height-input").value = page?.height ?? ""; $("#apply-page-settings-button").disabled = !page;
    renderRepeatFlags(inspectRepeatFlags(project.templateHtml)); renderDataContract(inspectDataContract(project.schema, project.sampleData));
  }
  function refresh() { const bus = getBus(); if (!bus) return; renderColumnWidthGroups(inspectColumnGroups(bus.project.templateHtml, bus.project), onApplyColumnWidths); renderRepeatFlags(inspectRepeatFlags(bus.project.templateHtml)); renderDataContract(inspectDataContract(bus.project.schema, bus.project.sampleData)); }
  function sourceOperations() { return [{ type: "replace_manifest", value: JSON.parse(editors.manifest.value) }, { type: "replace_schema", value: JSON.parse(editors.schema.value) }, { type: "replace_i18n", value: JSON.parse(editors.i18n.value) }, { type: "replace_theme", value: editors.theme.value }, { type: "replace_template", value: editors.template.value }, { type: "replace_sample_data", value: JSON.parse(editors.sampleData.value) }]; }
  function dataContractOperations() { return readDataContractOperations(getBus()); }
  return { editors, setEditors, refresh, sourceOperations, dataContractOperations };
}
