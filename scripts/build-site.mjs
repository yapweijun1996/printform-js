import fs from "node:fs";
import path from "node:path";
import { buildStudioV3 } from './build-studio-v3.mjs';
import { finalizeStudioV3Pwa } from './studio-v3-pwa.mjs';
import { finalizeGalleryPwa } from "./gallery-pwa-build.mjs";

const root = process.cwd();
const output = path.resolve(root, "site-dist");
const allowedDirectories = ["dist", "docs", "gallery", "homepage", "img", "document-core", "studio-v3"];
const allowedRootFiles = ["index.html", "README.md", "README.zh-CN.md", "mobile-debug-test.html", "multiple_page_preview.html"];

function copy(source, destination) {
  fs.cpSync(source, destination, { recursive: true, filter: (entry) => !entry.includes("site-dist") });
}

function prepareOutput() {
  if (path.basename(output) !== "site-dist") throw new Error("Refusing to clean an unexpected output path");
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
}

function copyAllowlist() {
  allowedRootFiles.forEach((name) => {
    const source = path.resolve(root, name);
    if (fs.existsSync(source)) copy(source, path.resolve(output, name));
  });
  fs.readdirSync(root).filter((name) => /^(demo|index\d|delivery_order|index_subtotal).*\.html$/.test(name)).forEach((name) => copy(path.resolve(root, name), path.resolve(output, name)));
  allowedDirectories.forEach((name) => {
    const source = path.resolve(root, name);
    if (fs.existsSync(source)) copy(source, path.resolve(output, name));
  });
  // Published ERP project modules import this browser-only paper helper.
  // Copy the explicit leaf, not the whole source tree or local configuration.
  const helper = "src/printform/helpers.js";
  fs.mkdirSync(path.dirname(path.resolve(output, helper)), { recursive: true });
  copy(path.resolve(root, helper), path.resolve(output, helper));
}

prepareOutput();
copyAllowlist();
// Let browsers with the old cache-first worker release its scope on update.
const retiredStudio = path.resolve(output, "studio-v2");
fs.mkdirSync(retiredStudio);
copy(path.resolve(root, "scripts/retire-studio-v2-worker.js"), path.resolve(retiredStudio, "sw.js"));
await buildStudioV3({ root, output });
finalizeStudioV3Pwa(output);
finalizeGalleryPwa(output);
console.log(`GitHub Pages artifact ready: ${output}`);
