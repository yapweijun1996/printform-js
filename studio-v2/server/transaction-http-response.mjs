export function jsonResponse(response, status, body, origin = null) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  response.end(payload);
}

export function statusForError(error) {
  if (["REVISION_CONFLICT", "STORE_CONFLICT", "TRANSACTION_RECORD_CONFLICT", "LEASE_EXPIRED", "LEASE_OWNER_MISMATCH", "LEASE_ID_MISMATCH", "COMMIT_IN_PROGRESS", "EVIDENCE_ANCHOR_CONFLICT"].includes(error.code)) return 409;
  if (["SERVER_UNAVAILABLE", "RECOVERY_REQUIRED"].includes(error.code)) return 503;
  return 400;
}

export function respondAfterNetworkPolicy(request, response, body, origin) {
  const send = () => {
    if (request.headers["x-printform-drop-after-commit"] === "true") { request.socket.destroy(); return; }
    jsonResponse(response, body.ok ? 200 : statusForError(body.error || {}), body, origin);
  };
  const delay = Math.max(0, Number(request.headers["x-printform-delay-ms"]) || 0);
  if (delay) setTimeout(send, delay); else send();
}

export function crashHttpRequest(request, response, phase, onCrash) {
  response.destroy();
  if (onCrash) onCrash(phase);
}

export function failHttpRequest(request, response, error, origin) {
  if (response.destroyed || response.headersSent) return;
  console.error(`[printform-transaction-server] ${error.code || "SERVER_ERROR"}: ${error.message}`);
  const status = error.status || statusForError(error);
  jsonResponse(response, status, { ok: false, error: { code: error.code || "SERVER_ERROR", message: error.message, expectedRevision: error.expectedRevision, actualRevision: error.actualRevision, transactionId: error.transactionId, phase: error.phase } }, origin);
}
