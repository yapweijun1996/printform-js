const DEFAULT_TTL_MS = 15 * 60 * 1000;

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function approvalError(code, message) {
  return Object.assign(new Error(message), { code });
}

export function createProposalApproval({ sessionId, ttlMs = DEFAULT_TTL_MS, now = () => Date.now() }) {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const used = new Set();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const key = crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

  async function issue(proposalId) {
    const payload = {
      version: 1,
      sessionId,
      proposalId,
      expiresAt: now() + ttlMs,
      nonce: crypto.randomUUID()
    };
    const body = encoder.encode(JSON.stringify(payload));
    const signature = await crypto.subtle.sign("HMAC", await key, body);
    return `${bytesToBase64Url(body)}.${bytesToBase64Url(new Uint8Array(signature))}`;
  }

  async function verify(token, proposalId) {
    const [bodyPart, signaturePart, extra] = String(token || "").split(".");
    if (!bodyPart || !signaturePart || extra) throw approvalError("APPROVAL_TOKEN_INVALID", "The proposal approval is invalid.");
    let body;
    let signature;
    let payload;
    try {
      body = base64UrlToBytes(bodyPart);
      signature = base64UrlToBytes(signaturePart);
      payload = JSON.parse(decoder.decode(body));
    } catch {
      throw approvalError("APPROVAL_TOKEN_INVALID", "The proposal approval is invalid.");
    }
    const valid = await crypto.subtle.verify("HMAC", await key, signature, body);
    if (!valid || payload.version !== 1 || payload.sessionId !== sessionId || payload.proposalId !== proposalId) {
      throw approvalError("APPROVAL_TOKEN_INVALID", "The proposal approval is invalid.");
    }
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt < now()) {
      throw approvalError("APPROVAL_TOKEN_EXPIRED", "The proposal approval has expired. Preview it again.");
    }
    if (!payload.nonce || used.has(payload.nonce)) throw approvalError("APPROVAL_TOKEN_USED", "The proposal approval was already used.");
    used.add(payload.nonce);
    return Object.freeze({ proposalId: payload.proposalId, sessionId: payload.sessionId, expiresAt: payload.expiresAt });
  }

  return Object.freeze({ issue, verify, ttlMs });
}

export const PROPOSAL_APPROVAL_TTL_MS = DEFAULT_TTL_MS;
