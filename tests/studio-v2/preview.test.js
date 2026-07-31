import { describe, it, expect, afterEach } from "vitest";
import { listenForPreview } from "../../studio-v2/ui/preview.js";

describe("listenForPreview identity check", () => {
  let stop;

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  it("accepts a message whose event.source is the preview iframe's contentWindow", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const received = [];
    stop = listenForPreview(iframe, (message) => received.push(message));

    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { source: "printform-studio-v2-preview", type: "rendered", revision: 1, payload: { status: "ready" } }
    }));

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("rendered");
    document.body.removeChild(iframe);
  });

  it("ignores a message with the right payload shape from any other window", () => {
    // The "source" string inside the payload is exactly what a hostile page
    // holding a handle to Studio (an opener, an embedder) would forge — the
    // only thing that can't be forged is the actual sender window identity.
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const impostor = document.createElement("iframe");
    document.body.appendChild(impostor);
    const received = [];
    stop = listenForPreview(iframe, (message) => received.push(message));

    window.dispatchEvent(new MessageEvent("message", {
      source: impostor.contentWindow,
      data: { source: "printform-studio-v2-preview", type: "rendered", revision: 1, payload: { status: "ready", metrics: { overflowElements: 999 } } }
    }));

    expect(received).toHaveLength(0);
    document.body.removeChild(iframe);
    document.body.removeChild(impostor);
  });

  it("ignores messages with no event.source at all", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const received = [];
    stop = listenForPreview(iframe, (message) => received.push(message));

    window.dispatchEvent(new MessageEvent("message", {
      data: { source: "printform-studio-v2-preview", type: "rendered", revision: 1, payload: {} }
    }));

    expect(received).toHaveLength(0);
    document.body.removeChild(iframe);
  });

  it("stops receiving after the returned dispose function is called", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const received = [];
    const dispose = listenForPreview(iframe, (message) => received.push(message));
    dispose();

    window.dispatchEvent(new MessageEvent("message", {
      source: iframe.contentWindow,
      data: { source: "printform-studio-v2-preview", type: "rendered", revision: 1, payload: {} }
    }));

    expect(received).toHaveLength(0);
    document.body.removeChild(iframe);
  });
});
