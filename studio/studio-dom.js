export const BLOCK_TYPES = [
  "pheader", "pdocinfo", "pdocinfo002", "pdocinfo003", "pdocinfo004", "pdocinfo005",
  "prowheader", "prowitem", "ptac", "paddt",
  "pfooter", "pfooter002", "pfooter003", "pfooter004", "pfooter005",
  "pfooter_logo", "pfooter_pagenum"
];

export function query(selector) {
  return document.querySelector(selector);
}

export function classify(element) {
  const classes = (element.className || "").toString().split(/\s+/);
  for (let index = 0; index < BLOCK_TYPES.length; index += 1) {
    if (classes.indexOf(BLOCK_TYPES[index]) !== -1) return BLOCK_TYPES[index];
  }
  return element.tagName ? element.tagName.toLowerCase() : "unknown";
}

export function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
