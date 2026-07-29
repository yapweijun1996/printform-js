const party = {
  type: "object",
  required: ["name", "registration", "address"],
  properties: {
    name: { type: "string", minLength: 1 },
    registration: { type: "string" },
    address: { type: "string", minLength: 1 },
    contact: { type: "string" },
    email: { type: "string", format: "email" }
  },
  additionalProperties: false
};

export const PURCHASE_ORDER_SCHEMA = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "Purchase Order",
  type: "object",
  required: [
    "buyer", "supplier", "purchaseOrderNumber", "orderDate", "deliveryDate", "deliveryAddress",
    "paymentTerms", "requestedBy", "department", "items", "totals", "notes", "approval"
  ],
  properties: {
    buyer: party,
    supplier: party,
    purchaseOrderNumber: { type: "string", minLength: 1, maxLength: 60 },
    orderDate: { type: "string", format: "date" },
    deliveryDate: { type: "string", format: "date" },
    deliveryAddress: { type: "string", minLength: 1 },
    paymentTerms: { type: "string", minLength: 1 },
    requestedBy: { type: "string", minLength: 1 },
    department: { type: "string" },
    items: {
      type: "array", minItems: 1, maxItems: 500,
      items: {
        type: "object",
        required: ["no", "sku", "description", "quantity", "uom", "unitPrice", "lineTotal"],
        properties: {
          no: { type: "integer", minimum: 1 },
          sku: { type: "string", minLength: 1, maxLength: 50 },
          description: { type: "string", minLength: 1, maxLength: 800 },
          quantity: { type: "number", minimum: 0 },
          uom: { type: "string", minLength: 1, maxLength: 20 },
          unitPrice: { type: "number", minimum: 0 },
          lineTotal: { type: "number", minimum: 0 }
        },
        additionalProperties: false
      }
    },
    totals: {
      type: "object",
      required: ["subtotal", "tax", "shipping", "grandTotal"],
      properties: {
        subtotal: { type: "number", minimum: 0 },
        tax: { type: "number", minimum: 0 },
        shipping: { type: "number", minimum: 0 },
        grandTotal: { type: "number", minimum: 0 }
      },
      additionalProperties: false
    },
    notes: { type: "string", maxLength: 1500 },
    approval: {
      type: "object",
      required: ["preparedBy", "approvedBy"],
      properties: {
        preparedBy: { type: "string", minLength: 1 },
        approvedBy: { type: "string", minLength: 1 }
      },
      additionalProperties: false
    }
  },
  additionalProperties: false
});
