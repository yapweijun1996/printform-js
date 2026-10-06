import { describe,it,expect,vi,beforeEach,afterEach } from 'vitest';
import { withTimeout } from '../studio-v3/ai-request-timeout.js';
beforeEach(()=> vi.useFakeTimers());
afterEach(()=> vi.useRealTimers());
describe('withTimeout',()=> {
  it('aborts after the limit and reports a timeout, not a cancellation',async()=> {
    const guard=withTimeout(undefined,1000);
    await vi.advanceTimersByTimeAsync(999);expect(guard.signal.aborted).toBe(false);expect(guard.timedOut()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);expect(guard.signal.aborted).toBe(true);expect(guard.timedOut()).toBe(true);guard.done();
  });
  it('follows the caller: Stop aborts at once and is not a timeout',()=> {
    const caller=new AbortController(),guard=withTimeout(caller.signal,60000);
    caller.abort();expect(guard.signal.aborted).toBe(true);expect(guard.timedOut()).toBe(false);guard.done();expect(vi.getTimerCount()).toBe(0);
  });
  it('passes the caller abort reason through',()=> {
    const caller=new AbortController(),guard=withTimeout(caller.signal,60000),reason=new Error('user stop');
    caller.abort(reason);expect(guard.signal.reason).toBe(reason);guard.done();
  });
  it('treats an already aborted caller as a cancellation and never as a timeout',async()=> {
    const caller=new AbortController();caller.abort();const guard=withTimeout(caller.signal,10);
    expect(guard.signal.aborted).toBe(true);await vi.advanceTimersByTimeAsync(50);expect(guard.timedOut()).toBe(false);guard.done();
  });
  it('keeps the cause when a Stop arrives after the timeout',async()=> {
    const caller=new AbortController(),guard=withTimeout(caller.signal,1000);
    await vi.advanceTimersByTimeAsync(1000);caller.abort();expect(guard.timedOut()).toBe(true);guard.done();
  });
  it('releases its timer and listener when finished',async()=> {
    const caller=new AbortController(),guard=withTimeout(caller.signal,1000);
    expect(vi.getTimerCount()).toBe(1);guard.done();expect(vi.getTimerCount()).toBe(0);
    caller.abort();expect(guard.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);expect(guard.timedOut()).toBe(false);
  });
});
