export function renderSafeText(container, text) {
  container.replaceChildren();
  const parts = String(text || "").split(/```([\w-]*)\n?([\s\S]*?)```/g);
  for (let index = 0; index < parts.length; index += 1) {
    if (index % 3 === 0) {
      if (parts[index]) container.append(document.createTextNode(parts[index]));
      continue;
    }
    if (index % 3 === 2) {
      const code = document.createElement("pre");
      code.textContent = parts[index];
      container.append(code);
    }
  }
}

export function panelMarkup() {
  return `<div class="ai-panel">
    <header class="ai-chat-header">
      <div class="ai-identity">
        <span class="ai-avatar" aria-hidden="true">✦</span>
        <span><span class="ai-kicker" data-ui-i18n="aiChat.kicker">AI CHATBOX</span><strong data-ui-i18n="aiChat.identity">PrintForm Designer</strong><small data-ui-i18n="aiChat.publicWorkspace">Public gateway · server security</small></span>
      </div>
      <div class="ai-header-actions">
        <button id="ai-new-session" class="secondary ai-compact-button" type="button" data-ui-i18n="aiChat.new" data-ui-i18n-aria-label="aiChat.newAria" aria-label="Start a new AI chat">+ New</button>
        <button id="ai-review-layout" class="secondary ai-compact-button" type="button" data-ui-i18n="aiChat.review.button" data-ui-i18n-aria-label="aiChat.review.buttonAria" aria-label="Review layout">Review</button>
        <button id="ai-settings-button" class="secondary ai-compact-button" type="button" data-ui-i18n="aiChat.settings" aria-controls="ai-provider-details" aria-expanded="false" aria-haspopup="dialog">Settings</button>
      </div>
    </header>
    <div class="ai-session-bar">
      <label class="visually-hidden" for="ai-session-select" data-ui-i18n="aiChat.session.label">AI chat session</label>
      <select id="ai-session-select" data-ui-i18n-aria-label="aiChat.session.label" aria-label="AI chat session"></select>
      <button id="ai-delete-session" class="secondary ai-delete-button" type="button" data-ui-i18n="aiChat.delete" data-ui-i18n-aria-label="aiChat.deleteAria" data-ui-i18n-title="aiChat.deleteTitle" aria-label="Delete current AI chat" title="Delete current chat">Delete</button>
    </div>
    <div class="ai-conversation">
      <div id="ai-chat-log" class="ai-chat-log" role="log" aria-live="polite" aria-relevant="additions text">
        <section class="ai-chat-welcome" aria-labelledby="ai-welcome-title">
          <span class="ai-welcome-mark" aria-hidden="true">✦</span>
          <h2 id="ai-welcome-title" data-ui-i18n="aiChat.welcome.title">Design your print form</h2>
          <p data-ui-i18n="aiChat.welcome.description">Ask for visual or structural changes. Safe changes are validated and applied automatically; use Undo or Redo when needed.</p>
          <button id="ai-open-settings" class="secondary" type="button" data-ui-i18n="aiChat.gatewaySettings">Gateway settings</button>
          <div class="ai-prompt-suggestions" data-ui-i18n-aria-label="aiChat.suggestionsAria" aria-label="Example AI design requests">
            <button class="secondary" type="button" data-ui-i18n="aiChat.suggestion.modern" data-ai-prompt-key="aiChat.prompt.modern">Modernise this invoice</button>
            <button class="secondary" type="button" data-ui-i18n="aiChat.suggestion.widen" data-ai-prompt-key="aiChat.prompt.widen">Widen Description</button>
            <button class="secondary" type="button" data-ui-i18n="aiChat.suggestion.redPurchaseOrder" data-ai-prompt-key="aiChat.prompt.redPurchaseOrder">Red Purchase Order</button>
          </div>
        </section>
      </div>
      <section id="ai-review-card" class="ai-review-card" aria-live="polite" hidden>
        <div class="ai-review-heading"><span aria-hidden="true">◉</span><strong data-ui-i18n="aiChat.review.cardTitle">Multimodal layout review</strong></div>
        <p id="ai-review-progress"></p><ol id="ai-review-findings"></ol>
      </section>
      <div id="ai-proposal-card" class="ai-proposal hidden" aria-live="polite">
        <div class="ai-proposal-heading"><span aria-hidden="true">✓</span><div><h3 data-ui-i18n="aiChat.proposal.title">Design proposal ready</h3><p data-ui-i18n="aiChat.proposal.description">Review the candidate preview before applying.</p></div></div>
        <details class="ai-proposal-details"><summary data-ui-i18n="aiChat.proposal.details">Technical diff &amp; validation</summary><pre id="ai-proposal-diff"></pre><pre id="ai-proposal-validation"></pre></details>
        <p class="ai-auto-apply-note" data-ui-i18n="aiChat.proposal.autoApply">The validated candidate is applied automatically.</p>
      </div>
    </div>
    <footer class="ai-chat-footer">
      <div id="ai-status" class="ai-status" role="status" aria-live="polite" data-ui-i18n="aiChat.status.publicGateway">Public gateway ready · server security applies.</div>
      <div class="ai-history-controls" data-ui-i18n-aria-label="aiChat.history.aria" aria-label="Draft history">
        <span data-ui-i18n="aiChat.history.label">Draft history</span>
        <button id="ai-undo-revision" class="secondary" type="button" data-ui-i18n="aiChat.undo">Undo</button>
        <button id="ai-redo-revision" class="secondary" type="button" data-ui-i18n="aiChat.redo">Redo</button>
      </div>
      <details id="ai-trace-panel" class="ai-trace-panel">
        <summary><span data-ui-i18n="aiChat.trace.title">Runtime trace</span><span id="ai-trace-count" class="ai-trace-count">0</span></summary>
        <div class="ai-trace-body">
          <div class="ai-trace-toolbar"><span class="ai-trace-note" data-ui-i18n="aiChat.trace.note">Safe action audit · hidden reasoning excluded · memory only</span><button id="ai-trace-copy" class="secondary" type="button" data-ui-i18n="aiChat.trace.copy">Copy</button><button id="ai-trace-clear" class="secondary" type="button" data-ui-i18n="aiChat.trace.clear">Clear</button></div>
          <ol id="ai-trace-log" class="ai-trace-log" aria-label="Sanitized AI runtime trace" data-ui-i18n-aria-label="aiChat.trace.aria"></ol>
        </div>
      </details>
      <div class="ai-composer">
        <textarea id="ai-prompt" rows="2" data-ui-i18n-aria-label="aiChat.composer.label" data-ui-i18n-placeholder="aiChat.composer.placeholder" aria-label="AI design request" placeholder="Ask AI to redesign this print form…"></textarea>
        <div class="ai-composer-actions"><button id="ai-stop" class="secondary" type="button" data-ui-i18n="aiChat.stop" disabled>Stop</button><button id="ai-send" type="button"><span data-ui-i18n="aiChat.send">Send</span> <span aria-hidden="true">↑</span></button></div>
      </div>
      <p class="ai-composer-hint" data-ui-i18n="aiChat.composer.hint">Ctrl/⌘ + Enter to send · safe design changes apply automatically</p>
    </footer>
  </div>`;
}
