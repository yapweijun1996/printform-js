export function mergeRenderReport(base, report) {
  if (!report) return base;
  const unique = (items) => Array.from(new Map(items.map((item) => [`${item.code}:${item.path || "/"}:${item.message}`, item])).values());
  return {
    ...base,
    valid: base.valid && report.status === "ready",
    productionValid: base.productionValid && report.status === "ready",
    errors: unique([...base.errors, ...(report.validation?.errors || [])]),
    warnings: unique([...base.warnings, ...(report.validation?.warnings || [])]),
    metrics: { ...base.metrics, ...(report.metrics || {}) },
    issues: report.issues || []
  };
}
