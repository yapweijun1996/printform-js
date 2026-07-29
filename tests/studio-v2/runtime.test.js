import { describe, expect, it } from "vitest";
import { installPrintFormDocument } from "../../studio-v2/core/runtime.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

function installSections(project) {
  document.documentElement.lang = "en-MY";
  document.head.innerHTML = `
    <title>Runtime test</title>
    <script id="pf-manifest" type="application/json">${JSON.stringify(project.manifest)}</script>
    <script id="pf-schema" type="application/schema+json">${JSON.stringify(project.schema)}</script>`;
  document.body.innerHTML = `
    <main id="pf-mount"></main>
    <template id="pf-template">${project.templateHtml}</template>
    <script id="pf-sample-data" type="application/json">${JSON.stringify(project.sampleData)}</script>`;
}

describe("PrintFormDocument runtime", () => {
  it("blocks invalid data before invoking pagination", async () => {
    const project = createSalesInvoiceProject();
    installSections(project);
    let calls = 0;
    window.PrintForm = { formatAll: async () => { calls += 1; } };
    const runtime = installPrintFormDocument(window);
    document.querySelector("#pf-mount").innerHTML = '<div class="printform_page">stale</div>';
    const event = new Promise((resolve) => window.addEventListener("printform:rendered", resolve, { once: true }));
    const result = await runtime.render({});
    expect(result.status).toBe("blocked");
    expect(calls).toBe(0);
    expect(document.querySelector("#pf-mount").children).toHaveLength(0);
    expect((await event).detail.status).toBe("blocked");
  });

  it("binds valid rows and returns a layout report", async () => {
    const project = createSalesInvoiceProject();
    project.sampleData.items = project.sampleData.items.slice(0, 1);
    installSections(project);
    window.PrintForm = { formatAll: async () => {
      const form = document.querySelector(".printform");
      form.className = "printform_formatter_processed";
      form.innerHTML = `<div class="printform_page">${form.innerHTML}</div>`;
    } };
    const runtime = installPrintFormDocument(window);
    const result = await runtime.render(project.sampleData);
    expect(result.status).toBe("ready");
    expect(result.metrics.logicalPages).toBe(1);
    expect(document.querySelectorAll(".prowitem")).toHaveLength(1);
  });
});
