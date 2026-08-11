import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_DIR = path.join(ROOT, "studio-v2", "vendor");
const BUNDLE_PATH = path.join(VENDOR_DIR, "agrun.min.js");
const PROVENANCE_PATH = path.join(VENDOR_DIR, "agrun.provenance.js");
const INDEX_PATH = path.join(ROOT, "studio-v2", "index.html");
const REPOSITORY = "https://github.com/yapweijun1996/Agent-Runtime-JavaScript";
const API_REPOSITORY = "yapweijun1996/Agent-Runtime-JavaScript";
const BRANCH = "main";
const BUNDLE_MARKERS = ["input_image", "Uint8Array"];

function parseArgs(argv) {
  const options = { apply: false, checkUpstream: false, commit: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") options.apply = true;
    else if (argument === "--check-upstream") options.checkUpstream = true;
    else if (argument === "--commit") options.commit = argv[++index];
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function digest(bytes) {
  const hash = crypto.createHash("sha256").update(bytes).digest();
  return { sha256: hash.toString("hex"), sri: `sha256-${hash.toString("base64")}` };
}

async function readProvenance() {
  const moduleUrl = `${pathToFileURL(PROVENANCE_PATH).href}?check=${Date.now()}`;
  const module = await import(moduleUrl);
  return module.AGRUN_VENDOR_PROVENANCE;
}

function readLocalFiles() {
  return {
    bytes: fs.readFileSync(BUNDLE_PATH),
    source: fs.readFileSync(BUNDLE_PATH, "utf8"),
    html: fs.readFileSync(INDEX_PATH, "utf8")
  };
}

function integrityFromHtml(html) {
  const match = html.match(/<script\s+src=["']\.\/vendor\/agrun\.min\.js["'][^>]*\bintegrity=["']([^"']+)["']/i);
  return match?.[1] || null;
}

async function verifyLocal() {
  const { bytes, source, html } = readLocalFiles();
  const provenance = await readProvenance();
  const actual = digest(bytes);
  const errors = [];

  if (provenance.repository !== REPOSITORY) errors.push("provenance repository is not the approved AGRUN repository");
  if (!/^[0-9a-f]{40}$/.test(provenance.commit || "")) errors.push("provenance commit is not a full SHA-1");
  if (provenance.sha256 !== actual.sha256) errors.push("provenance sha256 does not match agRun.min.js");
  if (provenance.upstreamSha256 !== actual.sha256) errors.push("upstreamSha256 does not match the exact vendored upstream bundle");
  if (provenance.sri !== actual.sri) errors.push("provenance SRI does not match agRun.min.js");
  if (Array.isArray(provenance.patches) && provenance.patches.length > 0) errors.push("local AGRUN patches are present; vendor the upstream bundle instead");
  if (BUNDLE_MARKERS.some((marker) => !source.includes(marker))) errors.push("bundle is missing the expected inline image transport markers");
  if (integrityFromHtml(html) !== actual.sri) errors.push("studio-v2/index.html integrity does not match agRun.min.js");

  if (errors.length > 0) {
    throw new Error(["AGRUN vendor integrity check failed:", ...errors.map((error) => `- ${error}`)].join("\n"));
  }
  return { provenance, ...actual };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { accept: "application/vnd.github+json", "user-agent": "printform-js-agrun-sync" }
  });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status}): ${url}`);
  return response.json();
}

async function resolveHead() {
  const result = await fetchJson(`https://api.github.com/repos/${API_REPOSITORY}/commits/${BRANCH}`);
  if (!/^[0-9a-f]{40}$/.test(result.sha || "")) throw new Error("GitHub returned an invalid AGRUN commit SHA");
  return result.sha;
}

async function fetchBundle(commit) {
  if (!/^[0-9a-f]{40}$/.test(commit || "")) throw new Error("AGRUN commit must be a full 40-character SHA-1");
  const url = `https://raw.githubusercontent.com/${API_REPOSITORY}/${commit}/agrun.min.js`;
  const response = await fetch(url, { headers: { "user-agent": "printform-js-agrun-sync" } });
  if (!response.ok) throw new Error(`AGRUN bundle download failed (${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) throw new Error("AGRUN bundle size is outside the safe limit");
  const source = bytes.toString("utf8");
  if (BUNDLE_MARKERS.some((marker) => !source.includes(marker))) throw new Error(`AGRUN ${commit} does not contain the expected media mapping fix`);
  return { bytes, source, ...digest(bytes) };
}

function provenanceSource(commit, sha256, sri, licenseStatus) {
  return `export const AGRUN_VENDOR_PROVENANCE = Object.freeze({
  repository: ${JSON.stringify(REPOSITORY)},
  commit: ${JSON.stringify(commit)},
  upstreamSha256: ${JSON.stringify(sha256)},
  patches: Object.freeze([]),
  sha256: ${JSON.stringify(sha256)},
  sri: ${JSON.stringify(sri)},
  licenseStatus: ${JSON.stringify(licenseStatus || "repository did not publish an explicit LICENSE at the pinned commit")}
});
`;
}

function updateHtmlIntegrity(html, sri) {
  const pattern = /(<script\s+src=["']\.\/vendor\/agrun\.min\.js["'][^>]*\bintegrity=["'])[^"']+(["'])/i;
  const updated = html.replace(pattern, `$1${sri}$2`);
  if (updated === html) throw new Error("could not find the AGRUN script integrity attribute in studio-v2/index.html");
  return updated;
}

async function applyBundle(commit) {
  const current = await readProvenance();
  const bundle = await fetchBundle(commit);
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  fs.writeFileSync(BUNDLE_PATH, bundle.bytes);
  fs.writeFileSync(PROVENANCE_PATH, provenanceSource(commit, bundle.sha256, bundle.sri, current.licenseStatus));
  fs.writeFileSync(INDEX_PATH, updateHtmlIntegrity(html, bundle.sri));
  return { commit, ...bundle };
}

function printHelp() {
  console.log(`Usage:\n  npm run check:agrun\n  npm run sync:agrun -- --apply [--commit <40-char-sha>]\n  npm run check:agrun:upstream`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();
  if (options.apply && options.checkUpstream) throw new Error("--apply and --check-upstream cannot be combined");

  if (options.apply) {
    const commit = options.commit || await resolveHead();
    const result = await applyBundle(commit);
    await verifyLocal();
    console.log(`AGRUN synced: ${result.commit} (${result.sha256})`);
    return;
  }

  const local = await verifyLocal();
  if (!options.checkUpstream) {
    console.log(`AGRUN vendor is valid: ${local.provenance.commit} (${local.sha256})`);
    return;
  }

  const upstreamCommit = await resolveHead();
  const upstream = await fetchBundle(upstreamCommit);
  const matches = local.provenance.commit === upstreamCommit && local.sha256 === upstream.sha256;
  console.log(`AGRUN upstream: ${upstreamCommit} (${upstream.sha256})`);
  console.log(`AGRUN vendored: ${local.provenance.commit} (${local.sha256})`);
  if (!matches) throw new Error("AGRUN upstream changed; run npm run sync:agrun -- --apply and review the diff");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
