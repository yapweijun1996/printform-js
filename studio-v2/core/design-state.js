import { inspectColumnGroups } from "./column-inspection.js";
import { inspectPageSettings, inspectRepeatFlags } from "./page-inspection.js";
import { currentBrandColor } from "./branding.js";
import { currentFontBasePt } from "./typography.js";
import { OPERATION_SCHEMAS } from "./operation-schemas.js";

function inspectAssets(templateHtml) {
  const template = document.createElement("template");
  template.innerHTML = templateHtml || "";
  const slots = new Map();
  template.content.querySelectorAll("[data-pf-asset-slot]").forEach((node) => {
    const slot = node.getAttribute("data-pf-asset-slot");
    if (!slot || slots.has(slot)) return;
    slots.set(slot, { slot, configured: Boolean(node.getAttribute("src")?.trim()) });
  });
  return Array.from(slots.values());
}

export function inspectDesignState(project) {
  const page = inspectPageSettings(project.templateHtml);
  const repeatFlags = inspectRepeatFlags(project.templateHtml);
  return {
    revision: project.revision ?? null,
    page: page ? { width: page.width, height: page.height } : null,
    typography: { basePt: currentFontBasePt(project.themeCss) },
    branding: { primaryColor: currentBrandColor(project.themeCss) },
    tables: inspectColumnGroups(project.templateHtml, project),
    repeatedAreas: Object.fromEntries(repeatFlags.map(({ key, value }) => [key, value])),
    assets: inspectAssets(project.templateHtml),
    supportedOperations: Object.keys(OPERATION_SCHEMAS)
  };
}
