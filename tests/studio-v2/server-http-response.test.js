import { describe, expect, it, vi } from "vitest";
import { failHttpRequest, respondAfterNetworkPolicy, safeServerError } from "../../studio-v2/server/transaction-http-response.mjs";

function responseCapture() {
  return {
    destroyed: false,
    headersSent: false,
    writeHead: vi.fn(function writeHead() { this.headersSent = true; }),
    end: vi.fn(),
  };
}

describe("transaction HTTP error boundary", () => {
  it("preserves recovery control codes and ignores transaction state as HTTP status", () => {
    for (const code of ["IDEMPOTENCY_KEY_REUSE", "LEASE_NOT_RENEWABLE", "TAKEOVER_NOT_ALLOWED", "INJECTED_CRASH", "STALE_POLICY_CONTEXT"]) {
      expect(safeServerError({ code }).code).toBe(code);
    }
    const response = responseCapture();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      failHttpRequest({}, response, { code: "COMMIT_IN_PROGRESS", status: "committing" });
      expect(response.writeHead.mock.calls[0][0]).toBe(409);
      expect(JSON.parse(response.end.mock.calls[0][0]).error.code).toBe("COMMIT_IN_PROGRESS");
    } finally { log.mockRestore(); }
  });

  it("projects arbitrary failures to bounded metadata", () => {
    const error = safeServerError({
      code: "UNEXPECTED_CUSTOMER_CANARY",
      message: "customer-name-canary must never cross this boundary",
      transactionId: "customer/name",
      expectedRevision: 0,
      actualRevision: 1,
    });

    expect(error).toEqual({
      code: "SERVER_ERROR",
      message: "Command failed",
      expectedRevision: 0,
      actualRevision: 1,
      transactionId: undefined,
      phase: undefined,
    });
  });

  it("does not log or return the raw failure message", () => {
    const response = responseCapture();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      failHttpRequest({ headers: {} }, response, Object.assign(new Error("secret-document-canary"), { code: "UNKNOWN_TOOL" }), null);
      const body = JSON.parse(response.end.mock.calls[0][0]);
      expect(body).toEqual({ ok: false, error: { code: "UNKNOWN_TOOL", message: "Command failed" } });
      expect(log).toHaveBeenCalledWith("[printform-transaction-server] UNKNOWN_TOOL");
      expect(log.mock.calls.flat().join(" ")).not.toContain("secret-document-canary");
    } finally {
      log.mockRestore();
    }
  });

  it("projects command failure responses instead of forwarding validation payloads", () => {
    const response = responseCapture();
    respondAfterNetworkPolicy({ headers: {} }, response, {
      ok: false,
      error: {
        code: "CANDIDATE_INVALID",
        message: "business-customer-canary is invalid",
        validation: { valid: false, errors: [{ message: "business-customer-canary" }] },
      },
    }, null);

    const body = JSON.parse(response.end.mock.calls[0][0]);
    expect(body).toEqual({ ok: false, error: { code: "CANDIDATE_INVALID", message: "Command failed" } });
    expect(JSON.stringify(body)).not.toContain("business-customer-canary");
  });
});
