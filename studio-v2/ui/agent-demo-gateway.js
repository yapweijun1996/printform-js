export const DEMO_GATEWAY_ORIGIN = "https://gpt.yapweijun1996.com";
export const DEMO_GATEWAY_PROJECT_ID = "github-pages";
export const DEMO_GATEWAY_ENDPOINT = `${DEMO_GATEWAY_ORIGIN}/demo/v1`;

const SESSION_TTL_SECONDS = 15 * 60;
const REFRESH_SKEW_MS = 30 * 1000;

function sessionError(code = "DEMO_SESSION_UNAVAILABLE") {
  return Object.assign(new Error("The browser demo session is unavailable."), { code, debug: { code } });
}

function resolveFetch(fetchImpl) {
  const candidate = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  if (typeof candidate !== "function") throw sessionError("PROVIDER_TRANSPORT_UNAVAILABLE");
  return candidate === globalThis.fetch ? candidate.bind(globalThis) : candidate;
}

function validSessionToken(token) {
  return typeof token === "string" && /^dmo_[A-Za-z0-9._~-]{8,}$/.test(token);
}

export function createDemoGatewaySession({
  origin = DEMO_GATEWAY_ORIGIN,
  projectId = DEMO_GATEWAY_PROJECT_ID,
  fetchImpl = null,
  now = () => Date.now()
} = {}) {
  const sessionOrigin = new URL(origin).origin;
  let token = "";
  let expiresAt = 0;
  let generation = 0;
  let pending = null;

  function clear() {
    generation += 1;
    token = "";
    expiresAt = 0;
    pending = null;
  }

  async function issueSession(signal, issuedGeneration) {
    const response = await resolveFetch(fetchImpl)(`${sessionOrigin}/demo/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
      credentials: "omit",
      signal
    });
    if (!response || response.ok === false || (Number.isInteger(response.status) && response.status >= 400)) {
      throw sessionError("DEMO_SESSION_UNAVAILABLE");
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw sessionError("DEMO_SESSION_UNAVAILABLE"); }
    if (issuedGeneration !== generation || !validSessionToken(payload?.token)) throw sessionError("DEMO_SESSION_STALE");
    const seconds = Number(payload.expires_in);
    const ttl = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, SESSION_TTL_SECONDS) : SESSION_TTL_SECONDS;
    token = payload.token;
    expiresAt = now() + Math.max(1, ttl) * 1000;
    return token;
  }

  async function getToken(signal) {
    if (token && expiresAt - now() > REFRESH_SKEW_MS) return token;
    if (pending) return pending;
    const issuedGeneration = generation;
    const request = issueSession(signal, issuedGeneration);
    const flight = request.finally(() => { if (pending === flight) pending = null; });
    pending = flight;
    return flight;
  }

  async function fetchDemo(request, options = {}) {
    const fetcher = resolveFetch(fetchImpl);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const sessionToken = await getToken(options.signal);
      const headers = new Headers(options.headers || {});
      headers.delete("authorization");
      headers.set("authorization", `Bearer ${sessionToken}`);
      const response = await fetcher(request, { ...options, credentials: "omit", headers });
      if (response?.status !== 401 || attempt === 1) return response;
      clear();
    }
    throw sessionError("DEMO_SESSION_UNAVAILABLE");
  }

  return Object.freeze({ clear, fetch: fetchDemo });
}

const defaultSession = createDemoGatewaySession();

export function getDefaultDemoGatewaySession() {
  return defaultSession;
}

export function resetDefaultDemoGatewaySession() {
  defaultSession.clear();
}
