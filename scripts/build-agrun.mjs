import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAgrun, sha256 } from "./agrun-source-build.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "studio-v2/vendor/agrun.min.js");
const args = process.argv.slice(2);
if (args.length !== 1 || !["--check", "--apply"].includes(args[0])) throw new Error("Use --check or --apply");
const bytes = await buildAgrun();
if (args[0] === "--apply") fs.writeFileSync(target, bytes);
else if (!bytes.equals(fs.readFileSync(target))) throw new Error("AGRUN source rebuild differs from the vendored bundle");
console.log(`AGRUN V4 CSP-safe source rebuild: ${sha256(bytes)}`);
