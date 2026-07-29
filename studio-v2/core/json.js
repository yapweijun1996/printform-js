export function stableStringify(value, space = 2) {
  return JSON.stringify(sortValue(value), null, space);
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = sortValue(value[key]);
    return result;
  }, {});
}

export function parseJson(text, sectionName) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const wrapped = new Error(`${sectionName} is not valid JSON: ${error.message}`);
    wrapped.code = "INVALID_JSON";
    throw wrapped;
  }
}

export function decodePointerToken(token) {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

export function resolvePointer(root, pointer, scope = root) {
  if (pointer === "." || pointer === "#") return scope;
  const relative = String(pointer || "").startsWith("./");
  const source = relative ? scope : root;
  const raw = relative ? String(pointer).slice(1) : String(pointer || "");
  if (raw === "") return source;
  if (!raw.startsWith("/")) return undefined;
  return raw.slice(1).split("/").reduce((value, token) => {
    if (value === undefined || value === null) return undefined;
    return value[decodePointerToken(token)];
  }, source);
}

export function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Base64(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  let binary = "";
  new Uint8Array(digest).forEach((byte) => { binary += String.fromCharCode(byte); });
  return globalThis.btoa(binary);
}
