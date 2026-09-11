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

// The panel's primary actions live in the shared `.inspector-header` alongside
// the view switcher, not inside the tabpanel. initAgentPanel injects `actions`
// into [data-slot="actions"]; every control keeps its id so the existing
// querySelector wiring is unaffected.
const HEADER_ACTION_ICONS = Object.freeze({
  newSession: '<svg class="ai-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"></path></svg>',
  review: '<svg class="ai-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 11a8 8 0 1 0 .1 2.5"></path><path d="m20 5 0 6-6 0"></path></svg>',
  sessions: '<svg class="ai-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M5 7h14M5 12h14M5 17h14"></path></svg>',
  settings: '<svg class="ai-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>'
});

export function headerClusterMarkup() {
  return {
    actions: `<button id="ai-new-session" class="secondary ai-compact-button ai-icon-first" type="button" data-ui-i18n-aria-label="aiChat.newAria" data-ui-i18n-title="aiChat.newAria" aria-label="Start a new AI chat">${HEADER_ACTION_ICONS.newSession}<span class="ai-btn-label" data-ui-i18n="aiChat.new">New</span></button>
      <button id="ai-review-layout" class="secondary ai-compact-button ai-icon-first" type="button" data-ui-i18n-aria-label="aiChat.review.buttonAria" data-ui-i18n-title="aiChat.review.buttonAria" aria-label="Review layout">${HEADER_ACTION_ICONS.review}<span class="ai-btn-label" data-ui-i18n="aiChat.review.button">Review</span></button>
      <button id="ai-sessions-toggle" class="secondary ai-compact-button ai-icon-first" type="button" data-ui-i18n-aria-label="aiChat.nav.sessions" data-ui-i18n-title="aiChat.nav.sessionsTitle" aria-expanded="false" aria-controls="ai-sessions-drawer" aria-label="Sessions" title="Toggle sessions drawer">${HEADER_ACTION_ICONS.sessions}<span class="ai-btn-label" data-ui-i18n="aiChat.nav.sessions">Sessions</span></button>
      <button id="ai-settings-button" class="secondary ai-compact-button ai-icon-first" type="button" data-ui-i18n-aria-label="aiChat.settings" data-ui-i18n-title="aiChat.settings" aria-controls="ai-provider-details" aria-expanded="false" aria-haspopup="dialog" aria-label="Settings">${HEADER_ACTION_ICONS.settings}<span class="ai-btn-label" data-ui-i18n="aiChat.settings">Settings</span></button>`
  };
}

