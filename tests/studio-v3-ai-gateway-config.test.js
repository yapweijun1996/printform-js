import { describe,it,expect } from 'vitest';
import { DEMO_CONFIG,isDemoAlias } from '../studio-v3/ai-gateway-config.js';
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
    expect(DEMO_CONFIG.sendTimeoutMs).toBe(225000);expect(DEMO_CONFIG.responseLimitChars).toBe(64000);
    expect(DEMO_CONFIG.image.maxCount).toBe(4);expect(DEMO_CONFIG.image.maxUrlChars).toBe(5592508);
    expect(DEMO_CONFIG.image.maxTotalBytes).toBe(8*1024*1024);expect(DEMO_CONFIG.maxBodyBytes).toBe(12*1024*1024);
    expect(DEMO_CONFIG.image.maxBytes).toBe(4*1024*1024);
  });
  it('is immutable',()=> {
    expect(Object.isFrozen(DEMO_CONFIG)).toBe(true);expect(Object.isFrozen(DEMO_CONFIG.image)).toBe(true);
    expect(()=> { 'use strict'; DEMO_CONFIG.image.maxCount=99; }).toThrow();
  });
});
describe('Demo model aliases',()=> {
  it('defaults to the gateway routing alias and bounds the list',()=> { expect(DEMO_CONFIG.defaultAlias).toBe('demo-auto');expect(DEMO_CONFIG.maxAliases).toBe(8); });
  it.each(['demo-auto','demo-openai-mini','demo-groq','demo-gemini','demo-a1','demo-fast'])('accepts %s',id=> expect(isDemoAlias(id)).toBe(true));
  it.each(['','demo-','private-model','gpt-5.4-mini','Demo-auto','demo-AUTO','demo auto','demo-auto"}','demo-a/b','demo-\u00e9','demo-'+'a'.repeat(41),null,undefined,42,{},['demo-auto']])('rejects %j',id=> expect(isDemoAlias(id)).toBe(false));
  it('accepts the longest allowed alias',()=> expect(isDemoAlias('demo-'+'a'.repeat(40))).toBe(true));
  it('has a default that is itself a valid alias',()=> expect(isDemoAlias(DEMO_CONFIG.defaultAlias)).toBe(true));
});
describe('Demo timeouts',()=> {
  it('gives each request its own cap and derives the Send total from them',()=> {
    const c=DEMO_CONFIG;
    expect(c.discoverTimeoutMs).toBe(15000);expect(c.modelTimeoutMs).toBe(60000);expect(c.maxModelRequests).toBe(3);
    expect(c.sendTimeoutMs).toBe(c.discoverTimeoutMs+c.maxModelRequests*(c.modelTimeoutMs+c.inspectionAllowanceMs));
  });
  it('keeps the model cap above the ~45 s a stalled provider takes, and the total above any single cap',()=> {
    expect(DEMO_CONFIG.modelTimeoutMs).toBeGreaterThan(45000);expect(DEMO_CONFIG.sendTimeoutMs).toBeGreaterThan(DEMO_CONFIG.modelTimeoutMs*DEMO_CONFIG.maxModelRequests);
  });
});

