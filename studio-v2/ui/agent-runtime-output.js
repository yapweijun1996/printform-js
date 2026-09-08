function clone(value) { return structuredClone(value); }

export function outputText(result) {
  return result?.output?.text || result?.output?.message || result?.output?.body?.text || result?.output?.body?.message || "";
}

export function approvalFrom(result) {
  const output = result?.output || {};
  const pending = output.resumeToken ? output : result?.runState?.pendingApproval;
  if (!pending?.resumeToken) return null;
  return { resumeToken: clone(pending.resumeToken), actionName: pending.actionName || pending.resumeToken.actionName || "printform_apply_approved_proposal", text: pending.text || "Approval is required before applying this proposal." };
}
