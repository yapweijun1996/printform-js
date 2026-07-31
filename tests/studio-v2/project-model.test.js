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

  it("attests both runtimes and the CSP script allowlist, not just the document runtime", async () => {
    const project = createSalesInvoiceProject();
    const html = await serializeStandalone(project, { documentRuntime: "window.runtimeLoaded=true;", printform: "window.printformLoaded=true;", runtimeVersion: "2.0.0" }, validateProject(project));
    const attestation = parseProjectHtml(html).attestation;
    expect(attestation.runtimeHash).toEqual(expect.any(String));
    expect(attestation.printformRuntimeHash).toEqual(expect.any(String));
    expect(attestation.printformRuntimeHash).not.toBe(attestation.runtimeHash);
    expect(attestation.cspScriptHashes).toHaveLength(2);
    // The pinned hashes must be exactly the ones the shipped CSP allows.
    attestation.cspScriptHashes.forEach((hash) => expect(html).toContain(`'${hash}'`));
  });

  it("detects a swapped pagination runtime separately from a swapped document runtime", async () => {
    // Before dual-runtime attestation, replacing printform.js with a modified
    // build left the document fully "trusted" — nothing covered that script.
    const project = createSalesInvoiceProject();
    const html = await serializeStandalone(project, { documentRuntime: "window.runtimeLoaded=true;", printform: "window.printformLoaded=true;", runtimeVersion: "2.0.0" }, validateProject(project));
    const tampered = html.replace("window.printformLoaded=true;", "window.printformLoaded=true;window.evil=1;");
    const result = await verifyImportedProject(parseProjectHtml(tampered), tampered);
    expect(result.verification.trusted).toBe(false);
    expect(result.verification.reasons).toContain("PRINTFORM_RUNTIME_HASH_MISMATCH");
    expect(result.verification.reasons).not.toContain("RUNTIME_HASH_MISMATCH");
  });

  it("reports only the browsers that actually issued layout evidence", async () => {
    // Was hardcoded to all three engines in every export regardless of where
    // it ran — the self-declaration the trust model explicitly forbids.
    const project = createSalesInvoiceProject();
    const sources = { documentRuntime: "window.runtimeLoaded=true;", printform: "window.printformLoaded=true;", runtimeVersion: "2.0.0" };
    const unreviewed = parseProjectHtml(await serializeStandalone(project, sources, validateProject(project)));
    expect(unreviewed.attestation.browsers).toEqual([]);

    const reviewed = { ...validateProject(project), reviewReceipt: { browsers: [{ name: "Chromium", version: "148" }] } };
    const withReview = parseProjectHtml(await serializeStandalone(project, sources, reviewed));
    expect(withReview.attestation.browsers).toEqual([{ name: "Chromium", version: "148" }]);
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
