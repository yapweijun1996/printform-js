import { renderSafeText } from "./agent-panel-view.js";
import { translateAgentError } from "./agent-error-text.js";
import { traceActionLabel } from "./agent-trace.js";

export function createAgentPanelEventObserver({
  state,
  trace,
  reviewView,
  status,
  addMessage,
  renderProposal
}) {
  return function handleRuntimeEvent(event) {
    reviewView.observe(event);
    const record = trace.observe(event);
    if (event.type === "token") {
      if (!state.streamingNode) state.streamingNode = addMessage("assistant", "");
      state.streamingText += event.text || "";
      state.streamingNode.textContent = state.streamingText;
    }
    if (record?.type === "phase" && record.phase === "decide" && record.action) {
      status("aiChat.status.actionSelected", { action: traceActionLabel(record.action), step: record.step || "?" });
    }
    if (record?.type === "phase" && record.phase === "act" && record.action) {
      status("aiChat.status.actionRunning", { action: traceActionLabel(record.action), step: record.step || "?" });
    }
    if (record?.type === "tool_start" && record.action) {
      status("aiChat.status.running", { action: traceActionLabel(record.action) });
    }
    if (event.type === "usage") {
      state.usage = event.usage;
      status("aiChat.status.usage", { usage: state.usage });
    }
    if (event.type === "approval_required") status("aiChat.status.autoApplying");
    if (event.type === "proposal_ready") {
      status(state.applyMode === "preview" ? "aiChat.card.pending" : "aiChat.status.autoApplying");
    }
    if (event.type === "terminal_state") {
      const terminalState = event.detail?.state;
      if (terminalState === "pending_approval") {
        status(state.applyMode === "preview" ? "aiChat.card.pending" : "aiChat.status.approval");
      }
      if (terminalState === "blocked") status("aiChat.status.failed");
    }
    if (event.type === "layout_readiness") {
      const ready = event.detail?.ok && event.detail.result?.ready;
      status(ready ? "aiChat.status.reviewReady" : "aiChat.status.reviewBlocked");
    }
    if (record?.type === "completed") {
      if (record.terminalKind === "done") status("aiChat.status.ready", { usage: state.usage });
      else if (record.terminalKind === "abort") status("aiChat.status.stopped");
      else if (record.terminalKind === "error") status("aiChat.status.failed");
    }
    if (event.type === "runtime_error") {
      addMessage("system", translateAgentError({ code: event.detail?.code, message: event.detail?.message }, "aiChat.errors.providerTurn"));
      renderProposal(null);
      status("aiChat.status.failed");
    }
    if (event.type === "circuit_breaker_tripped") status("aiChat.status.safetyStopped");
    if (event.type === "stopped") {
      renderProposal(null);
      status("aiChat.status.stopped");
    }
    if (event.type === "assistant_text") {
      if (!state.streamingNode) addMessage("assistant", event.text);
      else renderSafeText(state.streamingNode, event.text);
      state.streamingNode = null;
      state.streamingText = "";
      status("aiChat.status.ready", { usage: state.usage });
    }
  };
}
