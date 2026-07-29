import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const candidates = process.platform === "darwin" ? [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
] : process.platform === "win32" ? [
  `${process.env.PROGRAMFILES || "C:\\Program Files"}\\Google\\Chrome\\Application\\chrome.exe`,
  `${process.env.LOCALAPPDATA || ""}\\Google\\Chrome\\Application\\chrome.exe`
] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"];

const chrome = process.env.PRINTFORM_CHROME_PATH || candidates.find((candidate) => fs.existsSync(candidate));
if (!chrome) throw new Error("Google Chrome was not found. Set PRINTFORM_CHROME_PATH explicitly.");

const profile = path.resolve(process.cwd(), ".printform-studio/chrome-profile");
const studioUrl = process.env.PRINTFORM_STUDIO_URL || "https://yapweijun1996.github.io/printform-js/studio-v2/";
fs.mkdirSync(profile, { recursive: true });
const child = spawn(chrome, [
  `--user-data-dir=${profile}`,
  "--remote-debugging-port=9222",
  "--no-first-run",
  "--no-default-browser-check",
  "--enable-features=WebMCPTesting,DevToolsWebMCPSupport",
  `--app=${studioUrl}`
], { detached: true, stdio: "ignore" });
child.unref();
console.log(`Started isolated PrintForm Studio Chrome profile at ${studioUrl}`);
