const DANGEROUS_TAGS = new Set(["script", "iframe", "object", "embed", "base", "foreignobject"]);
const URL_ATTRIBUTES = new Set(["src", "srcset", "poster", "xlink:href"]);

function isExternalUrl(value) {
  return /^(?:https?:|\/\/)/i.test(String(value || "").trim());
}

function isJavascriptUrl(value) {
  return /^(?:javascript:|vbscript:|data:text\/html)/i.test(String(value || "").trim());
}

function scanSvgData(value) {
  if (!/^data:image\/svg\+xml/i.test(String(value || ""))) return false;
  try {
    const encoded = String(value).slice(String(value).indexOf(",") + 1);
    const decoded = decodeURIComponent(encoded);
    return /<script[\s>]|\bon\w+\s*=|javascript:/i.test(decoded);
  } catch {
    return true;
  }
}

function securityIssue(code, message, path) {
  return { code, message, path, severity: "error" };
}

export function isUnsafeAttribute(name, value, options = {}) {
  const attribute = String(name || "").toLowerCase();
  const text = String(value || "");
  if (attribute.startsWith("on")) return "EVENT_HANDLER_BLOCKED";
  if (["href", "src", "srcset", "poster", "xlink:href", "formaction"].includes(attribute) && isJavascriptUrl(text)) return "JAVASCRIPT_URL_BLOCKED";
  if (URL_ATTRIBUTES.has(attribute) && scanSvgData(text)) return "SVG_SCRIPT_BLOCKED";
  if (URL_ATTRIBUTES.has(attribute) && isExternalUrl(text) && options.allowExternalHttps !== true) return "EXTERNAL_ASSET_BLOCKED";
  return null;
}

function scanCss(css, options, path) {
  const errors = [];
  if (/@import\b|expression\s*\(|behavior\s*:|-moz-binding\s*:/i.test(css)) {
    errors.push(securityIssue("UNSAFE_CSS_BLOCKED", "CSS contains executable or remote-import behavior", path));
  }
  const externalUrls = String(css).match(/url\(\s*["']?([^"')]+)["']?\s*\)/gi) || [];
  externalUrls.forEach((entry) => {
    const value = entry.replace(/^.*?url\(\s*["']?/i, "").replace(/["']?\s*\)$/i, "");
    if (isJavascriptUrl(value) || (isExternalUrl(value) && options.allowExternalHttps !== true)) {
      errors.push(securityIssue("EXTERNAL_ASSET_BLOCKED", "CSS references a non-embedded asset", path));
    }
  });
  return errors;
}

export function scanTemplateSecurity(templateHtml, options = {}) {
  const errors = [];
  const externalAssets = [];
  const doc = new DOMParser().parseFromString(`<template id="pf-security">${templateHtml || ""}</template>`, "text/html");
  const root = doc.getElementById("pf-security");
  const content = root?.content || root;
  content?.querySelectorAll("*").forEach((node) => {
    const tag = String(node.tagName || "").toLowerCase();
    if (DANGEROUS_TAGS.has(tag)) errors.push(securityIssue("DANGEROUS_TAG_BLOCKED", `<${tag}> is not allowed in a trusted print artifact`, `template/${tag}`));
    Array.from(node.attributes || []).forEach((attribute) => {
      const isLinkAsset = tag === "link" && attribute.name.toLowerCase() === "href";
      const violation = isLinkAsset
        ? isUnsafeAttribute("src", attribute.value, options)
        : isUnsafeAttribute(attribute.name, attribute.value, options);
      if (violation) {
        if (violation === "EXTERNAL_ASSET_BLOCKED") externalAssets.push(attribute.value);
        errors.push(securityIssue(violation, `Attribute ${attribute.name} is not allowed in a trusted print artifact`, `template/${tag}/@${attribute.name}`));
      } else if ((URL_ATTRIBUTES.has(attribute.name.toLowerCase()) || isLinkAsset) && isExternalUrl(attribute.value)) {
        externalAssets.push(attribute.value);
      }
      if (attribute.name.toLowerCase() === "style") errors.push(...scanCss(attribute.value, options, `template/${tag}/@style`));
    });
    if (tag === "style") errors.push(...scanCss(node.textContent || "", options, "template/style"));
  });
  if (/\bjavascript\s*:/i.test(String(templateHtml || ""))) {
    errors.push(securityIssue("JAVASCRIPT_URL_BLOCKED", "Template contains a javascript: URL", "template"));
  }
  return { errors, externalAssets };
}

export function validateTrustedContent(project, options = {}) {
  const allowExternalHttps = options.allowExternalHttps === true || project?.manifest?.assets?.allowExternalHttps === true;
  const template = scanTemplateSecurity(project?.templateHtml || "", { allowExternalHttps });
  const css = scanCss(project?.themeCss || "", { allowExternalHttps }, "themeCss");
  const errors = [...template.errors, ...css];
  if ((project?.customScripts || []).length) errors.push(securityIssue("CUSTOM_SCRIPT_BLOCKED", "Custom executable scripts are not allowed in a trusted export", "customScripts"));
  return {
    valid: errors.length === 0,
    errors,
    externalNetwork: template.externalAssets.length > 0 || /url\(\s*["']?(?:https?:|\/\/)/i.test(project?.themeCss || ""),
    arbitraryJavascript: false,
  };
}

export function assertTrustedContent(project, options = {}) {
  const report = validateTrustedContent(project, options);
  if (!report.valid) {
    const error = new Error(report.errors.map((entry) => entry.message).join("; "));
    error.code = "TRUSTED_CONTENT_REJECTED";
    error.details = report.errors;
    throw error;
  }
  return report;
}
