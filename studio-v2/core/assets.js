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
