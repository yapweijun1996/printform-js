import { describe, expect, it } from "vitest";
import { parseProjectHtml, serializeStandalone, verifyImportedProject } from "../../studio-v2/core/project-model.js";
import { validateProject } from "../../studio-v2/core/acceptance.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("PrintForm v2 single HTML protocol", () => {
  it("round-trips every authoritative section", async () => {
    const project = createSalesInvoiceProject();
    const validation = validateProject(project);
    const html = await serializeStandalone(project, { documentRuntime: "window.runtimeLoaded=true;", printform: "window.printformLoaded=true;", runtimeVersion: "2.0.0" }, validation);
    const parsed = parseProjectHtml(html);
    expect(parsed.manifest).toEqual(project.manifest);
    expect(parsed.schema).toEqual(project.schema);
    expect(parsed.i18n).toEqual(project.i18n);
    expect(parsed.sampleData.items).toHaveLength(45);
    expect(parsed.templateHtml).toContain("data-pf-each=\"/items\"");
    expect(parsed.trust).toBe("trusted");
    expect(parsed.attestation.result).toBe("pass");
  });

  it("downgrades files containing engineer scripts", async () => {
    const project = createSalesInvoiceProject();
    const html = await serializeStandalone({ ...project, trust: "untrusted", customScripts: ["<script>window.custom=true<\\/script>"] }, { documentRuntime: "", printform: "", runtimeVersion: "2.0.0" }, validateProject(project), { trusted: false });
    expect(parseProjectHtml(html).trust).toBe("untrusted");
  });

  it("verifies trusted hashes and detects manual edits", async () => {
    const project = createSalesInvoiceProject();
    const html = await serializeStandalone(project, { documentRuntime: "window.runtimeLoaded=true;", printform: "window.printformLoaded=true;", runtimeVersion: "2.0.0" }, validateProject(project));
    const parsed = parseProjectHtml(html);
    expect((await verifyImportedProject(parsed, html)).verification.trusted).toBe(true);
    const edited = html.replace("#173d9a", "#000000");
    const editedProject = parseProjectHtml(edited);
    const result = await verifyImportedProject(editedProject, edited);
    expect(result.verification.trusted).toBe(false);
    expect(result.verification.reasons).toContain("CONTENT_HASH_MISMATCH");
  });

  it("rejects duplicated protocol sections", () => {
    const html = `<script id="pf-manifest" type="application/json">{}</script><script id="pf-manifest" type="application/json">{}</script>`;
    expect(() => parseProjectHtml(html)).toThrow(/exactly one/);
  });

  it("keeps legacy files without the optional i18n section verifiable", async () => {
    const project = createSalesInvoiceProject();
    project.i18n = {};
    project.manifest = { ...project.manifest, i18n: undefined };
    project.templateHtml = project.templateHtml.replace(/\sdata-pf-i18n="[^"]+"/g, "");
    const html = await serializeStandalone(project, { documentRuntime: "legacy=true;", printform: "print=true;", runtimeVersion: "2.0.0" }, validateProject(project));
    const legacy = html.replace(/\s*<script id="pf-i18n"[^>]*>[\s\S]*?<\/script>/, "");
    const parsed = parseProjectHtml(legacy);
    expect(parsed.i18n).toEqual({});
    expect((await verifyImportedProject(parsed, legacy)).verification.trusted).toBe(true);
  });
});
