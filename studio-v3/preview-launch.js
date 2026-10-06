// How long the sandboxed preview gets to start and to render.
export const PREVIEW_TIMING = Object.freeze({
  // The bridge sends "hello" as soon as it runs; no hello means the navigation was lost.
  helloMs: 4_000,
  // Total times the document is put into the frame (the first one included).
  launches: 2,
  // Whole render budget, counted from the first launch.
  renderMs: 25_000
});
const NOT_STARTED = {code: 'PREVIEW_NOT_STARTED', message: 'The preview did not start. Retry, or reload the page if it keeps failing.'};
const TIMED_OUT = {code: 'RENDER_TIMEOUT', message: 'Rendering timed out. Check data size and retry.'};

// Puts a document into the preview frame and makes sure it really started.
// Under heavy load a browser can drop the srcdoc navigation, leaving an empty document that never
// reports back. So the frame must say hello; if it does not, the document is assigned again.
export class PreviewLaunch {
  constructor(frame) { this.frame = frame; this.helloTimer = null; this.renderTimer = null; }
  start(html, {onFailure}) {
    this.stop();
    this.html = html; this.launched = 0; this.onFailure = onFailure;
    this.renderTimer = setTimeout(() => this.fail(TIMED_OUT), PREVIEW_TIMING.renderMs);
    this.launch();
  }
  launch() {
    this.launched += 1;
    // A retry must differ from the first text, or the browser may see no change worth navigating for.
    this.frame.srcdoc = this.launched === 1 ? this.html : `${this.html}<!--launch ${this.launched}-->`;
    this.helloTimer = setTimeout(() => this.launched < PREVIEW_TIMING.launches ? this.launch() : this.fail(NOT_STARTED), PREVIEW_TIMING.helloMs);
  }
  hello() { clearTimeout(this.helloTimer); }
  stop() { clearTimeout(this.helloTimer); clearTimeout(this.renderTimer); }
  fail(error) { this.stop(); this.onFailure(error); }
}
