import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 4174);
const types = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".md": "text/markdown; charset=utf-8"
};
const sensitiveSuffixes = [
  ".pem", ".key", ".p12", ".pfx", ".sqlite", ".sqlite3", ".sqlite-wal", ".sqlite-shm",
  ".sqlite3-wal", ".sqlite3-shm", ".db", ".db-wal", ".db-shm"
];
const identity = (left, right) => left.dev === right.dev && left.ino === right.ino;

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function isSensitive(pathname) {
  const parts = pathname.split(/[\\/]+/).filter(Boolean);
  const basename = (parts.at(-1) || "").toLowerCase();
  return parts.some((part) => part.startsWith(".")) || sensitiveSuffixes.some((suffix) => basename.endsWith(suffix));
}

function inspectPath(root, filename) {
  if (!isWithin(root, filename)) return null;
  const entries = [];
  let current = root;
  for (const part of ["", ...path.relative(root, filename).split(path.sep).filter(Boolean)]) {
    if (part) current = path.join(current, part);
    const stat = fs.lstatSync(current, { bigint: true });
    if (stat.isSymbolicLink()) return null;
    entries.push({ filename: current, stat });
  }
  return entries;
}

function unchanged(entries) {
  return entries.every(({ filename, stat }) => {
    const current = fs.lstatSync(filename, { bigint: true });
    return !current.isSymbolicLink() && identity(stat, current);
  });
}

export function selectSiteRoot(args = process.argv.slice(2), cwd = process.cwd()) {
  if (args.length) throw new Error("Custom preview roots are not supported; build and serve site-dist only.");
  const root = path.resolve(cwd, "site-dist");
  let stat;
  try { stat = fs.lstatSync(root); }
  catch { throw new Error("Missing site-dist; run `npm run build:site` before previewing."); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("site-dist must be a generated directory, not a link.");
  return root;
}

export function openSiteRequest(root, url) {
  let descriptor;
  try {
    const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
    if (isSensitive(pathname)) return null;
    const candidate = path.resolve(root, `.${pathname}`);
    let entries = inspectPath(root, candidate);
    if (!entries) return null;
    const candidateStat = entries.at(-1).stat;
    const filename = candidateStat.isDirectory() ? path.join(candidate, "index.html") : candidate;
    entries = inspectPath(root, filename);
    if (!entries || !entries.at(-1).stat.isFile()) return null;
    const canonicalRoot = fs.realpathSync(root);
    const canonicalFile = fs.realpathSync(filename);
    if (!isWithin(canonicalRoot, canonicalFile)) return null;
    descriptor = fs.openSync(canonicalFile, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    if (!identity(entries.at(-1).stat, fs.fstatSync(descriptor, { bigint: true })) || !unchanged(entries)) {
      throw new Error("Preview path changed while opening");
    }
    return { descriptor, filename: canonicalFile };
  } catch {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    return null;
  }
}

function serve() {
  const root = selectSiteRoot();
  http.createServer((request, response) => {
    const resource = openSiteRequest(root, request.url);
    if (!resource) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const stream = fs.createReadStream(resource.filename, { fd: resource.descriptor, autoClose: true });
    stream.on("error", () => response.destroy());
    response.writeHead(200, {
      "Content-Type": types[path.extname(resource.filename).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    stream.pipe(response);
  }).listen(port, "127.0.0.1", () => console.log(`Serving ${root} at http://127.0.0.1:${port}`));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) serve();
