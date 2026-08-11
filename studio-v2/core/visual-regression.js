const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_MULTIMODAL_IMAGE_CHARS = 8_000_000;

export function compareVisualSnapshots(baseline, current) {
  const baselineHash = typeof baseline?.hash === "string" && HASH_PATTERN.test(baseline.hash) ? baseline.hash : null;
  const currentHash = typeof current?.hash === "string" && HASH_PATTERN.test(current.hash) ? current.hash : null;
  if (!currentHash) return { available: false, changed: false, baselineHash, currentHash: null };
  if (!baselineHash) return { available: true, changed: false, baselineHash: null, currentHash, baselineEstablished: true };
  return { available: true, changed: baselineHash !== currentHash, baselineHash, currentHash, baselineEstablished: true };
}

export function visualSnapshotIdentity(evidence = {}) {
  if (evidence.visualMode !== "pixels" || typeof evidence.pixelSnapshotHash !== "string") return null;
  return { hash: evidence.pixelSnapshotHash, revision: Number.isInteger(evidence.revision) ? evidence.revision : null };
}

export function prepareVisualReviewEvidence(captures, baselines) {
  const evidence = captures.map((capture) => ({
    ...(capture.evidence || capture.observation),
    receiptIssued: Boolean(capture.evidence?.evidenceId)
  })).map((item) => {
    const identity = visualSnapshotIdentity(item);
    const baseline = baselines.get(item.scenario);
    const visualRegression = identity ? compareVisualSnapshots(baseline, identity) : { available: false, changed: false };
    if (identity && !baseline) baselines.set(item.scenario, identity);
    return { ...item, visualRegression };
  });
  let imageChars = 0;
  const imageModes = new Map();
  const parts = evidence.flatMap((item) => {
    const candidates = [item.pixelSnapshot, item.snapshot].filter((snapshot) => snapshot?.dataUrl);
    const snapshot = candidates.find((candidate) => imageChars + candidate.dataUrl.length <= MAX_MULTIMODAL_IMAGE_CHARS);
    if (!snapshot) return [];
    imageChars += snapshot.dataUrl.length;
    const mode = snapshot.source === "sandbox-pixel" ? "pixels" : "geometry";
    imageModes.set(item.scenario, mode);
    return [{ type: "image", url: snapshot.dataUrl, mimeType: snapshot.mimeType, filename: `layout-${item.scenario}.${mode === "pixels" ? "png" : "svg"}` }];
  });
  const context = evidence.map(({ evidenceId, receiptIssued, scenario, revision, snapshotHash, pixelSnapshotHash, visualMode, layoutFingerprint, coverage, metrics, visualRegression, issues, validation }) => ({
    evidenceId, receiptIssued, scenario, revision, snapshotHash, pixelSnapshotHash,
    visualMode, imageMode: imageModes.get(scenario) || "unavailable", layoutFingerprint, coverage,
    metrics, visualRegression,
    issueCodes: Array.isArray(issues) ? issues.map((item) => item.code).filter(Boolean) : [],
    validation: validation && {
      valid: validation.valid,
      productionValid: validation.productionValid,
      errorCodes: Array.isArray(validation.errors) ? validation.errors.map((item) => item.code).filter(Boolean) : [],
      warningCodes: Array.isArray(validation.warnings) ? validation.warnings.map((item) => item.code).filter(Boolean) : []
    }
  }));
  return { evidence, parts, context };
}
