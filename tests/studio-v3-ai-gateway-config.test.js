import { describe,it,expect } from 'vitest';
import { DEMO_CONFIG } from '../studio-v3/ai-gateway-config.js';
describe('v3 Demo Gateway configuration',()=> {
  it('keeps the gateway address and project in one place',()=> {
    expect(DEMO_CONFIG.origin).toBe('https://gpt.yapweijun1996.com');
    expect(DEMO_CONFIG.apiBase).toBe('https://gpt.yapweijun1996.com/demo/v1');
    expect(DEMO_CONFIG.projectId).toBe('github-pages');
  });
  it('mirrors the session timing the gateway documents (15 minute token)',()=> {
    expect(DEMO_CONFIG.sessionTtlSeconds).toBe(900);expect(DEMO_CONFIG.sessionRefreshSkewMs).toBe(30_000);
  });
  it('preserves the limits that used to be literals in the transport and panel',()=> {
    expect(DEMO_CONFIG.sendTimeoutMs).toBe(60000);expect(DEMO_CONFIG.responseLimitChars).toBe(64000);
    expect(DEMO_CONFIG.image.maxCount).toBe(4);expect(DEMO_CONFIG.image.maxUrlChars).toBe(5592508);
    expect(DEMO_CONFIG.image.maxTotalBytes).toBe(8*1024*1024);expect(DEMO_CONFIG.image.maxBodyBytes).toBe(12*1024*1024);
    expect(DEMO_CONFIG.image.maxBytes).toBe(4*1024*1024);
  });
  it('is immutable',()=> {
    expect(Object.isFrozen(DEMO_CONFIG)).toBe(true);expect(Object.isFrozen(DEMO_CONFIG.image)).toBe(true);
    expect(()=> { 'use strict'; DEMO_CONFIG.image.maxCount=99; }).toThrow();
  });
});
