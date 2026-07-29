import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { createSalesInvoiceProject } from "../studio-v2/samples/sales-invoice.js";
import { createPurchaseOrderProject } from "../studio-v2/samples/purchase-order.js";
import { validateProject } from "../studio-v2/core/acceptance.js";
import { serializeStandalone } from "../studio-v2/core/project-model.js";

const root = process.cwd();
const output = path.resolve(root, "site-dist");
const allowedDirectories = ["dist", "docs", "img", "studio", "studio-v2"];
const allowedRootFiles = ["index.html", "README.md", "README.zh-CN.md"];

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
}

async function writePilotExports() {
  const runtimeSource = fs.readFileSync(path.resolve(root, "dist/printform-document.js"), "utf8");
  const printformSource = fs.readFileSync(path.resolve(root, "dist/printform.js"), "utf8");
  globalThis.DOMParser = new JSDOM("").window.DOMParser;
  const samples = path.resolve(output, "studio-v2/samples");
  fs.mkdirSync(samples, { recursive: true });
  const pilots = [
    ["sales-invoice-v2.html", createSalesInvoiceProject()],
    ["purchase-order-red-v2.html", createPurchaseOrderProject()]
  ];
  for (const [filename, project] of pilots) {
    const validation = validateProject(project);
    const html = await serializeStandalone(project, { documentRuntime: runtimeSource, printform: printformSource, runtimeVersion: "2.0.0" }, validation);
    fs.writeFileSync(path.resolve(samples, filename), html, "utf8");
  }
}

function finalizePwa() {
  const serviceWorker = path.resolve(output, "studio-v2/sw.js");
  const buildId = (process.env.GITHUB_SHA || "local").slice(0, 12);
  const source = fs.readFileSync(serviceWorker, "utf8").replace("__PRINTFORM_BUILD__", buildId);
  fs.writeFileSync(serviceWorker, source, "utf8");
}

prepareOutput();
copyAllowlist();
await writePilotExports();
finalizePwa();
console.log(`GitHub Pages artifact ready: ${output}`);
