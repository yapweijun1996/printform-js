import { PRINT_TYPOGRAPHY_CSS } from "../core/typography.js";
import { LOGO_PLACEHOLDER_DATA_URL } from "../core/logo-placeholder.js";

export const PURCHASE_ORDER_THEME = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; background: #f4f1f2; }
${PRINT_TYPOGRAPHY_CSS}
#pf-mount { color: #29171b; font-family: Inter, Arial, sans-serif; }
#pf-mount .printform,
#pf-mount .printform_formatter_processed,
#pf-mount .printform_page { width: 750px; background: #fff; }
#pf-mount table { border-collapse: collapse; table-layout: fixed; }
#pf-mount .pf-pad { padding-left: 15px; padding-right: 15px; }
#pf-mount .pf-topline { height: 8px; margin-bottom: 10px; background: #8f1525; }
#pf-mount .pf-header { padding-top: 12px; }
#pf-mount .pf-header-grid { display: grid; grid-template-columns: 1fr 230px; gap: 22px; align-items: start; }
#pf-mount .pf-brand-lockup { display: grid; grid-template-columns: 82px 1fr; gap: 12px; align-items: center; }
#pf-mount .pf-letterhead-logo { display: block; width: 82px; height: 42px; object-fit: contain; }
#pf-mount .pf-brand { margin: 0; color: #8f1525; font-size: var(--pf-font-plus-3); line-height: 1.15; }
#pf-mount .pf-company-meta { margin: 6px 0 14px; color: #5d4a4e; font-size: var(--pf-font-default); line-height: 1.5; }
#pf-mount .pf-po-box { background: #8f1525; color: #fff; padding: 13px 16px; border-radius: 4px; }
#pf-mount .pf-po-box h2 { margin: 0 0 7px; color: #fff; font-size: var(--pf-font-plus-3); letter-spacing: .08em; }
#pf-mount .pf-po-box p { margin: 5px 0 0; color: #fff; font-size: var(--pf-font-default); }
#pf-mount .pf-po-fact { display: grid; grid-template-columns: 70px 1fr; gap: 6px; align-items: baseline; }
#pf-mount .pf-box-label { color: #ffd8de; font-size: var(--pf-font-minus-1); font-weight: 700; letter-spacing: .04em; }
#pf-mount .pf-label { color: #6e3841; font-size: var(--pf-font-minus-1); font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
#pf-mount .pf-info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
#pf-mount .pf-card { border: 1px solid #d9a8b0; border-top: 3px solid #b4233b; padding: 10px 12px; min-height: 92px; }
#pf-mount .pf-card h3 { margin: 0 0 6px; color: #8f1525; font-size: var(--pf-font-default); letter-spacing: .08em; text-transform: uppercase; }
#pf-mount .pf-card p { margin: 2px 0; font-size: var(--pf-font-default); line-height: 1.4; }
#pf-mount .pf-facts { display: grid; grid-template-columns: repeat(4, 1fr); margin: 10px 15px 12px; border: 1px solid #e2bfc5; background: #fff5f6; }
#pf-mount .pf-fact { padding: 8px 10px; border-right: 1px solid #e2bfc5; }
#pf-mount .pf-fact:last-child { border-right: 0; }
#pf-mount .pf-fact strong { display: block; margin-top: 3px; font-size: var(--pf-font-default); }
#pf-mount .pf-grid { width: 720px; margin-left: 15px; margin-right: 15px; }
#pf-mount .pf-grid th { padding: 7px 5px; background: #8f1525; color: #fff; border: 1px solid #74101e; font-size: var(--pf-font-default); text-align: left; }
#pf-mount .pf-grid td { padding: 5px; border: 1px solid #dfc3c8; font-size: var(--pf-font-default); line-height: 15px; vertical-align: top; }
#pf-mount table.prowitem_processed:nth-of-type(even) td { background: #fff7f8; }
#pf-mount .pf-number { text-align: right !important; font-variant-numeric: tabular-nums; }
#pf-mount .pf-center { text-align: center !important; }
#pf-mount .pf-footer-zone { width: 720px; margin: 0 15px; padding-top: 8px; display: grid; grid-template-columns: 1fr 270px; gap: 18px; }
#pf-mount .pf-notes { padding: 10px 12px; background: #fff5f6; border-left: 4px solid #b4233b; font-size: var(--pf-font-minus-1); line-height: 1.45; }
#pf-mount .pf-notes p { margin: 5px 0 0; }
#pf-mount .pf-summary { width: 100%; }
#pf-mount .pf-summary td { padding: 5px 7px; border-bottom: 1px solid #ead3d7; font-size: var(--pf-font-default); }
#pf-mount .pf-grand td { padding-top: 8px; background: #8f1525; color: #fff; border: 0; font-size: var(--pf-font-plus-2); font-weight: 700; }
#pf-mount .pf-signatures { width: 720px; margin: 14px 15px 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 35px; }
#pf-mount .pf-sign { padding-top: 20px; border-top: 1px solid #7b5c62; font-size: var(--pf-font-minus-1); }
#pf-mount .pfooter_logo,
#pf-mount .pfooter_logo_processed { padding: 4px 0; }
#pf-mount .pf-footer-logo { display: block; width: 72px; height: 24px; margin: 0 auto; object-fit: contain; }
#pf-mount .pf-page-footer { padding: 6px 15px 12px; color: #69464d; font-size: var(--pf-font-minus-1); text-align: center; }
@media print { body { background: #fff; } }
`;

export const PURCHASE_ORDER_TEMPLATE = `
<section class="printform" data-papersize-width="750" data-papersize-height="1050"
  data-height-of-dummy-row-item="26" data-repeat-header="y" data-repeat-docinfo="n"
  data-repeat-rowheader="y" data-repeat-footer="n" data-repeat-footer-logo="y" data-repeat-footer-pagenum="y"
  data-repeat-ptac-rowheader="n"
  data-insert-dummy-row-item-while-format-table="n" data-insert-footer-spacer-while-format-table="n"
  data-insert-footer-spacer-with-dummy-row-item-while-format-table="n">
  <header class="pheader pf-header">
    <div class="pf-topline"></div>
    <div class="pf-pad pf-header-grid">
      <div class="pf-brand-lockup">
        <img class="pf-letterhead-logo" data-pf-asset-slot="letterhead-logo" src="${LOGO_PLACEHOLDER_DATA_URL}" alt="Company letterhead logo">
        <div><h1 class="pf-brand" data-pf-text="/buyer/name"></h1>
        <p class="pf-company-meta"><span class="pf-label" data-pf-i18n="company.registration"></span> <span data-pf-text="/buyer/registration"></span><br><span data-pf-text="/buyer/address"></span><br><span data-pf-text="/buyer/contact"></span> · <span data-pf-text="/buyer/email"></span></p></div>
      </div>
      <div class="pf-po-box">
        <h2 data-pf-i18n="po.title"></h2>
        <p class="pf-po-fact"><span class="pf-box-label" data-pf-i18n="po.number"></span><strong data-pf-text="/purchaseOrderNumber"></strong></p>
        <p class="pf-po-fact"><span class="pf-box-label" data-pf-i18n="po.orderDate"></span><strong data-pf-text="/orderDate" data-pf-format="date"></strong></p>
      </div>
    </div>
  </header>
  <section class="pdocinfo">
    <div class="pf-pad pf-info">
      <div class="pf-card"><h3 data-pf-i18n="supplier.title"></h3><p><strong data-pf-text="/supplier/name"></strong></p>
        <p><span class="pf-label" data-pf-i18n="company.registration"></span> <span data-pf-text="/supplier/registration"></span></p>
        <p data-pf-text="/supplier/address"></p><p><span data-pf-text="/supplier/contact"></span> · <span data-pf-text="/supplier/email"></span></p></div>
      <div class="pf-card"><h3 data-pf-i18n="delivery.title"></h3><p data-pf-text="/deliveryAddress"></p>
        <p><span class="pf-label" data-pf-i18n="delivery.required"></span><br><strong data-pf-text="/deliveryDate" data-pf-format="date"></strong></p></div>
    </div>
    <div class="pf-facts">
      <div class="pf-fact"><span class="pf-label" data-pf-i18n="facts.paymentTerms"></span><strong data-pf-text="/paymentTerms"></strong></div>
      <div class="pf-fact"><span class="pf-label" data-pf-i18n="facts.requestedBy"></span><strong data-pf-text="/requestedBy"></strong></div>
      <div class="pf-fact"><span class="pf-label" data-pf-i18n="facts.department"></span><strong data-pf-text="/department"></strong></div>
      <div class="pf-fact"><span class="pf-label" data-pf-i18n="facts.currency"></span><strong>MYR</strong></div>
    </div>
  </section>
  <table class="prowheader pf-grid"><thead><tr>
    <th style="width:5%" class="pf-center" data-pf-i18n="table.no"></th><th style="width:12%" data-pf-i18n="table.sku"></th>
    <th data-pf-i18n="table.description"></th><th style="width:7%" class="pf-number" data-pf-i18n="table.quantity"></th>
    <th style="width:7%" class="pf-center" data-pf-i18n="table.uom"></th><th style="width:14%" class="pf-number" data-pf-i18n="table.unitPrice"></th>
    <th style="width:15%" class="pf-number" data-pf-i18n="table.amount"></th>
  </tr></thead></table>
  <table class="prowitem pf-grid" data-pf-each="/items"><tbody><tr>
    <td style="width:5%" class="pf-center" data-pf-text="./no"></td><td style="width:12%" data-pf-text="./sku"></td>
    <td data-pf-text="./description"></td><td style="width:7%" class="pf-number" data-pf-text="./quantity" data-pf-format="number"></td>
    <td style="width:7%" class="pf-center" data-pf-text="./uom"></td><td style="width:14%" class="pf-number" data-pf-text="./unitPrice" data-pf-format="currency"></td>
    <td style="width:15%" class="pf-number" data-pf-text="./lineTotal" data-pf-format="currency"></td>
  </tr></tbody></table>
  <section class="ptac">
    <div class="pf-footer-zone"><div class="pf-notes"><strong data-pf-i18n="notes.title"></strong><p data-pf-text="/notes"></p></div>
      <table class="pf-summary"><tbody>
        <tr><td data-pf-i18n="summary.subtotal"></td><td class="pf-number" data-pf-text="/totals/subtotal" data-pf-format="currency"></td></tr>
        <tr><td data-pf-i18n="summary.tax"></td><td class="pf-number" data-pf-text="/totals/tax" data-pf-format="currency"></td></tr>
        <tr><td data-pf-i18n="summary.shipping"></td><td class="pf-number" data-pf-text="/totals/shipping" data-pf-format="currency"></td></tr>
        <tr class="pf-grand"><td data-pf-i18n="summary.grandTotal"></td><td class="pf-number" data-pf-text="/totals/grandTotal" data-pf-format="currency"></td></tr>
      </tbody></table></div>
    <div class="pf-signatures"><div class="pf-sign"><span data-pf-i18n="approval.preparedBy"></span>: <strong data-pf-text="/approval/preparedBy"></strong></div>
      <div class="pf-sign"><span data-pf-i18n="approval.approvedBy"></span>: <strong data-pf-text="/approval/approvedBy"></strong></div></div>
  </section>
  <footer class="pfooter_logo"><img class="pf-footer-logo" data-pf-asset-slot="footer-logo" src="${LOGO_PLACEHOLDER_DATA_URL}" alt="Footer logo"></footer>
  <footer class="pfooter_pagenum pf-page-footer"><span data-pf-i18n="page.document"></span> · <span data-pf-i18n="page.page"></span> <span data-page-number></span> <span data-pf-i18n="page.of"></span> <span data-page-total></span></footer>
</section>`;
