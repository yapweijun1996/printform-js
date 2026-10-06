import { describe,it,expect } from 'vitest';
import { AI_MESSAGES,errorMessage } from '../studio-v3/ai-messages.js';
const gatewayCodes=['DEMO_NETWORK_UNREACHABLE','DEMO_SESSION_FORBIDDEN','DEMO_SESSION_UNAVAILABLE','DEMO_SESSION_EXPIRED','DEMO_RATE_LIMIT',
  'DEMO_SERVICE_DISABLED','DEMO_ROUTES_EXHAUSTED','DEMO_GATEWAY_TIMEOUT','DEMO_MEDIA_ENDPOINT_BUG','DEMO_REQUEST_FAILED','AI_TIMEOUT'];
describe('gateway error messages',()=> {
  it('gives every gateway failure its own message',()=> {
    const texts=gatewayCodes.map(code=>AI_MESSAGES[code]);
    expect(texts.every(Boolean)).toBe(true);expect(new Set(texts).size).toBe(texts.length);
  });
  it('always tells the user nothing changed',()=> expect(gatewayCodes.every(code=>AI_MESSAGES[code].includes('Nothing changed'))).toBe(true));
  it('does not blame permissions for a network failure',()=> {
    const text=AI_MESSAGES.DEMO_NETWORK_UNREACHABLE.toLowerCase();
    expect(text).toContain('network');expect(text).not.toMatch(/permission|allow|origin|registered|403/);
  });
  it('points the right owner for each failure',()=> {
    expect(AI_MESSAGES.DEMO_SESSION_FORBIDDEN).toContain('gateway owner');
    expect(AI_MESSAGES.DEMO_RATE_LIMIT).toContain('Try again later');
    expect(AI_MESSAGES.DEMO_SERVICE_DISABLED).toContain('not open');
    expect(AI_MESSAGES.DEMO_ROUTES_EXHAUSTED).toContain('provider');
    expect(AI_MESSAGES.DEMO_GATEWAY_TIMEOUT).toContain('slow');expect(AI_MESSAGES.AI_TIMEOUT).toContain('slow');
    expect(AI_MESSAGES.DEMO_MEDIA_ENDPOINT_BUG).toContain('Internal error');
  });
  it('keeps the generic fallback and cancellation wording',()=> {
    expect(errorMessage(new Error('x'))).toBe('AI request failed. Nothing changed.');
    expect(errorMessage(Object.assign(new Error('x'),{name:'AbortError'}))).toBe('Cancelled. Nothing changed.');
  });
});