export function panelMarkup() {
  return `<div class="ai-panel">
    <!-- Gateway status is retained as a hidden live region for assistive technology. -->
    <p id="ai-status" class="ai-status visually-hidden" role="status" aria-live="polite" data-ui-i18n="aiChat.status.demoGateway">Demo Gateway ready · a short-lived origin-bound session is acquired on demand.</p>

    <div id="ai-sessions-drawer" class="ai-sessions-drawer hidden">
      <div class="ai-session-bar">
        <label class="visually-hidden" for="ai-session-select" data-ui-i18n="aiChat.session.label">AI chat session</label>
        <select id="ai-session-select" data-ui-i18n-aria-label="aiChat.session.label" aria-label="AI chat session"></select>
        <button id="ai-delete-session" class="secondary ai-delete-button" type="button" data-ui-i18n="aiChat.delete" data-ui-i18n-aria-label="aiChat.deleteAria" data-ui-i18n-title="aiChat.deleteTitle" aria-label="Delete current AI chat" title="Delete current chat">Delete</button>
      </div>
    </div>

    <!-- Layer 2: Current document context -->
    <section id="ai-document-context" class="ai-document-context" aria-label="Current document context">
      <div class="ai-context-row ai-context-primary">
        <div class="ai-context-item ai-context-doc">
          <span class="ai-context-icon" aria-hidden="true">📄</span>
          <span id="ai-context-doc-name" class="ai-context-value ai-context-doc-name">Sales Invoice</span>
        </div>
        <div class="ai-context-badges">
          <span id="ai-context-revision" class="ai-context-badge ai-badge-revision">r0</span>
          <div class="ai-revision-history" role="group" data-ui-i18n-aria-label="aiChat.history.aria" aria-label="Draft history controls">
            <button id="ai-undo-revision" class="ai-icon-btn" type="button" data-ui-i18n-title="aiChat.undo" data-ui-i18n-aria-label="aiChat.undo" title="Undo" aria-label="Undo" disabled>↶</button>
            <button id="ai-redo-revision" class="ai-icon-btn" type="button" data-ui-i18n-title="aiChat.redo" data-ui-i18n-aria-label="aiChat.redo" title="Redo" aria-label="Redo" disabled>↷</button>
          </div>
          <span id="ai-context-state" class="ai-context-badge ai-badge-committed" data-ui-i18n="aiChat.context.committed">Committed</span>
          <span id="ai-context-status" class="ai-context-badge ai-badge-status ai-badge-printable" data-ui-i18n="aiChat.context.printable">Printable</span>
        </div>
      </div>
      <div class="ai-context-row ai-context-apply">
        <span class="ai-context-label" data-ui-i18n="aiChat.applyMode.label">Apply mode:</span>
        <div class="ai-apply-mode-toggle" role="radiogroup" aria-label="Apply mode">
          <button id="ai-mode-auto" type="button" class="ai-mode-btn is-active" role="radio" aria-checked="true" data-ui-i18n="aiChat.applyMode.auto">Auto-apply safe changes</button>
          <button id="ai-mode-preview" type="button" class="ai-mode-btn" role="radio" aria-checked="false" data-ui-i18n="aiChat.applyMode.preview">Preview before applying</button>
        </div>
      </div>
      <div class="ai-context-row ai-context-secondary">
        <div class="ai-context-item ai-context-selection">
          <span class="ai-context-label" data-ui-i18n="aiChat.context.selection">Selection:</span>
          <span id="ai-context-selection-val" class="ai-context-value" data-ui-i18n="aiChat.context.entireDocument">Entire document</span>
        </div>
        <div class="ai-context-item ai-context-selection-meta" aria-live="polite">
          <span class="ai-context-label" data-ui-i18n="aiChat.card.target">Target:</span>
          <span id="ai-context-selection-meta" class="ai-context-value">Whole document</span>
        </div>
        <div class="ai-context-item ai-context-scope">
          <label class="ai-context-label" for="ai-context-scope-select" data-ui-i18n="aiChat.context.scope">Scope:</label>
          <select id="ai-context-scope-select" class="ai-context-scope-select" aria-label="Design scope">
            <option value="all" data-ui-i18n="aiChat.context.allSections">All sections</option>
            <option value="layout">Layout &amp; typography</option>
            <option value="table">Table columns</option>
            <option value="theme">Theme &amp; brand</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Layer 3: Conversation -->
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

      <!-- Proposal & Change card presentation container -->
      <div id="ai-proposal-card" class="ai-proposal hidden" aria-live="polite">
        <div class="ai-proposal-heading"><span aria-hidden="true">✓</span><div><h3 data-ui-i18n="aiChat.proposal.title">Design proposal ready</h3><p data-ui-i18n="aiChat.proposal.description">Review the candidate preview before applying.</p></div></div>
        <details class="ai-proposal-details"><summary data-ui-i18n="aiChat.proposal.details">Technical diff &amp; validation</summary><pre id="ai-proposal-diff"></pre><pre id="ai-proposal-validation"></pre></details>
        <p class="ai-auto-apply-note" data-ui-i18n="aiChat.proposal.autoApply">The validated candidate is applied automatically.</p>
      </div>

      <details id="ai-trace-panel" class="ai-trace-panel ai-drawer-details">
        <summary><span data-ui-i18n="aiChat.trace.title">Runtime trace</span><span id="ai-trace-count" class="ai-trace-count">0</span></summary>
        <div class="ai-trace-body">
          <div class="ai-trace-toolbar">
            <span class="ai-trace-note" data-ui-i18n="aiChat.trace.note">Safe action audit · hidden reasoning excluded · memory only</span>
            <button id="ai-trace-copy" class="secondary" type="button" data-ui-i18n="aiChat.trace.copy">Copy</button>
            <button id="ai-trace-clear" class="secondary" type="button" data-ui-i18n="aiChat.trace.clear">Clear</button>
          </div>
          <ol id="ai-trace-log" class="ai-trace-log" aria-label="Sanitized AI runtime trace" data-ui-i18n-aria-label="aiChat.trace.aria"></ol>
        </div>
      </details>
    </div>

    <!-- Layer 4: Composer -->
    <footer class="ai-chat-footer">
      <div class="ai-composer">
        <textarea id="ai-prompt" rows="2" data-ui-i18n-aria-label="aiChat.composer.label" data-ui-i18n-placeholder="aiChat.composer.placeholder" data-ui-i18n-title="aiChat.composer.hint" aria-label="AI design request" placeholder="Ask AI to redesign this print form…" title="Ctrl/⌘ + Enter to send"></textarea>
        <div class="ai-composer-actions">
          <button id="ai-stop" class="secondary" type="button" data-ui-i18n="aiChat.stop" disabled>Stop</button>
          <button id="ai-send" type="button"><span data-ui-i18n="aiChat.send">Send</span> <span aria-hidden="true">↑</span></button>
        </div>
      </div>
    </footer>
  </div>`;
}
