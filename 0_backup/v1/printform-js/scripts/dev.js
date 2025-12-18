#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

function parseArgs(argv) {
  const args = {
    host: "127.0.0.1",
    port: 8000,
    watch: false
  };

  for (const raw of argv.slice(2)) {
    if (raw === "--watch") {
      args.watch = true;
      continue;
    }

    const match = raw.match(/^--(host|port)=(.+)$/);
    if (!match) {
      throw new Error(`Unknown argument: ${raw}`);
    }

    const [, key, value] = match;
    if (key === "host") {
      args.host = value;
      continue;
    }

    if (key === "port") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error(`Invalid --port value: ${value}`);
      }
      args.port = parsed;
    }
  }

  return args;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function toSafePath(repoRoot, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const withoutQuery = decoded.split("?")[0].split("#")[0];
  const normalized = path.normalize(withoutQuery).replace(/^([/\\])+/, "");
  const absPath = path.resolve(repoRoot, normalized);

  const rel = path.relative(repoRoot, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }

  return absPath;
}

function serveFile(req, res, filePath) {
  fs.stat(filePath, (statErr, stat) => {
    if (statErr) {
      res.statusCode = statErr.code === "ENOENT" ? 404 : 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end(res.statusCode === 404 ? "Not Found" : "Internal Server Error");
      return;
    }

    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    fs.readFile(finalPath, (readErr, data) => {
      if (readErr) {
        res.statusCode = readErr.code === "ENOENT" ? 404 : 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(res.statusCode === 404 ? "Not Found" : "Internal Server Error");
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", contentTypeFor(finalPath));
      res.end(data);
    });
  });
}

function runBuild(repoRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(repoRoot, "scripts/build.js")], {
      cwd: repoRoot,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`build failed with exit code ${code}`));
    });
  });
}

function watchAndRebuild(repoRoot) {
  const watchRoots = [
    path.join(repoRoot, "js"),
    path.join(repoRoot, "scripts")
  ];

  const watchers = [];
  let building = false;
  let pending = false;
  let debounceTimer = null;

  function shouldIgnoreFilename(filename) {
    const normalized = filename.replace(/\\/g, "/");
    if (normalized.startsWith("dist/")) return true;
    if (normalized.startsWith("node_modules/")) return true;
    if (normalized.startsWith(".git/")) return true;
    return false;
  }

  async function buildOnce() {
    if (building) {
      pending = true;
      return;
    }

    building = true;
    try {
      await runBuild(repoRoot);
    } catch (error) {
      console.error(error && error.stack ? error.stack : String(error));
    } finally {
      building = false;
      if (pending) {
        pending = false;
        queueBuild();
      }
    }
  }

  function queueBuild() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(buildOnce, 100);
  }

  function watchDir(dirPath, options) {
    const watcher = fs.watch(dirPath, options, (eventType, filename) => {
      if (!filename) return;
      if (shouldIgnoreFilename(String(filename))) return;
      queueBuild();
    });
    watchers.push(watcher);
  }

  function collectDirectories(startDir) {
    const dirs = [startDir];
    const stack = [startDir];

    while (stack.length) {
      const current = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === ".git") continue;
        const next = path.join(current, entry.name);
        dirs.push(next);
        stack.push(next);
      }
    }

    return dirs;
  }

  for (const root of watchRoots) {
    if (!fs.existsSync(root)) continue;
    try {
      watchDir(root, { recursive: true });
    } catch {
      for (const dirPath of collectDirectories(root)) {
        watchDir(dirPath, {});
      }
    }
  }

  return () => {
    for (const watcher of watchers) watcher.close();
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(__dirname, "..");
  const distFile = path.join(repoRoot, "dist/printform.js");

  if (args.watch || !fs.existsSync(distFile)) {
    await runBuild(repoRoot);
    if (args.watch) {
      watchAndRebuild(repoRoot);
    }
  }

  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.statusCode = 400;
      res.end("Bad Request");
      return;
    }

    const target = toSafePath(repoRoot, req.url);
    if (!target) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Bad Request");
      return;
    }

    serveFile(req, res, target);
  });

  server.listen(args.port, args.host, () => {
    console.log(`Dev server: http://${args.host}:${args.port}/`);
    console.log("Try: /index.html or /example.html");
    if (args.watch) {
      console.log("Watch mode: rebuilding dist/printform.js on changes under js/ and scripts/");
    }
  });
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
