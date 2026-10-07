import { describe,it,expect } from 'vitest';
import { classifyFailure,failureCode,failureDetail,readFailureBody } from '../studio-v3/ai-gateway-errors.js';
const reply = (status,body) => new Response(typeof body === 'string' ? body : JSON.stringify(body),{status});
describe('gateway failure classification',()=> {
  it.each([
    [400,{code:'DEMO_MEDIA_DISABLED'},'DEMO_MEDIA_ENDPOINT_BUG'],
    [400,{error:{code:'DEMO_MEDIA_DISABLED',message:'demo accepts text messages only'}},'DEMO_MEDIA_ENDPOINT_BUG'],
    [400,{error:'demo accepts text messages only'},'DEMO_MEDIA_ENDPOINT_BUG'],
    [400,{code:'SOMETHING_ELSE'},'DEMO_REQUEST_FAILED'],
    [401,{},'DEMO_SESSION_EXPIRED'],
    [403,{error:'demo origin is not registered'},'DEMO_SESSION_FORBIDDEN'],
    [429,{},'DEMO_RATE_LIMIT'],
    [429,{error:'slow down'},'DEMO_RATE_LIMIT'],
    [429,{code:'DEMO_ALL_ROUTES_EXHAUSTED'},'DEMO_ROUTES_EXHAUSTED'],
    [429,{error:{code:'DEMO_ALL_ROUTES_EXHAUSTED'}},'DEMO_ROUTES_EXHAUSTED'],
    [429,{code:'DEMO_SESSION_REQUEST_LIMIT'},'DEMO_SESSION_BUSY'],
    [429,{error:{code:'DEMO_SESSION_CONCURRENCY_LIMIT'}},'DEMO_SESSION_BUSY'],
    [429,{error:'daily token limit reached'},'DEMO_DAILY_LIMIT'],
    [429,{error:'demo daily budget exhausted'},'DEMO_DAILY_LIMIT'],
    [503,{code:'DEMO_ROUTER_DISABLED'},'DEMO_SERVICE_DISABLED'],
    [503,{error:'public demo is disabled'},'DEMO_SERVICE_DISABLED'],
    [503,{error:{code:'DEMO_ALL_ROUTES_EXHAUSTED'}},'DEMO_ROUTES_EXHAUSTED'],
    [503,{code:'UNKNOWN_PROVIDER_ERROR'},'DEMO_REQUEST_FAILED'],
    [504,{},'DEMO_GATEWAY_TIMEOUT'],
    [500,{},'DEMO_REQUEST_FAILED'],
    [502,{},'DEMO_REQUEST_FAILED']
  ])('HTTP %i %j -> %s',async(status,body,expected)=> expect(await classifyFailure(reply(status,body))).toBe(expected));
  it('classifies by status alone when the body is empty, not JSON, oversized or unreadable',async()=> {
    expect(await classifyFailure(reply(429,''))).toBe('DEMO_RATE_LIMIT');
    expect(await classifyFailure(reply(504,'<html>gateway timeout</html>'))).toBe('DEMO_GATEWAY_TIMEOUT');
    expect(await classifyFailure(reply(503,JSON.stringify({code:'DEMO_ROUTER_DISABLED',pad:'x'.repeat(9000)})))).toBe('DEMO_REQUEST_FAILED');
    expect(await classifyFailure({status:403})).toBe('DEMO_SESSION_FORBIDDEN');
    expect(await classifyFailure({status:503,clone() { throw new Error('locked'); }})).toBe('DEMO_REQUEST_FAILED');
    expect(await classifyFailure(undefined)).toBe('DEMO_REQUEST_FAILED');
  });
  it('does not consume the body that the caller may still read',async()=> {
    const response = reply(503,{code:'DEMO_ROUTER_DISABLED'});await classifyFailure(response);
    expect(response.bodyUsed).toBe(false);expect(await response.json()).toEqual({code:'DEMO_ROUTER_DISABLED'});
  });
  it('reads codes case-insensitively and ignores non-string fields',()=> {
    expect(failureDetail({code:'demo_router_disabled'}).code).toBe('DEMO_ROUTER_DISABLED');
    expect(failureDetail({code:42,error:{code:{x:1}}})).toEqual({code:'',message:''});
    expect(failureDetail(null)).toEqual({code:'',message:''});
  });
  it('treats a missing detail as an unknown failure',()=> expect(failureCode(503)).toBe('DEMO_REQUEST_FAILED'));
  it('returns an empty body for unreadable input',async()=> expect(await readFailureBody({})).toEqual({}));
});
