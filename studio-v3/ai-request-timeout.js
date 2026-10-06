// An AbortSignal that follows the caller's signal and also aborts after `ms`.
// timedOut() tells the two apart, so a caller's Stop stays a cancellation, not a timeout.
// The cause is decided when the timer fires, not later, so a Stop that comes after a timeout
// cannot rewrite what happened.
export function withTimeout(signal, ms) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort(signal.reason);
  const timer = setTimeout(() => { if (!signal?.aborted) { timedOut = true; controller.abort(); } }, ms);
  if (signal?.aborted) abortFromCaller(); else signal?.addEventListener('abort',abortFromCaller,{once:true});
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => { clearTimeout(timer); signal?.removeEventListener('abort',abortFromCaller); }
  };
}
