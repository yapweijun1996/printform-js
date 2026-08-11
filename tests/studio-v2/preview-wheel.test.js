import { afterEach, describe, expect, it } from "vitest";
import { bindHorizontalWheel, bindPreviewWheel, scrollHorizontally, scrollPreviewHorizontally } from "../../studio-v2/ui/preview-wheel.js";

function createViewport({ scrollLeft = 0, scrollWidth = 800, clientWidth = 400 } = {}) {
  const viewport = document.createElement("div");
  Object.defineProperties(viewport, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
    scrollLeft: { configurable: true, writable: true, value: scrollLeft }
  });
  document.body.append(viewport);
  return viewport;
}

function wheel({ deltaX = 0, deltaY = 0, ctrlKey = false } = {}) {
  const event = new Event("wheel", { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    deltaX: { value: deltaX }, deltaY: { value: deltaY }, ctrlKey: { value: ctrlKey }
  });
  return event;
}

describe("horizontal wheel scrolling", () => {
  let viewport;

  afterEach(() => {
    viewport?.remove();
    viewport = undefined;
  });

  it("maps vertical wheel down to horizontal scrolling right", () => {
    viewport = createViewport();
    const event = wheel({ deltaY: 120 });

    expect(scrollPreviewHorizontally(viewport, event)).toBe(true);

    expect(viewport.scrollLeft).toBe(120);
  });

  it("prevents a direct parent wheel event after consuming it", () => {
    viewport = createViewport();
    const dispose = bindPreviewWheel(viewport);
    const event = wheel({ deltaY: 120 });

    viewport.dispatchEvent(event);

    expect(viewport.scrollLeft).toBe(120);
    expect(event.defaultPrevented).toBe(true);
    dispose();
  });

  it("binds the same wheel behavior to a topbar action scroller", () => {
    viewport = createViewport();
    const dispose = bindHorizontalWheel(viewport);
    viewport.dispatchEvent(wheel({ deltaY: 120 }));

    expect(viewport.scrollLeft).toBe(120);
    dispose();
  });

  it("maps vertical wheel up to horizontal scrolling left", () => {
    viewport = createViewport({ scrollLeft: 200 });
    const event = wheel({ deltaY: -80 });

    expect(scrollPreviewHorizontally(viewport, event)).toBe(true);

    expect(viewport.scrollLeft).toBe(120);
  });

  it("preserves native horizontal input, pinch zoom and edge bubbling", () => {
    viewport = createViewport({ scrollLeft: 400 });

    const horizontal = wheel({ deltaX: 40, deltaY: 20 });
    expect(scrollPreviewHorizontally(viewport, horizontal)).toBe(false);

    const pinch = wheel({ deltaY: 40, ctrlKey: true });
    expect(scrollPreviewHorizontally(viewport, pinch)).toBe(false);

    const edge = wheel({ deltaY: 100 });
    expect(scrollPreviewHorizontally(viewport, edge)).toBe(false);
    expect(viewport.scrollLeft).toBe(400);
  });

  it("keeps the preview alias behavior stable", () => {
    viewport = createViewport();
    expect(scrollHorizontally(viewport, wheel({ deltaY: 40 }))).toBe(true);
    expect(scrollPreviewHorizontally(viewport, wheel({ deltaY: 40 }))).toBe(true);
    expect(viewport.scrollLeft).toBe(80);
  });
});
