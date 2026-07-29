import path from "node:path";
import { build } from "vite";

const root = process.cwd();

await build({
  configFile: false,
  logLevel: "warn",
  build: {
    outDir: path.resolve(root, "dist"),
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: path.resolve(root, "src/document-runtime-entry.js"),
      name: "PrintFormDocumentRuntime",
      formats: ["iife"],
      fileName: () => "printform-document.js"
    }
  }
});
