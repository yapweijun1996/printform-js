import { describe, expect, it, vi } from "vitest";
import { createDemoGatewaySession, DEMO_GATEWAY_PROJECT_ID } from "../../studio-v2/ui/agent-demo-gateway.js";

function response(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function providerRequest(fetchImpl) {
  return fetchImpl("https://gpt.yapweijun1996.com/demo/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer stale" },
    body: "{}"
  });
}

describe("browser Demo gateway session", () => {
  it("issues a short-lived token once and injects it only into Demo requests", async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/demo/session")) return response({ token: "dmo_session-token", expires_in: 900 });
      return response({ ok: true });
    });
    const session = createDemoGatewaySession({ fetchImpl, now: () => 1_000 });

    await providerRequest(session.fetch);
    await providerRequest(session.fetch);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(calls[0].url).toBe("https://gpt.yapweijun1996.com/demo/session");
    expect(calls[0].init.headers.authorization).toBeUndefined();
    expect(calls[0].init.credentials).toBe("omit");
    expect(JSON.parse(calls[0].init.body)).toEqual({ project_id: DEMO_GATEWAY_PROJECT_ID });
    expect(calls[1].init.credentials).toBe("omit");
    expect(calls[1].init.headers.get("authorization")).toBe("Bearer dmo_session-token");
    expect(calls[2].init.headers.get("authorization")).toBe("Bearer dmo_session-token");
  });

  it("refreshes once after an expired session response and never exposes the token in storage", async () => {
    const calls = [];
    let sessionNumber = 0;
    const fetchImpl = vi.fn(async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/demo/session")) return response({ token: `dmo_refresh-${++sessionNumber}`, expires_in: 900 });
      return response({ error: "demo session token required" }, calls.length === 2 ? 401 : 200);
    });
    const session = createDemoGatewaySession({ fetchImpl });

    await providerRequest(session.fetch);

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(calls.map(({ url }) => url)).toEqual([
      "https://gpt.yapweijun1996.com/demo/session",
      "https://gpt.yapweijun1996.com/demo/v1/responses",
      "https://gpt.yapweijun1996.com/demo/session",
      "https://gpt.yapweijun1996.com/demo/v1/responses"
    ]);
    expect(calls[3].init.headers.get("authorization")).toBe("Bearer dmo_refresh-2");
    expect(JSON.stringify(session)).not.toContain("dmo_refresh");
  });

  it("refreshes an expired token after the completed single-flight is cleared", async () => {
    let now = 1_000;
    let sessionNumber = 0;
    const calls = [];
    const fetchImpl = vi.fn(async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/demo/session")) return response({ token: `dmo_expiry-${++sessionNumber}`, expires_in: 60 });
      return response({ ok: true });
    });
    const session = createDemoGatewaySession({ fetchImpl, now: () => now });

    await providerRequest(session.fetch);
    now += 61_000;
    await providerRequest(session.fetch);

    expect(calls.filter(({ url }) => url.endsWith("/demo/session"))).toHaveLength(2);
    expect(calls.at(-1).init.headers.get("authorization")).toBe("Bearer dmo_expiry-2");
  });

  it("clears an in-flight generation before it can install an old token", async () => {
    let resolveSession;
    const fetchImpl = vi.fn(() => new Promise((resolve) => { resolveSession = resolve; }));
    const session = createDemoGatewaySession({ fetchImpl });
    const pending = providerRequest(session.fetch);
    session.clear();
    resolveSession(response({ token: "dmo_old-token", expires_in: 900 }));

    await expect(pending).rejects.toMatchObject({ code: "DEMO_SESSION_STALE" });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
