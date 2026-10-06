import {
  DEMO_GATEWAY_ORIGIN, DEMO_GATEWAY_PROJECT_ID, DEMO_GATEWAY_ENDPOINT,
  DEMO_SESSION_TTL_SECONDS, DEMO_SESSION_REFRESH_SKEW_MS
} from '../studio-v2/ui/agent-demo-gateway.js';
const MIB = 1024 * 1024;
// Single home for the Demo Gateway address, session timing and wire limits.
// The gateway itself is outside this repository; these mirror its published limits.
export const DEMO_CONFIG = Object.freeze({
  origin: DEMO_GATEWAY_ORIGIN,
  apiBase: DEMO_GATEWAY_ENDPOINT,
  projectId: DEMO_GATEWAY_PROJECT_ID,
  sessionTtlSeconds: DEMO_SESSION_TTL_SECONDS,
  sessionRefreshSkewMs: DEMO_SESSION_REFRESH_SKEW_MS,
  // One explicit Send, including model discovery and up to three model requests.
  sendTimeoutMs: 60_000,
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
