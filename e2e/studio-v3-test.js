import { test as base, expect } from '@playwright/test';
export { expect };

// Studio v3 specs run without a service worker so cached builds cannot leak between tests.
// Playwright's own `serviceWorkers: 'block'` injects a script into every frame, including the sandboxed
// preview iframe, where reading navigator.serviceWorker throws and was reported as a render error.
// This blocks registration in the top frame only. Opt out per group with test.use({blockServiceWorkers: false}).
const blockRegistration = () => {
  if (window !== window.top || !navigator.serviceWorker) return;
  navigator.serviceWorker.register = () => Promise.reject(new DOMException('Service workers are blocked in this test.', 'SecurityError'));
};
export const test = base.extend({
  blockServiceWorkers: [true, {option: true}],
  context: async ({context, blockServiceWorkers}, use) => {
    if (blockServiceWorkers) await context.addInitScript(blockRegistration);
    await use(context);
  }
});
