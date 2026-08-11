const MAX_PAGES = 100;
const MAX_CHILDREN = 320;
const MAX_COORDINATE = 12_000;

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.min(MAX_COORDINATE, value)) : fallback;
}

function integer(value, fallback = 0) {
  return Math.round(finite(value, fallback));
}

function safePages(pageGeometry) {
  if (!Array.isArray(pageGeometry)) return [];
  return pageGeometry.slice(0, MAX_PAGES).map((page, pageIndex) => ({
    pageIndex,
    width: integer(page?.width, 1),
    height: integer(page?.height, 1),
    children: Array.isArray(page?.children) ? page.children.slice(0, MAX_CHILDREN).map((child) => ({
      x: integer(child?.x), y: integer(child?.y), width: integer(child?.width), height: integer(child?.height)
    })) : []
  }));
}

function safeIssues(issues) {
  if (!Array.isArray(issues)) return [];
  return issues.slice(0, MAX_CHILDREN).map((issue) => ({
    pageIndex: Number.isInteger(issue?.pageIndex) ? issue.pageIndex : -1,
    rect: issue?.rect && {
      x: integer(issue.rect.x), y: integer(issue.rect.y), width: integer(issue.rect.width), height: integer(issue.rect.height)
    }
  })).filter((issue) => issue.pageIndex >= 0 && issue.rect);
}

function rect({ x = 0, y = 0, width = 0, height = 0, fill, stroke, strokeWidth = 0, opacity = 1 }) {
  if (width <= 0 || height <= 0) return "";
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${strokeWidth}"` : ""} opacity="${opacity}"/>`;
}

function encodeSvg(svg) {
  if (typeof btoa === "function") return btoa(svg);
  if (globalThis.Buffer) return globalThis.Buffer.from(svg, "utf8").toString("base64");
  throw new Error("A base64 encoder is required for the safe layout snapshot");
}

/**
 * Build a geometry-only visual input. It deliberately contains no text nodes,
 * class names, source URLs or rendered values. The provider sees page and
 * block proportions plus red issue outlines, never the real document pixels.
 */
export function createRedactedLayoutSnapshot(report = {}) {
  const pages = safePages(report.pageGeometry);
  if (!pages.length) return null;
  const issues = safeIssues(report.issues);
  const gap = 28;
  const width = Math.max(1, ...pages.map((page) => page.width));
  const height = pages.reduce((total, page) => total + page.height, 0) + gap * (pages.length - 1);
  let offset = 0;
  const drawings = [];
  pages.forEach((page, pageIndex) => {
    drawings.push(rect({ x: 0, y: offset, width: page.width, height: page.height, fill: "#ffffff", stroke: "#9aa9c2", strokeWidth: 2 }));
    page.children.forEach((child, index) => drawings.push(rect({
      x: child.x, y: offset + child.y, width: child.width, height: child.height,
      fill: index % 2 ? "#dce7fb" : "#c9d8f3", stroke: "#8ca4d1", strokeWidth: 1, opacity: .92
    })));
    issues.filter((issue) => issue.pageIndex === pageIndex).forEach((issue) => drawings.push(rect({
      x: issue.rect.x, y: offset + issue.rect.y, width: issue.rect.width, height: issue.rect.height,
      fill: "#ef444433", stroke: "#dc2626", strokeWidth: 3, opacity: .95
    })));
    offset += page.height + gap;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#edf2f9"/>${drawings.join("")}</svg>`;
  return {
    source: "geometry-only",
    redacted: true,
    mimeType: "image/svg+xml",
    dataUrl: `data:image/svg+xml;base64,${encodeSvg(svg)}`,
    width,
    height,
    pageCount: pages.length
  };
}

export function decorateRenderReport(report) {
  const snapshot = createRedactedLayoutSnapshot(report);
  return snapshot ? { ...report, safeSnapshot: snapshot } : report;
}
