import fs from "node:fs";
import path from "node:path";
import { build } from "vite";

const PI_SOURCE_COMMIT = "b2602be77cb7b0de45dd616407fd210daa48aa75";

export async function buildPi01({ root = process.cwd(), output = path.resolve(root, "site-dist") } = {}) {
  const source = path.resolve(root, "studio-v2/pi-01/qualification-entry.js");
  const qualificationOutput = path.resolve(output, "studio-v2/pi-01");
  if (!fs.existsSync(source)) throw new Error(`PI-01 source is missing: ${source}`);
  fs.mkdirSync(qualificationOutput, { recursive: true });

  await build({
    root,
    configFile: false,
    logLevel: "warn",
    build: {
      emptyOutDir: false,
      outDir: qualificationOutput,
      lib: { entry: source, formats: ["es"], fileName: () => "qualification-entry.js" },
      rollupOptions: { output: { entryFileNames: "qualification-entry.js", chunkFileNames: "chunks/[name]-[hash].js" } },
      minify: false,
      sourcemap: false
    }
  });

  const bundle = path.resolve(qualificationOutput, "qualification-entry.js");
  if (!fs.existsSync(bundle)) throw new Error(`PI-01 bundle was not created: ${bundle}`);
  const manifest = {
    id: "PI-01",
    sourceCommit: PI_SOURCE_COMMIT,
    entry: "qualification-entry.js",
    bytes: fs.statSync(bundle).size,
    format: "es",
    static: true,
    appBackend: false,
    providerProxy: false,
    directBrowserByok: true
  };
  fs.writeFileSync(path.resolve(qualificationOutput, "qualification-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`PI-01 qualification bundle: ${manifest.bytes} bytes`);
  return manifest;
}
