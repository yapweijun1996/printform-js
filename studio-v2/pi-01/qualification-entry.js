import { createPiByokAdapter, PI01_PROVIDER_DEFAULTS } from "./provider-transport.js";

const QUALIFICATION_KEY = "__PI_01_QUALIFICATION__";
const PIN = Object.freeze({
  sourceCommit: "b2602be77cb7b0de45dd616407fd210daa48aa75",
  aiPackage: "@earendil-works/pi-ai@0.85.1",
  providers: ["openai-responses", "openai-completions", "google-generative-ai"]
});

function browserRuntime() {
  return {
    process: typeof globalThis.process,
    require: typeof globalThis.require,
    Buffer: typeof globalThis.Buffer,
    nodeGlobalsAbsent: [globalThis.process, globalThis.require, globalThis.Buffer].every((value) => value === undefined)
  };
}

globalThis[QUALIFICATION_KEY] = Object.freeze({
  id: "PI-01",
  status: "ready",
  pin: PIN,
  browser: browserRuntime(),
  defaultEndpoints: PI01_PROVIDER_DEFAULTS,
  createAdapter: createPiByokAdapter
});
