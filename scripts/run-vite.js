const { spawnSync } = require("node:child_process");
const path = require("node:path");

const viteBin = path.resolve(__dirname, "../node_modules/vite/bin/vite.js");

const env = {
  ...process.env,
  VITE_CJS_IGNORE_WARNING: process.env.VITE_CJS_IGNORE_WARNING || "1"
};

const result = spawnSync(process.execPath, [viteBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env
});

process.exit(typeof result.status === "number" ? result.status : 1);
