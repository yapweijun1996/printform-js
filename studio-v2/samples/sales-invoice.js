import { LIMITS, PROTOCOL_VERSION, TRUST } from "../core/constants.js";

const products = [
  "USB-C Docking Station", "Mechanical Keyboard", "27-inch Monitor", "Noise-Cancelling Headset",
  "Ergonomic Mouse", "Laptop Stand", "GaN Charger", "Thunderbolt Cable", "Webcam", "Portable SSD"
];

function createItems(count = 45) {
  return Array.from({ length: count }, (_, index) => {
    const quantity = (index % 5) + 1;
    const unitPrice = 49 + (index % 8) * 25;
    return { no: index + 1, description: `${products[index % products.length]} — batch ${String(index + 1).padStart(2, "0")}`, quantity, unitPrice, lineTotal: quantity * unitPrice };
  });
}

const themeCss = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #eef2f7; }
#pf-mount { color: #172033; font-family: Inter, Arial, sans-serif; }
#pf-mount .printform,
#pf-mount .printform_formatter_processed,
#pf-mount .printform_page { width: 750px; background: #fff; }
#pf-mount table { width: 100%; border-collapse: collapse; table-layout: fixed; }
#pf-mount .pf-pad { padding: 0 24px; }
#pf-mount .pf-header { padding-top: 22px; border-bottom: 3px solid #2457d6; }
#pf-mount .pf-brand { margin: 0; color: #173d9a; font-size: 24px; }
#pf-mount .pf-muted { color: #5d677a; font-size: 12px; }
#pf-mount .pf-title { margin: 18px 0 8px; font-size: 22px; letter-spacing: .08em; }
#pf-mount .pf-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; padding-bottom: 16px; }
#pf-mount .pf-meta p { margin: 0; font-size: 12px; line-height: 1.5; }
#pf-mount .pf-label { color: #68748a; font-size: 10px; text-transform: uppercase; }
#pf-mount .pf-grid th { background: #e8efff; border: 1px solid #9fb4e8; padding: 7px 6px; font-size: 11px; text-align: left; }
#pf-mount .pf-grid td { border: 1px solid #cad3e3; padding: 5px 6px; font-size: 11px; line-height: 16px; }
#pf-mount .pf-number { text-align: right; font-variant-numeric: tabular-nums; }
#pf-mount .pf-summary { margin: 12px 24px 0 auto; width: 280px; }
#pf-mount .pf-summary td { padding: 5px 8px; font-size: 12px; }
#pf-mount .pf-total { border-top: 2px solid #173d9a; font-size: 15px; font-weight: 700; }
#pf-mount .pf-terms { margin: 14px 24px; padding: 12px; background: #f6f8fc; font-size: 10px; line-height: 1.5; }
#pf-mount .pf-footer { padding: 8px 24px 14px; color: #68748a; font-size: 10px; text-align: center; }
@media print { body { background: #fff; } a::after { content: " (" attr(href) ")"; font-size: 9px; } }
`;

const templateHtml = `
<section class="printform" data-papersize-width="750" data-papersize-height="1050"
  data-height-of-dummy-row-item="27" data-repeat-header="y" data-repeat-docinfo="y"
  data-repeat-rowheader="y" data-repeat-footer="n" data-repeat-footer-pagenum="y"
  data-insert-dummy-row-item-while-format-table="y" data-insert-footer-spacer-while-format-table="y">
  <header class="pheader pf-pad pf-header">
    <h1 class="pf-brand" data-pf-text="/seller/name"></h1>
    <p class="pf-muted"><span data-pf-text="/seller/registration"></span> · <span data-pf-text="/seller/address"></span></p>
  </header>
  <section class="pdocinfo pf-pad">
    <h2 class="pf-title">SALES INVOICE</h2>
    <div class="pf-meta">
      <p><span class="pf-label">Invoice no.</span><br><strong data-pf-text="/invoiceNumber"></strong></p>
      <p><span class="pf-label">Invoice date</span><br><strong data-pf-text="/invoiceDate" data-pf-format="date"></strong></p>
      <p><span class="pf-label">Bill to</span><br><strong data-pf-text="/customer/name"></strong><br><span data-pf-text="/customer/address"></span></p>
      <p><span class="pf-label">Reference</span><br><a data-pf-text="/reference/label" data-pf-href="/reference/url"></a></p>
    </div>
  </section>
  <table class="prowheader pf-grid">
    <thead><tr><th style="width:7%">No.</th><th>Description</th><th style="width:11%" class="pf-number">Qty</th><th style="width:16%" class="pf-number">Unit</th><th style="width:18%" class="pf-number">Amount</th></tr></thead>
  </table>
  <table class="prowitem pf-grid" data-pf-each="/items">
    <tbody><tr><td style="width:7%" data-pf-text="./no"></td><td data-pf-text="./description"></td><td style="width:11%" class="pf-number" data-pf-text="./quantity" data-pf-format="number"></td><td style="width:16%" class="pf-number" data-pf-text="./unitPrice" data-pf-format="currency"></td><td style="width:18%" class="pf-number" data-pf-text="./lineTotal" data-pf-format="currency"></td></tr></tbody>
  </table>
  <section class="ptac pf-terms">
    <strong>Terms and conditions</strong>
    <p>Goods remain the property of the seller until payment is received in full. Report discrepancies within seven calendar days.</p>
    <p>Payment reference must include the invoice number. Warranty and returns remain subject to the agreed sales terms.</p>
  </section>
  <footer class="pfooter">
    <table class="pf-summary"><tbody>
      <tr><td>Subtotal</td><td class="pf-number" data-pf-text="/totals/subtotal" data-pf-format="currency"></td></tr>
      <tr><td>Tax</td><td class="pf-number" data-pf-text="/totals/tax" data-pf-format="currency"></td></tr>
      <tr class="pf-total"><td>Total</td><td class="pf-number" data-pf-text="/totals/grandTotal" data-pf-format="currency"></td></tr>
    </tbody></table>
  </footer>
  <footer class="pfooter_pagenum pf-footer">Page <span data-page-number></span> of <span data-page-total></span></footer>
</section>`;

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: ["seller", "customer", "invoiceNumber", "invoiceDate", "items", "totals"],
  properties: {
    seller: { type: "object", required: ["name", "registration", "address"], properties: { name: { type: "string", minLength: 1 }, registration: { type: "string" }, address: { type: "string" } }, additionalProperties: false },
    customer: { type: "object", required: ["name", "address"], properties: { name: { type: "string", minLength: 1 }, address: { type: "string" } }, additionalProperties: false },
    invoiceNumber: { type: "string", minLength: 1, maxLength: 60 },
    invoiceDate: { type: "string", format: "date" },
    reference: { type: "object", properties: { label: { type: "string" }, url: { type: "string", format: "uri" } }, additionalProperties: false },
    items: { type: "array", minItems: 1, maxItems: 500, items: { type: "object", required: ["no", "description", "quantity", "unitPrice", "lineTotal"], properties: { no: { type: "integer", minimum: 1 }, description: { type: "string", minLength: 1, maxLength: 800 }, quantity: { type: "number", minimum: 0 }, unitPrice: { type: "number", minimum: 0 }, lineTotal: { type: "number", minimum: 0 } }, additionalProperties: false } },
    totals: { type: "object", required: ["subtotal", "tax", "grandTotal"], properties: { subtotal: { type: "number", minimum: 0 }, tax: { type: "number", minimum: 0 }, grandTotal: { type: "number", minimum: 0 } }, additionalProperties: false }
  },
  additionalProperties: false
};

export function createSalesInvoiceProject() {
  const items = createItems();
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = subtotal * 0.08;
  return {
    manifest: {
      protocolVersion: PROTOCOL_VERSION,
      title: "Sales Invoice — PrintForm Studio v2",
      documentId: "sales-invoice-pilot",
      locale: "en-MY", currency: "MYR", timeZone: "Asia/Kuala_Lumpur",
      acceptance: { maxHtmlBytes: LIMITS.htmlBytes, maxRows: LIMITS.rows, maxLogicalPages: LIMITS.logicalPages, requirePrintPreview: true },
      assets: { inlineByDefault: true, allowExternalHttps: false }
    },
    schema, themeCss, templateHtml,
    sampleData: {
      seller: { name: "PrintForm Technology Sdn. Bhd.", registration: "202601234567", address: "Kuala Lumpur, Malaysia" },
      customer: { name: "Example Business Sdn. Bhd.", address: "Johor Bahru, Malaysia" },
      invoiceNumber: "INV-2026-001234", invoiceDate: "2026-07-29",
      reference: { label: "View purchase reference", url: "https://example.com/orders/PO-2026-0098" },
      items, totals: { subtotal, tax, grandTotal: subtotal + tax }
    },
    attestation: null, runtime: null, trust: TRUST.trusted, trustReasons: [], customScripts: [], sourceHtml: ""
  };
}
