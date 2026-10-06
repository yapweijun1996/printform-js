import { DEMO_CONFIG } from './ai-gateway-config.js';
const text = value => typeof value === 'string' ? value : '';
// The gateway's error body shape is not documented; accept the common ones.
export function failureDetail(body) {
  const error = body?.error, plain = text(error);
  const code = [body?.code, error?.code, plain].map(text).find(Boolean) || '';
  const message = [body?.message, error?.message, body?.detail, plain].map(text).find(Boolean) || '';
  return {code: code.toUpperCase(), message: message.toLowerCase()};
}
export async function readFailureBody(response) {
  try {
    if (typeof response?.clone !== 'function') return {};
    const raw = await response.clone().text();
    return raw.length > DEMO_CONFIG.errorBodyLimitChars ? {} : JSON.parse(raw);
  } catch { return {}; }
}
// HTTP status plus the gateway's own code (or its published wording) decide the failure.
export function failureCode(status, {code = '', message = ''} = {}) {
  if (status === 400 && (code === 'DEMO_MEDIA_DISABLED' || message.includes('text messages only'))) return 'DEMO_MEDIA_ENDPOINT_BUG';
  if (code === 'DEMO_MODEL_NOT_ALLOWED') return 'DEMO_MODEL_UNAVAILABLE';
  if (status === 401) return 'DEMO_SESSION_EXPIRED';
  if (status === 403) return 'DEMO_SESSION_FORBIDDEN';
  if (status === 429) return 'DEMO_RATE_LIMIT';
  if (status === 503 && (code === 'DEMO_ROUTER_DISABLED' || message.includes('public demo is disabled'))) return 'DEMO_SERVICE_DISABLED';
  if (status === 503 && code === 'DEMO_ALL_ROUTES_EXHAUSTED') return 'DEMO_ROUTES_EXHAUSTED';
  if (status === 504) return 'DEMO_GATEWAY_TIMEOUT';
  return 'DEMO_REQUEST_FAILED';
}
export async function classifyFailure(response) {
  return failureCode(response?.status, failureDetail(await readFailureBody(response)));
}
