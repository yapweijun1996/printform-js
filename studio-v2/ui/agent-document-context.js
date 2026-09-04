export function createDocumentContextView({ get, t, onScopeChange = () => {} }) {
  const state = {
    documentTitle: "PrintForm Document",
    documentId: "",
    revision: 0,
    renderStatus: "printable",
    errorCount: 0,
    warningCount: 0,
    stateMode: "committed",
    candidateRevision: null,
    selection: "Entire document",
    scope: "all"
  };

  function render() {
    const docEl = get("#ai-context-doc-name");
    const revEl = get("#ai-context-revision");
    const stateEl = get("#ai-context-state");
    const statusEl = get("#ai-context-status");
    const selEl = get("#ai-context-selection-val");
    const scopeSelect = get("#ai-context-scope-select");

    if (docEl) docEl.textContent = state.documentTitle;
    if (revEl) revEl.textContent = `r${state.revision}`;

    if (stateEl) {
      const isCandidate = state.stateMode === "candidate";
      stateEl.className = `ai-context-badge ${isCandidate ? "ai-badge-candidate" : "ai-badge-committed"}`;
      stateEl.textContent = isCandidate
        ? t("aiChat.context.candidate", { revision: state.candidateRevision ?? state.revision + 1 })
        : t("aiChat.context.committed");
    }

    if (statusEl) {
      if (state.errorCount > 0) {
        statusEl.className = "ai-context-badge ai-badge-status ai-badge-blocked";
        statusEl.textContent = t("aiChat.context.blocked");
      } else if (state.warningCount > 0) {
        statusEl.className = "ai-context-badge ai-badge-status ai-badge-warning";
        statusEl.textContent = t("aiChat.context.issues", { count: state.warningCount });
      } else {
        statusEl.className = "ai-context-badge ai-badge-status ai-badge-printable";
        statusEl.textContent = t("aiChat.context.printable");
      }
    }

    if (selEl) {
      selEl.textContent = state.selection === "Entire document"
        ? t("aiChat.context.entireDocument")
        : state.selection;
    }

    if (scopeSelect && scopeSelect.value !== state.scope) {
      scopeSelect.value = state.scope;
    }
  }

  function bind() {
    const scopeSelect = get("#ai-context-scope-select");
    if (scopeSelect) {
      scopeSelect.addEventListener("change", (event) => {
        state.scope = event.target.value;
        onScopeChange(state.scope);
      });
    }
  }

  function update(nextState = {}) {
    if (nextState.documentTitle !== undefined) state.documentTitle = nextState.documentTitle;
    if (nextState.documentId !== undefined) state.documentId = nextState.documentId;
    if (nextState.revision !== undefined) state.revision = nextState.revision;
    if (nextState.renderStatus !== undefined) state.renderStatus = nextState.renderStatus;
    if (nextState.errorCount !== undefined) state.errorCount = nextState.errorCount;
    if (nextState.warningCount !== undefined) state.warningCount = nextState.warningCount;
    if (nextState.stateMode !== undefined) state.stateMode = nextState.stateMode;
    if (nextState.candidateRevision !== undefined) state.candidateRevision = nextState.candidateRevision;
    if (nextState.selection !== undefined) state.selection = nextState.selection;
    if (nextState.scope !== undefined) state.scope = nextState.scope;
    render();
  }

  function getState() {
    return { ...state };
  }

  bind();
  render();

  return { update, getState, render };
}
