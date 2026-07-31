import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] || "site-dist");
const port = Number(process.env.PORT || 4174);
const types = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".md": "text/markdown; charset=utf-8"
};

function resolveRequest(url) {
  // decodeURIComponent throws URIError on malformed escapes (e.g. "/%zz");
  // an uncaught throw here would crash the whole server on one bad request.
  try {
    const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
    const candidate = path.resolve(root, `.${pathname}`);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
    const stat = fs.statSync(candidate);
    return stat.isDirectory() ? path.resolve(candidate, "index.html") : candidate;
  } catch { return null; }
}

http.createServer((request, response) => {
  const filename = resolveRequest(request.url);
  if (!filename || !fs.existsSync(filename)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }
  response.writeHead(200, {
    "Content-Type": types[path.extname(filename).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  const stream = fs.createReadStream(filename);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`Serving ${root} at http://127.0.0.1:${port}`));
