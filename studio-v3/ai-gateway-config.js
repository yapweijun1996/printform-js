import {
  DEMO_GATEWAY_ORIGIN, DEMO_GATEWAY_PROJECT_ID, DEMO_GATEWAY_ENDPOINT,
  DEMO_SESSION_TTL_SECONDS, DEMO_SESSION_REFRESH_SKEW_MS
} from '../studio-v2/ui/agent-demo-gateway.js';
const MIB = 1024 * 1024;
// Timing. Each gateway request has its own cap; the Send total is only a safety net derived from them.
const DISCOVER_MS = 15_000, MODEL_MS = 60_000, MODEL_REQUESTS = 3, INSPECTION_MS = 10_000;
// Single home for the Demo Gateway address, session timing and wire limits.
// The gateway itself is outside this repository; these mirror its published limits.
export const DEMO_CONFIG = Object.freeze({
  origin: DEMO_GATEWAY_ORIGIN,
  apiBase: DEMO_GATEWAY_ENDPOINT,
  projectId: DEMO_GATEWAY_PROJECT_ID,
  sessionTtlSeconds: DEMO_SESSION_TTL_SECONDS,
  sessionRefreshSkewMs: DEMO_SESSION_REFRESH_SKEW_MS,
  discoverTimeoutMs: DISCOVER_MS,
  // One model request, including its session acquisition and the single 401 refresh. Longer than the
  // ~45 s a stalled provider takes, so the gateway's own error arrives before ours.
  modelTimeoutMs: MODEL_MS,
  // One explicit Send: discovery plus every allowed model request with its local inspection.
  maxModelRequests: MODEL_REQUESTS,
  inspectionAllowanceMs: INSPECTION_MS,
  sendTimeoutMs: DISCOVER_MS + MODEL_REQUESTS * (MODEL_MS + INSPECTION_MS),
  // The gateway's default routing alias; others are discovered from /models.
  defaultAlias: 'demo-auto',
  // Aliases become the request's model field, so only this shape is ever accepted.
  aliasPattern: /^demo-[a-z0-9][a-z0-9-]{0,39}$/,
  maxAliases: 8,
  responseLimitChars: 64_000,
  maxBodyBytes: 12 * MIB,
  errorBodyLimitChars: 8_192,
  image: Object.freeze({
    maxCount: 4,
    maxBytes: 4 * MIB,
    maxTotalBytes: 8 * MIB,
    // Base64 of one maximum image plus the data-URL header allowance.
    maxUrlChars: Math.ceil(4 * MIB / 3) * 4 + 100
  })
});
export const isDemoAlias = id => typeof id === 'string' && DEMO_CONFIG.aliasPattern.test(id);
