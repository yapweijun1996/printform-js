import { test as base, expect } from '@playwright/test';
import { AGENT_KEY } from '../studio-v3/agent-preference.js';
export { expect };

// Studio v3 specs run without a service worker so cached builds cannot leak between tests.
// Playwright's own `serviceWorkers: 'block'` injects a script into every frame, including the sandboxed
// preview iframe, where reading navigator.serviceWorker throws and was reported as a render error.
// This blocks registration in the top frame only. Opt out per group with test.use({blockServiceWorkers: false}).
const blockRegistration = () => {
  if (window !== window.top || !navigator.serviceWorker) return;
  navigator.serviceWorker.register = () => Promise.reject(new DOMException('Service workers are blocked in this test.', 'SecurityError'));
};
// Most specs test the single-step flow with a gateway that only knows single-step replies, so working in steps starts
// switched off. A spec about steps opts in with test.use({workInSteps: true}).
const keepSingleStep = key => { if (window === window.top) { try { localStorage.setItem(key,'off'); } catch { /* storage may be blocked */ } } };
export const test = base.extend({
  blockServiceWorkers: [true, {option: true}],
  workInSteps: [false, {option: true}],
  context: async ({context, blockServiceWorkers, workInSteps}, use) => {
    if (blockServiceWorkers) await context.addInitScript(blockRegistration);
    if (!workInSteps) await context.addInitScript(keepSingleStep, AGENT_KEY);
    await use(context);
  }
});
