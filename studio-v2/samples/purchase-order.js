import { LIMITS, PROTOCOL_VERSION, TRUST } from "../core/constants.js";
import { PURCHASE_ORDER_I18N } from "./purchase-order-i18n.js";
import { PURCHASE_ORDER_THEME, PURCHASE_ORDER_TEMPLATE } from "./purchase-order-layout.js";
import { PURCHASE_ORDER_SCHEMA } from "./purchase-order-schema.js";

const products = [
  ["IT-HW-1001", "Business notebook computer, 14-inch display, 16 GB RAM, 512 GB SSD", "UNIT"],
  ["IT-ACC-2040", "USB-C docking station with dual display output and power delivery", "UNIT"],
  ["OFF-FUR-3102", "Ergonomic task chair with adjustable lumbar support", "UNIT"],
  ["NET-SEC-4408", "Managed network switch, 24-port Gigabit with security features", "UNIT"],
  ["OPS-SUP-5511", "Thermal label roll, durable synthetic stock, carton pack", "CTN"],
  ["IT-SVC-6100", "On-site equipment installation and acceptance service", "JOB"],
  ["OFF-STA-7204", "Premium recycled A4 paper, 80 gsm, five-ream carton", "CTN"],
  ["FAC-SAF-8301", "First aid refill kit compliant with workplace requirements", "SET"]
];

const prices = [
  [3299, 601, 773, 1280, 180, 974, 92, 227],
  [3323, 589, 761, 1304, 168, 962, 116, 215],
  [3311, 613, 749, 1292, 192, 950, 104, 239],
  [3299, 601, 773, 1280, 180, 974, 92, 227]
];

function createItems() {
  return Array.from({ length: 32 }, (_, index) => {
    const productIndex = index % products.length;
    const cycle = Math.floor(index / products.length);
    const [sku, description, uom] = products[productIndex];
    const quantity = (productIndex % 4) + 1;
    const unitPrice = prices[cycle][productIndex];
    return { no: index + 1, sku, description, quantity, uom, unitPrice, lineTotal: quantity * unitPrice };
  });
}

export function createPurchaseOrderProject() {
  const items = createItems();
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = subtotal * 0.08;
  const shipping = 180;
  return {
    manifest: {
      protocolVersion: PROTOCOL_VERSION,
      title: "Purchase Order — Crimson",
      documentId: "purchase-order-crimson",
      locale: "en-MY", currency: "MYR", timeZone: "Asia/Kuala_Lumpur",
      i18n: { supportedLocales: ["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"], fallbackLocale: "en-MY" },
      acceptance: { maxHtmlBytes: LIMITS.htmlBytes, maxRows: LIMITS.rows, maxLogicalPages: LIMITS.logicalPages, requirePrintPreview: true },
      assets: { inlineByDefault: true, allowExternalHttps: false, requiredSlots: ["letterhead-logo", "footer-logo"] }
    },
    schema: structuredClone(PURCHASE_ORDER_SCHEMA),
    i18n: structuredClone(PURCHASE_ORDER_I18N),
    themeCss: PURCHASE_ORDER_THEME,
    templateHtml: PURCHASE_ORDER_TEMPLATE,
    sampleData: {
      buyer: {
        name: "Crimson Operations Sdn. Bhd.", registration: "202601987654",
        address: "18 Jalan Teknologi, 47810 Petaling Jaya, Selangor",
        contact: "+603 7788 2100", email: "procurement@example.com"
      },
      supplier: {
        name: "Meridian Business Supplies Sdn. Bhd.", registration: "201901112233",
        address: "27 Jalan Industri 3, 81100 Johor Bahru, Johor",
        contact: "+607 555 0188", email: "sales@example.com"
      },
      purchaseOrderNumber: "PO-2026-000428", orderDate: "2026-07-29", deliveryDate: "2026-08-12",
      deliveryAddress: "Central Receiving Bay, 18 Jalan Teknologi, 47810 Petaling Jaya, Selangor. Attention: Warehouse Supervisor.",
      paymentTerms: "30 days", requestedBy: "Alicia Tan", department: "Operations", items,
      totals: { subtotal, tax, shipping, grandTotal: subtotal + tax + shipping },
      notes: "Please quote the PO number on every delivery order and invoice. Partial deliveries require prior written approval. Goods are subject to quantity and quality inspection upon receipt.",
      approval: { preparedBy: "Alicia Tan", approvedBy: "Marcus Lim" }
    },
    attestation: null, runtime: null, trust: TRUST.trusted, trustReasons: [], customScripts: [], sourceHtml: ""
  };
}
