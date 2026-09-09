export function createDocumentContextView({ get, t, onScopeChange = () => {}, scopeOptions = null }) {
  const state = {
    documentTitle: "PrintForm Document",
    documentId: "",
    revision: 0,
    renderStatus: "waiting",
    readiness: null,
    errorCount: 0,
    warningCount: 0,
    stateMode: "committed",
    candidateRevision: null,
    selection: "Entire document",
    selectionDetails: null,
    scope: "all",
    scopeOptions: scopeOptions || [
      { value: "all", label: "All sections", selection: "Entire document", scope: { kind: "document" } },
      { value: "layout", label: "Layout & typography", selection: "Layout & typography", scope: { kind: "layout" } },
      { value: "table", label: "Table default", selection: "Table default", scope: { kind: "table", tableId: "default" } },
      { value: "theme", label: "Theme & brand", selection: "Theme & brand", scope: { kind: "theme" } },
    ]
  };

  function render() {
    const docEl = get("#ai-context-doc-name");
    const revEl = get("#ai-context-revision");
    const stateEl = get("#ai-context-state");
    const statusEl = get("#ai-context-status");
    const selEl = get("#ai-context-selection-val");
    const selectionMetaEl = get("#ai-context-selection-meta");
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
      const readinessErrors = Array.isArray(state.readiness?.errors) ? state.readiness.errors.length : 0;
      const productionReady = state.readiness?.productionValid === true;
      if (state.errorCount > 0 || readinessErrors > 0 || ["failed", "blocked"].includes(state.renderStatus)) {
        statusEl.className = "ai-context-badge ai-badge-status ai-badge-blocked";
        statusEl.textContent = t("aiChat.context.blocked");
      } else if (["waiting", "rendering", "candidate"].includes(state.renderStatus)) {
        statusEl.className = "ai-context-badge ai-badge-status ai-badge-warning";
        statusEl.textContent = t(state.renderStatus === "rendering" ? "status.rendering" : "status.waiting");
      } else if (!productionReady) {
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

    if (selectionMetaEl) {
      const details = state.selectionDetails;
      selectionMetaEl.textContent = details
        ? [details.type, details.role, details.tableId && `table=${details.tableId}`, details.componentId]
          .filter(Boolean).join(" · ")
        : state.scope === "all" ? "Whole document" : "Scope selected";
      selectionMetaEl.dataset.componentId = details?.componentId || "";
      selectionMetaEl.dataset.tableId = details?.tableId || "";
      selectionMetaEl.dataset.source = details?.source || "scope-control";
    }

    if (scopeSelect) {
      const current = state.scope;
      scopeSelect.replaceChildren(...state.scopeOptions.map((option) => new Option(option.label, option.value)));
      scopeSelect.value = current;
      if (scopeSelect.value !== current) scopeSelect.value = "all";
    }
  }

  function bind() {
    const scopeSelect = get("#ai-context-scope-select");
    if (scopeSelect) {
      scopeSelect.addEventListener("change", (event) => {
        const option = state.scopeOptions.find((item) => item.value === event.target.value) || state.scopeOptions[0];
        state.scope = option.value;
        state.selection = option.selection;
        state.selectionDetails = null;
        onScopeChange({ ...option.scope });
        render();
      });
    }
  }

  function update(nextState = {}) {
    if (nextState.documentTitle !== undefined) state.documentTitle = nextState.documentTitle;
    if (nextState.documentId !== undefined) state.documentId = nextState.documentId;
    if (nextState.revision !== undefined) state.revision = nextState.revision;
    if (nextState.renderStatus !== undefined) state.renderStatus = nextState.renderStatus;
    if (nextState.readiness !== undefined) state.readiness = nextState.readiness;
    if (nextState.errorCount !== undefined) state.errorCount = nextState.errorCount;
    if (nextState.warningCount !== undefined) state.warningCount = nextState.warningCount;
    if (nextState.stateMode !== undefined) state.stateMode = nextState.stateMode;
    if (nextState.candidateRevision !== undefined) state.candidateRevision = nextState.candidateRevision;
    if (nextState.selection !== undefined) {
      state.selection = nextState.selection;
      if (nextState.selection === "Entire document") state.selectionDetails = null;
    }
    if (nextState.selectionDetails !== undefined) state.selectionDetails = nextState.selectionDetails ? { ...nextState.selectionDetails } : null;
    if (nextState.scope !== undefined) state.scope = nextState.scope;
    if (nextState.scopeOptions !== undefined) {
      state.scopeOptions = nextState.scopeOptions;
      if (!state.scopeOptions.some((option) => option.value === state.scope)) {
        state.scope = "all";
        state.selection = "Entire document";
        onScopeChange({ kind: "document" });
      }
    }
    render();
  }

  function getState() {
    return { ...state };
  }

  bind();
  render();

  return { update, getState, render };
}
