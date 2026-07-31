import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectAppShell } from "../scripts/app-shell.mjs";

// sw.js used to carry this list by hand. Adding a module without remembering
// to list it broke offline loading twice in one day, so the list is generated
// from the built output now — and this is what keeps the generator honest.

let workspace;

function makeOutput(files) {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), "printform-shell-"));
  for (const [relative, contents] of Object.entries(files)) {
    const absolute = path.join(workspace, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, contents);
  }
  return workspace;
}

afterEach(() => {
  if (workspace) fs.rmSync(workspace, { recursive: true, force: true });
  workspace = undefined;
});

describe("service worker precache manifest", () => {
  it("collects every studio file, at any nesting depth, without being told about it", () => {
    const shell = collectAppShell(makeOutput({
      "studio-v2/index.html": "<html>",
      "studio-v2/manifest.webmanifest": "{}",
      "studio-v2/agent-setup.json": "{}",
      "studio-v2/llms.txt": "text",
      "studio-v2/styles/base.css": "css",
      "studio-v2/ui/app.js": "js",
      "studio-v2/ui/locales/en.js": "js",
      "studio-v2/core/deeply/nested/module.js": "js"
    }));
    expect(shell).toContain("./");
    expect(shell).toContain("./index.html");
    expect(shell).toContain("./agent-setup.json");
    expect(shell).toContain("./llms.txt");
    expect(shell).toContain("./styles/base.css");
    expect(shell).toContain("./ui/locales/en.js");
    // The point of generating it: a module nobody remembered to register is
    // still cached, because the walker found it on disk.
    expect(shell).toContain("./core/deeply/nested/module.js");
  });

  it("excludes the worker itself and the generated pilot exports", () => {
    const shell = collectAppShell(makeOutput({
      "studio-v2/index.html": "<html>",
      "studio-v2/sw.js": "self",
      "studio-v2/samples/catalog.js": "js",
      "studio-v2/samples/sales-invoice-v2.html": "<html>",
      "studio-v2/samples/purchase-order-red-v2.html": "<html>"
    }));
    // A worker caching itself is pointless; the pilot exports are large demo
    // artifacts, not part of the shell.
    expect(shell).not.toContain("./sw.js");
    expect(shell.some((entry) => entry.endsWith("-v2.html"))).toBe(false);
    // Sample *modules* are still shell — only the generated HTML is skipped.
    expect(shell).toContain("./samples/catalog.js");
  });

  it("includes both runtimes from outside studio-v2, and omits them when absent", () => {
    const withRuntimes = collectAppShell(makeOutput({
      "studio-v2/index.html": "<html>",
      "dist/printform.js": "js",
      "dist/printform-document.js": "js"
    }));
    expect(withRuntimes).toContain("../dist/printform.js");
    expect(withRuntimes).toContain("../dist/printform-document.js");

    const withoutRuntimes = collectAppShell(makeOutput({ "studio-v2/index.html": "<html>" }));
    // Listing a file that isn't there makes cache.addAll reject and the whole
    // install fail, taking offline support with it.
    expect(withoutRuntimes.some((entry) => entry.startsWith("../dist/"))).toBe(false);
  });

  it("is deterministic so the generated worker diffs cleanly", () => {
    const files = { "studio-v2/index.html": "<html>", "studio-v2/b.js": "js", "studio-v2/a.js": "js", "studio-v2/ui/z.js": "js" };
    const first = collectAppShell(makeOutput(files));
    const second = collectAppShell(makeOutput(files));
    expect(first).toEqual(second);
    // readdir order is filesystem-dependent, so the sort is what makes it so.
    expect(first.indexOf("./a.js")).toBeLessThan(first.indexOf("./b.js"));
    expect(first[0]).toBe("./");
  });
});
