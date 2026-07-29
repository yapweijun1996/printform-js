import { createSalesInvoiceProject } from "./sales-invoice.js";
import { createPurchaseOrderProject } from "./purchase-order.js";

export const SAMPLE_DOCUMENTS = Object.freeze({
  "sales-invoice": { label: "Sales Invoice — Blue", create: createSalesInvoiceProject },
  "purchase-order-red": { label: "Purchase Order — Crimson", create: createPurchaseOrderProject }
});

export function createSampleDocument(key = "sales-invoice") {
  return (SAMPLE_DOCUMENTS[key] || SAMPLE_DOCUMENTS["sales-invoice"]).create();
}

export function sampleDocumentKey(search = location.search) {
  const key = new URLSearchParams(search).get("sample") || "sales-invoice";
  return SAMPLE_DOCUMENTS[key] ? key : "sales-invoice";
}
