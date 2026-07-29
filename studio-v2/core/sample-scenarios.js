import { cloneJson } from "./json.js";

function findArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return null;
  for (const child of Object.values(value)) {
    const found = findArray(child);
    if (found) return found;
  }
  return null;
}

export function createScenario(sampleData, scenario) {
  const data = cloneJson(sampleData);
  const items = findArray(data);
  if (!items) return data;
  if (scenario === "empty") items.splice(0);
  if (["one", "45-rows", "100-rows", "500-rows"].includes(scenario)) {
    const count = scenario === "one" ? 1 : Number.parseInt(scenario, 10);
    const seed = items[0] || {};
    items.splice(0, items.length, ...Array.from({ length: count }, (_, index) => ({ ...cloneJson(seed), no: index + 1, description: seed.description ? `${seed.description} ${index + 1}` : `Generated row ${index + 1}` })));
  }
  if (scenario === "long-text") {
    items.forEach((item, index) => { item.description = `Row ${index + 1}: ${"Long multilingual description 长文本 penerangan panjang ".repeat(8)}`; });
  }
  return data;
}

export const SAMPLE_SCENARIOS = Object.freeze(["default", "empty", "one", "45-rows", "100-rows", "500-rows", "long-text"]);
