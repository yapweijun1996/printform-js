import fs from "node:fs";
import path from "node:path";

// Every file the Studio needs to boot offline, derived from the built output.
// This replaced a hand-written list inside sw.js: that list silently drifted
// twice when new modules were added, and the only symptom is a 404 after the
// network drops, with nothing in the app explaining why.
//
// Kept in its own module (rather than inside build-site.mjs) so it can be unit
// tested — importing build-site.mjs would run its top-level build, wiping
// site-dist as a side effect.
//
// Deliberately takes everything it finds instead of curating by extension or
// path. Curating is exactly what drifted before, and the cost of being
// generous is small: the four files the old hand-written list happened to miss
// (core/runtime.js, package.json, PROTOCOL_EXTENSIONS.md, TYPOGRAPHY.md) add
// 20 KB to a ~400 KB shell. The two explicit exclusions below are the only
// ones worth their risk.
export function collectAppShell(outputDir) {
  const studioRoot = path.resolve(outputDir, "studio-v2");
  const shell = ["./"];
  const walk = (dir) => {
    // Sorted so the generated manifest is deterministic across machines and
    // a diff of the built sw.js stays readable.
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.resolve(dir, entry.name);
      if (entry.isDirectory()) { walk(absolute); continue; }
      const relative = path.relative(studioRoot, absolute).split(path.sep).join("/");
      // The worker caching itself serves no purpose, and the generated pilot
      // exports are large demo artifacts rather than part of the app shell.
      if (relative === "sw.js") continue;
      if (relative.startsWith("samples/") && relative.endsWith(".html")) continue;
      shell.push(`./${relative}`);
    }
  };
  walk(studioRoot);
  // Both runtimes live outside studio-v2, but the Studio cannot render without
  // them, so they belong in the shell despite the relative path.
  ["printform.js", "printform-document.js"].forEach((name) => {
    if (fs.existsSync(path.resolve(outputDir, "dist", name))) shell.push(`../dist/${name}`);
  });
  return shell;
}
