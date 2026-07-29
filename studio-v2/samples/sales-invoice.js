import { LIMITS, PROTOCOL_VERSION, TRUST } from "../core/constants.js";
import { PRINT_TYPOGRAPHY_CSS } from "../core/typography.js";
import { LOGO_PLACEHOLDER_DATA_URL } from "../core/logo-placeholder.js";
import { SALES_INVOICE_I18N } from "./sales-invoice-i18n.js";

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
${PRINT_TYPOGRAPHY_CSS}
#pf-mount { color: #172033; font-family: Inter, Arial, sans-serif; line-height: 1.35; }
#pf-mount .printform,
#pf-mount .printform_formatter_processed,
#pf-mount .printform_page { width: 750px; background: #fff; }
#pf-mount table { width: 100%; border-collapse: collapse; table-layout: fixed; }
#pf-mount .pf-pad { padding: 0 24px; }
#pf-mount .pf-header { padding-top: 22px; border-bottom: 3px solid #2457d6; }
#pf-mount .pf-letterhead { display: grid; grid-template-columns: 92px 1fr; gap: 14px; align-items: center; }
#pf-mount .pf-letterhead-logo { display: block; width: 92px; height: 42px; object-fit: contain; }
#pf-mount .pf-brand { margin: 0; color: #173d9a; font-size: var(--pf-font-plus-3); }
#pf-mount .pf-muted { color: #5d677a; font-size: var(--pf-font-default); }
#pf-mount .pdocinfo,
#pf-mount .pdocinfo_processed { padding: 18px 24px 0; }
#pf-mount .pf-title { margin: 0 0 8px; font-size: var(--pf-font-plus-3); letter-spacing: .08em; }
#pf-mount .pf-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; padding-bottom: 16px; }
#pf-mount .pf-meta p { margin: 0; font-size: var(--pf-font-default); line-height: 1.5; }
#pf-mount .pf-label { color: #68748a; font-size: var(--pf-font-minus-1); text-transform: uppercase; }
#pf-mount .pf-grid th { background: #e8efff; border: 1px solid #9fb4e8; padding: 7px 6px; font-size: var(--pf-font-minus-1); text-align: left; }
#pf-mount .pf-grid td { border: 1px solid #cad3e3; padding: 5px 6px; font-size: var(--pf-font-default); line-height: 1.35; }
#pf-mount .pf-number { text-align: right; font-variant-numeric: tabular-nums; }
#pf-mount .pfooter,
#pf-mount .pfooter_processed { padding-top: 12px; }
#pf-mount .pf-summary { margin: 0 24px 0 auto; width: 280px; }
#pf-mount .pf-summary td { padding: 5px 8px; font-size: var(--pf-font-default); }
#pf-mount .pf-total { border-top: 2px solid #173d9a; font-size: var(--pf-font-plus-2); font-weight: 700; }
#pf-mount .pf-terms { margin: 14px 24px; padding: 12px; background: #f6f8fc; font-size: var(--pf-font-minus-1); line-height: 1.5; }
#pf-mount .pf-footer { padding: 8px 24px 14px; color: #68748a; font-size: var(--pf-font-minus-1); text-align: center; }
#pf-mount .pfooter_logo,
#pf-mount .pfooter_logo_processed { padding: 4px 0; }
#pf-mount .pf-footer-logo { display: block; width: 72px; height: 24px; margin: 0 auto; object-fit: contain; }
@media print { body { background: #fff; } a::after { content: " (" attr(href) ")"; font-size: var(--pf-font-minus-1); } }
`;

const templateHtml = `
<section class="printform" data-papersize-width="750" data-papersize-height="1050"
  data-height-of-dummy-row-item="27" data-repeat-header="y" data-repeat-docinfo="y"
  data-repeat-rowheader="y" data-repeat-footer="n" data-repeat-footer-logo="y" data-repeat-footer-pagenum="y"
  data-repeat-ptac-rowheader="n"
  data-insert-dummy-row-item-while-format-table="y" data-insert-footer-spacer-while-format-table="y">
  <header class="pheader pf-pad pf-header">
    <div class="pf-letterhead"><img class="pf-letterhead-logo" data-pf-asset-slot="letterhead-logo" src="${LOGO_PLACEHOLDER_DATA_URL}" alt="Company letterhead logo"><div>
      <h1 class="pf-brand" data-pf-text="/seller/name"></h1>
      <p class="pf-muted"><span data-pf-text="/seller/registration"></span> · <span data-pf-text="/seller/address"></span></p>
    </div></div>
  </header>
  <section class="pdocinfo pf-pad">
    <h2 class="pf-title" data-pf-i18n="invoice.title"></h2>
    <div class="pf-meta">
      <p><span class="pf-label" data-pf-i18n="invoice.number"></span><br><strong data-pf-text="/invoiceNumber"></strong></p>
      <p><span class="pf-label" data-pf-i18n="invoice.date"></span><br><strong data-pf-text="/invoiceDate" data-pf-format="date"></strong></p>
      <p><span class="pf-label" data-pf-i18n="invoice.billTo"></span><br><strong data-pf-text="/customer/name"></strong><br><span data-pf-text="/customer/address"></span></p>
      <p><span class="pf-label" data-pf-i18n="invoice.reference"></span><br><a data-pf-text="/reference/label" data-pf-href="/reference/url"></a></p>
    </div>
  </section>
  <table class="prowheader pf-grid">
    <thead><tr><th style="width:7%" data-pf-i18n="table.no"></th><th data-pf-i18n="table.description"></th><th style="width:11%" class="pf-number" data-pf-i18n="table.quantity"></th><th style="width:16%" class="pf-number" data-pf-i18n="table.unit"></th><th style="width:18%" class="pf-number" data-pf-i18n="table.amount"></th></tr></thead>
  </table>
  <table class="prowitem pf-grid" data-pf-each="/items">
    <tbody><tr><td style="width:7%" data-pf-text="./no"></td><td data-pf-text="./description"></td><td style="width:11%" class="pf-number" data-pf-text="./quantity" data-pf-format="number"></td><td style="width:16%" class="pf-number" data-pf-text="./unitPrice" data-pf-format="currency"></td><td style="width:18%" class="pf-number" data-pf-text="./lineTotal" data-pf-format="currency"></td></tr></tbody>
  </table>
  <section class="ptac pf-terms">
    <strong data-pf-i18n="terms.title"></strong>
    <p data-pf-i18n="terms.first"></p>
    <p data-pf-i18n="terms.second"></p>
  </section>
  <footer class="pfooter">
    <table class="pf-summary"><tbody>
      <tr><td data-pf-i18n="summary.subtotal"></td><td class="pf-number" data-pf-text="/totals/subtotal" data-pf-format="currency"></td></tr>
      <tr><td data-pf-i18n="summary.tax"></td><td class="pf-number" data-pf-text="/totals/tax" data-pf-format="currency"></td></tr>
      <tr class="pf-total"><td data-pf-i18n="summary.total"></td><td class="pf-number" data-pf-text="/totals/grandTotal" data-pf-format="currency"></td></tr>
    </tbody></table>
  </footer>
  <footer class="pfooter_logo"><img class="pf-footer-logo" data-pf-asset-slot="footer-logo" src="${LOGO_PLACEHOLDER_DATA_URL}" alt="Footer logo"></footer>
  <footer class="pfooter_pagenum pf-footer"><span data-pf-i18n="page.page"></span> <span data-page-number></span> <span data-pf-i18n="page.of"></span> <span data-page-total></span></footer>
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
      i18n: { supportedLocales: ["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"], fallbackLocale: "en-MY" },
      acceptance: { maxHtmlBytes: LIMITS.htmlBytes, maxRows: LIMITS.rows, maxLogicalPages: LIMITS.logicalPages, requirePrintPreview: true },
      assets: { inlineByDefault: true, allowExternalHttps: false, requiredSlots: ["letterhead-logo", "footer-logo"] }
    },
    schema, i18n: structuredClone(SALES_INVOICE_I18N), themeCss, templateHtml,
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
