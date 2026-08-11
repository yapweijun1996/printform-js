export function bindLayoutReviewView({ get, t, status }) {
  const card = get("#ai-review-card");
  const progress = get("#ai-review-progress");
  const findings = get("#ai-review-findings");

  function show(text, items = []) {
    card.hidden = false;
    progress.textContent = text;
    findings.replaceChildren();
    items.slice(0, 8).forEach((item) => {
      const node = document.createElement("li");
      node.dataset.severity = item.severity || "info";
      node.textContent = `${item.code || "LAYOUT"}: ${item.message || ""}`;
      findings.append(node);
    });
  }

  function observe(event) {
    const detail = event?.detail || {};
    if (event.type === "layout_review_started") {
      show(t("aiChat.review.pass", { pass: detail.pass, max: detail.maxPasses }));
      status("aiChat.status.reviewing");
    }
    if (event.type === "layout_evidence_ready") {
      const clean = (detail.scenarios || []).filter((item) => item.receiptIssued).length;
      show(t("aiChat.review.evidence", { pass: detail.pass, clean, total: (detail.scenarios || []).length }));
    }
    if (event.type === "layout_multimodal_started") show(t("aiChat.review.analyzing", { pass: detail.pass, images: detail.imageCount }));
    if (event.type === "layout_repair_proposed") {
      show(t("aiChat.review.repairProposed", { pass: detail.pass, operations: detail.operationCount }), detail.findings || []);
      status("aiChat.status.approval");
    }
    if (event.type === "layout_repair_applied") show(t("aiChat.review.repairApplied", { pass: detail.pass, revision: detail.revision }));
    if (event.type === "layout_review_passed") show(t("aiChat.review.passed", { pass: detail.pass }));
    if (event.type === "layout_review_blocked") {
      show(t("aiChat.review.blocked", { pass: detail.pass }), detail.findings || []);
      status("aiChat.status.reviewBlocked");
    }
    if (event.type === "layout_review_stopped") show(t("aiChat.review.stopped", { pass: detail.pass || "-" }));
  }

  return Object.freeze({ observe, reset: () => { card.hidden = true; findings.replaceChildren(); } });
}
