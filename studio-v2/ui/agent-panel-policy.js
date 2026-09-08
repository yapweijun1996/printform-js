import { classifyImportedDocument, classifyRealDocument } from "../core/data-policy.js";
import { getAgentScopeOptions } from "../core/agent-scope-options.js";

export function createAgentPanelPolicyControls({ state, sessions, runtime, renderSessions, docContext, addMessage, onDataPolicyChange = null, onRealDataChange = null, t }) {
  async function setDataPolicy(policy) {
    const next = policy || classifyImportedDocument();
    if (onDataPolicyChange) return onDataPolicyChange(next);
    runtime.invalidateSession();
    state.dataPolicy = next;
    state.realData = state.dataPolicy.classification === "real";
    sessions.setDataPolicy(state.dataPolicy);
    state.sessionPersistenceAnnounced = false;
    addMessage("system", t(`aiChat.mode.${next.classification === "synthetic" ? "syntheticData" : next.classification === "real" ? "realData" : "unknownData"}`));
    await runtime.refreshSessions();
  }

  async function setRealData(value) {
    if (onRealDataChange) return onRealDataChange(Boolean(value));
    const next = value
      ? classifyRealDocument(state.dataPolicy?.documentId)
      : classifyImportedDocument(state.dataPolicy?.documentId);
    return setDataPolicy(next);
  }

  function onProjectChanged(nextProject = null, nextPolicy = null) {
    runtime.invalidateSession();
    state.records = [];
    if (nextPolicy) {
      state.dataPolicy = nextPolicy;
      state.realData = nextPolicy.classification === "real";
      sessions.setDataPolicy(nextPolicy);
      state.sessionPersistenceAnnounced = false;
    }
    renderSessions();
    runtime.refreshSessions().catch((error) => {
      if (error.code !== "STALE_POLICY_CONTEXT") addMessage("system", t("aiChat.status.sessionPersistenceUnavailable"));
    });
    if (nextProject) {
      docContext.update({
        documentTitle: nextProject.manifest?.title || "PrintForm Document",
        documentId: nextProject.manifest?.documentId || "",
        revision: nextProject.revision || 0,
        scopeOptions: getAgentScopeOptions(nextProject)
      });
    }
  }

  return { setDataPolicy, setRealData, onProjectChanged };
}
