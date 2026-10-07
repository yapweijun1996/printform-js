import { DEMO_CONFIG } from './ai-gateway-config.js';
import { createSseParser } from './ai-sse.js';
import { failureCode, failureDetail } from './ai-gateway-errors.js';
import { fail } from './ai-edits.js';
// Progress is elapsed time plus the answer characters received so far. A timer keeps the elapsed
// time moving while the gateway is silent (for example while a model thinks).
export function createProgress(onProgress, now = () => Date.now()) {
  if (!onProgress) return {addChars() {}, stop() {}};
  const interval = DEMO_CONFIG.stream.progressIntervalMs, started = now();
  let chars = 0, last = -Infinity;
  const report = () => { const time = now(); if (time - last >= interval) { last = time; onProgress({chars,elapsedMs:time - started}); } };
  const ticker = setInterval(report,interval);
  report();
  return {addChars(count) { chars += count; report(); }, stop() { clearInterval(ticker); }};
}
export function progressText({chars,elapsedMs}) {
  const seconds = Math.floor(elapsedMs / 1000);
  return chars ? `Receiving response · ${chars.toLocaleString('en-US')} characters · ${seconds} s` : `Waiting for the AI service · ${seconds} s`;
}
export async function readJsonBody(reader, signal) {
  const decoder = new TextDecoder();
  let source = '';
  while (true) {
    const part = await reader.read(); if (part.done) break;
    source += decoder.decode(part.value,{stream:true});
    if (source.length > DEMO_CONFIG.responseLimitChars) throw fail('DEMO_RESPONSE_LIMIT');
  }
  signal.throwIfAborted();
  return JSON.parse(source + decoder.decode());
}
const streamError = detail => fail(failureCode(undefined,failureDetail({error:detail})));
// Reads a Responses event stream and returns the response object from response.completed, so a
// stream is judged by exactly the same rules as a plain body. Deltas only feed the progress.
export async function readEventStream(reader, signal, progress) {
  const decoder = new TextDecoder(), parser = createSseParser();
  let received = 0, completed = null;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    const text = decoder.decode(part.value,{stream:true});
    received += text.length;
    if (received > DEMO_CONFIG.stream.limitChars) throw fail('DEMO_RESPONSE_LIMIT');
    for (const frame of parser.push(text)) {
      let event; try { event = JSON.parse(frame.data); } catch { continue; }
      const type = event?.type || frame.event;
      if (type === 'response.output_text.delta' || type === 'response.function_call_arguments.delta') progress.addChars(String(event.delta ?? '').length);
      else if (type === 'response.completed') completed = event.response;
      else if (type === 'response.failed') throw streamError(event.response?.error);
      else if (type === 'error') throw streamError(event.error ?? event);
      else if (type === 'response.incomplete') throw fail('MALFORMED_PROPOSAL');
    }
  }
  signal.throwIfAborted();
  if (!completed) throw fail('MALFORMED_PROPOSAL');
  return completed;
}
