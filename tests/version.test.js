import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import api from "../src/printform.js";
import { PRINTFORM_VERSION } from "../src/version.js";
import { AGENT_CONTRACT_VERSION, PROTOCOL_VERSION, STUDIO_VERSION } from "../studio-v2/core/constants.js";

const SEMVER = /^\d+\.\d+\.\d+$/;

// The four lines version independently on purpose (docs/COMPATIBILITY_MATRIX.zh-CN.md).
// These tests exist to stop the DERIVED copies from drifting, not to freeze the
// numbers themselves — bumping a version should require touching exactly one
// source of truth, and anything that copies it must be checked by a machine
// rather than by remembering.
describe("independent SemVer lines", () => {
  it("declares a valid SemVer for each line", () => {
    for (const version of [PRINTFORM_VERSION, STUDIO_VERSION, PROTOCOL_VERSION, AGENT_CONTRACT_VERSION]) {
      expect(version).toMatch(SEMVER);
    }
  });

  it("keeps package.json's version equal to the engine version", () => {
    // package.json tracks the pagination engine's line because dist/printform.js
    // is what this package publishes; src/version.js is the source of truth and
    // package.json is the copy, so this asserts the copy, not the original.
    const pkg = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../package.json"), "utf8"));
    expect(pkg.version).toBe(PRINTFORM_VERSION);
  });

  it("exposes the engine version on the public PrintForm API", () => {
    // Consumers debugging a paginated document in a browser console need a way
    // to tell which engine build produced it; a hardcoded string here would
    // drift from src/version.js the first time someone bumped only one of them.
    expect(api.version).toBe(PRINTFORM_VERSION);
  });

  it("keeps the Studio below 1.0.0 while maturity is Production Pilot", () => {
    // Guards the specific decision recorded in constants.js: the version number
    // must not claim a maturity the maintainer has not announced. If Production
    // Ready is declared and Studio goes 1.x, this test should be deleted with
    // that change, not silently relaxed.
    const roadmap = fs.readFileSync(path.resolve(import.meta.dirname, "../ROADMAP.md"), "utf8");
    const stillPilot = roadmap.includes("当前仍是 Production Pilot");
    if (stillPilot) expect(Number(STUDIO_VERSION.split(".")[0])).toBe(0);
  });
});
