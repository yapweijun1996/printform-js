import { describe, expect, it } from "vitest";
import { allowedStudioUrl } from "../../mcp/cdp-client.mjs";

describe("PrintForm first-party CDP target policy", () => {
  const origins = ["https://yapweijun1996.github.io", "http://127.0.0.1:5173"];

  it("allows only Studio v2 paths on explicit origins", () => {
    expect(allowedStudioUrl("https://yapweijun1996.github.io/printform-js/studio-v2/", origins)).toBe(true);
    expect(allowedStudioUrl("http://127.0.0.1:5173/studio-v2/", origins)).toBe(true);
    expect(allowedStudioUrl("https://yapweijun1996.github.io/printform-js/studio/", origins)).toBe(false);
    expect(allowedStudioUrl("https://evil.example/studio-v2/", origins)).toBe(false);
  });
});
