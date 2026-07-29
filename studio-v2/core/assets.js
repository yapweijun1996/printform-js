import { cloneProject } from "./operations.js";

function isEmbeddableUrl(url) {
  if (!url || url.startsWith("data:") || url.startsWith("#")) return false;
  if (url.startsWith("blob:")) {
    const error = new Error("Blob asset URLs cannot be preserved in a standalone HTML export");
    error.code = "BLOB_ASSET_UNSUPPORTED";
    throw error;
  }
  return true;
}

export function validAssetSource(source) {
  const value = String(source || "").trim();
  if (/^data:image\/(?:png|jpeg|gif|webp|svg\+xml)(?:;[^,]*)?,/i.test(value)) return true;
  if (/^https:\/\//i.test(value)) return true;
  return /^(?:\.\.?\/|\/)[^\s]+/.test(value);
}

export function validateAssetSlots(project) {
  const errors = [];
  const doc = new DOMParser().parseFromString(`<template id="pf-asset-scan">${project.templateHtml || ""}</template>`, "text/html");
  const nodes = Array.from(doc.getElementById("pf-asset-scan").content.querySelectorAll("[data-pf-asset-slot]"));
  nodes.forEach((node) => {
    const slot = node.getAttribute("data-pf-asset-slot") || "";
    const path = `/template/assets/${slot || "unknown"}`;
    if (!/^[a-z][a-z0-9-]*$/.test(slot)) errors.push({ code: "ASSET_SLOT_INVALID", message: `Invalid asset slot: ${slot}`, path, severity: "error" });
    if (!validAssetSource(node.getAttribute("src"))) errors.push({ code: "ASSET_SOURCE_UNSAFE", message: `Asset slot ${slot} requires an inline image, relative path, or HTTPS URL`, path, severity: "error" });
    if (!node.getAttribute("alt")?.trim()) errors.push({ code: "ASSET_ALT_MISSING", message: `Asset slot ${slot} requires alt text`, path, severity: "error" });
  });
  (project.manifest?.assets?.requiredSlots || []).forEach((slot) => {
    const count = nodes.filter((node) => node.getAttribute("data-pf-asset-slot") === slot).length;
    if (count !== 1) errors.push({ code: "ASSET_SLOT_REQUIRED", message: `Required asset slot ${slot} must occur exactly once; found ${count}`, path: `/manifest/assets/requiredSlots/${slot}`, severity: "error" });
  });
  return { valid: errors.length === 0, errors, slots: nodes.map((node) => node.getAttribute("data-pf-asset-slot")) };
}

async function toDataUrl(url) {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`Asset ${url} returned HTTP ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(`Cannot read asset ${url}`));
    reader.readAsDataURL(blob);
  });
}

async function checkExternal(url) {
  const response = await fetch(url, { method: "HEAD", credentials: "omit" });
  if (!response.ok) throw new Error(`External asset ${url} returned HTTP ${response.status}`);
}

async function rewriteCssUrls(css, baseUrl, allowExternal, warnings) {
  const matches = [...css.matchAll(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi)];
  let rewritten = css;
  for (const match of matches) {
    const raw = match[2].trim();
    if (!isEmbeddableUrl(raw)) continue;
    const absolute = new URL(raw, baseUrl).href;
    if (allowExternal && absolute.startsWith("https:")) {
      await checkExternal(absolute);
      warnings.push({ code: "EXTERNAL_ASSET", message: `External asset retained: ${absolute}` });
      continue;
    }
    const dataUrl = await toDataUrl(absolute);
    rewritten = rewritten.replace(match[0], `url("${dataUrl}")`);
  }
  return rewritten;
}

export async function inlineProjectAssets(project, baseUrl = document.baseURI) {
  const result = cloneProject(project);
  const warnings = [];
  const allowExternal = Boolean(project.manifest.assets?.allowExternalHttps);
  const template = document.createElement("template");
  template.innerHTML = result.templateHtml;
  const nodes = template.content.querySelectorAll("img[src],source[src]");
  for (const node of nodes) {
    const raw = node.getAttribute("src");
    if (!isEmbeddableUrl(raw)) continue;
    const absolute = new URL(raw, baseUrl).href;
    if (allowExternal && absolute.startsWith("https:")) {
      await checkExternal(absolute);
      warnings.push({ code: "EXTERNAL_ASSET", message: `External asset retained: ${absolute}` });
    } else node.setAttribute("src", await toDataUrl(absolute));
  }
  result.templateHtml = template.innerHTML.trim();
  result.themeCss = await rewriteCssUrls(result.themeCss, baseUrl, allowExternal, warnings);
  return { project: result, warnings };
}
