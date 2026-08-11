export function settingsModalMarkup() {
  return `<div id="ai-provider-details" class="ai-settings-modal" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title" hidden>
    <section class="ai-settings-dialog">
      <header class="ai-settings-topbar">
        <div class="ai-settings-heading">
          <span class="ai-settings-icon" aria-hidden="true">✦</span>
          <span>
            <span class="ai-kicker" data-ui-i18n="aiSettings.kicker">AI DESIGNER</span>
            <h2 id="ai-settings-title" data-ui-i18n="aiSettings.title">Provider settings</h2>
            <p data-ui-i18n="aiSettings.subtitle">Connect your own model without exposing its credential to PrintForm exports.</p>
          </span>
        </div>
        <div class="ai-settings-top-actions">
          <span id="ai-settings-badge" class="ai-setup-state" data-ui-i18n="aiSettings.publicGateway">Public gateway</span>
          <button id="ai-settings-close" class="secondary ai-settings-close" type="button" data-ui-i18n-aria-label="aiSettings.close" aria-label="Close provider settings">×</button>
        </div>
      </header>

      <div class="ai-settings-layout">
        <nav class="ai-settings-sidebar" role="tablist" data-ui-i18n-aria-label="aiSettings.navLabel" aria-label="Provider setting sections" aria-orientation="vertical">
          <button id="ai-settings-tab-provider" class="ai-settings-nav-item" type="button" role="tab" aria-selected="true" aria-controls="ai-settings-panel-provider" data-ai-settings-section="provider">
            <span aria-hidden="true">◫</span><span><strong data-ui-i18n="aiSettings.navProvider">Provider</strong><small data-ui-i18n="aiSettings.navProviderHint">Profile and model</small></span>
          </button>
          <button id="ai-settings-tab-vault" class="ai-settings-nav-item" type="button" role="tab" aria-selected="false" aria-controls="ai-settings-panel-vault" data-ai-settings-section="vault" tabindex="-1">
            <span aria-hidden="true">◇</span><span><strong data-ui-i18n="aiSettings.navVault">Vault &amp; security</strong><small data-ui-i18n="aiSettings.navVaultHint">Key and passphrase</small></span>
          </button>
          <button id="ai-settings-tab-usage" class="ai-settings-nav-item" type="button" role="tab" aria-selected="false" aria-controls="ai-settings-panel-usage" data-ai-settings-section="usage" tabindex="-1">
            <span aria-hidden="true">⌁</span><span><strong data-ui-i18n="aiSettings.navUsage">Usage limits</strong><small data-ui-i18n="aiSettings.navUsageHint">Steps and cost</small></span>
          </button>
          <button id="ai-settings-tab-privacy" class="ai-settings-nav-item" type="button" role="tab" aria-selected="false" aria-controls="ai-settings-panel-privacy" data-ai-settings-section="privacy" tabindex="-1">
            <span aria-hidden="true">◎</span><span><strong data-ui-i18n="aiSettings.navPrivacy">Privacy</strong><small data-ui-i18n="aiSettings.navPrivacyHint">Data boundaries</small></span>
          </button>
        </nav>

        <div class="ai-settings-content">
          <section id="ai-settings-panel-provider" class="ai-settings-section" role="tabpanel" aria-labelledby="ai-settings-tab-provider" data-ai-settings-panel="provider">
            <div class="ai-settings-section-heading"><span><span class="ai-section-kicker" data-ui-i18n="aiSettings.providerKicker">MODEL CONNECTION</span><h3 data-ui-i18n="aiSettings.providerHeading">Provider profile</h3></span><p data-ui-i18n="aiSettings.providerDescription">Choose the provider, model, and API protocol used by this chat.</p></div>
            <div class="ai-settings-card">
              <label class="ai-wide-field" for="ai-profile-select"><span data-ui-i18n="aiSettings.activeProfile">Active profile</span><select id="ai-profile-select"></select></label>
              <div class="ai-profile-grid">
                <label><span data-ui-i18n="aiSettings.profileId">Profile id</span><input id="ai-profile-id" autocomplete="off" value="own-gpt-server"></label>
                <label><span data-ui-i18n="aiSettings.providerLabel">Provider</span><select id="ai-provider"><option value="openai" data-ui-i18n="aiSettings.providerOpenai">OpenAI</option><option value="gemini" data-ui-i18n="aiSettings.providerGemini">Gemini</option><option value="custom" data-ui-i18n="aiSettings.providerCustom">Custom LLM</option></select></label>
                <label><span data-ui-i18n="aiSettings.model">Model</span><input id="ai-model" autocomplete="off" value="gpt-5.4-mini" data-ui-i18n-placeholder="aiSettings.modelPlaceholder" placeholder="gpt-5-mini"></label>
                <label><span data-ui-i18n="aiSettings.apiVariant">API variant</span><select id="ai-api-variant"><option value="chat" data-ui-i18n="aiSettings.variantChat">Chat Completions</option><option value="responses" selected data-ui-i18n="aiSettings.variantResponses">OpenAI Responses</option></select></label>
                <label class="ai-wide-field"><span data-ui-i18n="aiSettings.endpoint">Base HTTPS endpoint</span><input id="ai-endpoint" autocomplete="off" value="https://gpt.yapweijun1996.com/v1" data-ui-i18n-placeholder="aiSettings.endpointPlaceholder" placeholder="https://gateway.example/v1"></label>
                <label class="ai-wide-field"><span data-ui-i18n="aiSettings.gatewayToken">Gateway token · current session only</span><input id="ai-public-gateway-key" type="password" autocomplete="off" data-ui-i18n-placeholder="aiSettings.gatewayTokenPlaceholder" placeholder="Paste token for this page only"></label>
                <p class="ai-field-note ai-wide-field" data-ui-i18n="aiSettings.gatewayTokenNote">Used only for this page; never saved to the vault, transcript, or export.</p>
              </div>
            </div>
          </section>

          <section id="ai-settings-panel-vault" class="ai-settings-section" role="tabpanel" aria-labelledby="ai-settings-tab-vault" data-ai-settings-panel="vault" hidden>
            <div class="ai-settings-section-heading"><span><span class="ai-section-kicker" data-ui-i18n="aiSettings.vaultKicker">LOCAL ENCRYPTION</span><h3 data-ui-i18n="aiSettings.vaultHeading">Vault &amp; security</h3></span><p data-ui-i18n="aiSettings.vaultDescription">The public default gateway does not require a browser vault. Use the vault only for BYOK profiles.</p></div>
            <p class="ai-settings-callout" data-ui-i18n="aiSettings.publicGatewayNote">Default own gateway: server-side security applies; no browser API key is stored.</p>
            <div class="ai-settings-card ai-vault-card">
              <label for="ai-vault-passphrase"><span data-ui-i18n="aiSettings.passphrase">Vault passphrase</span><input id="ai-vault-passphrase" type="password" minlength="12" autocomplete="new-password" data-ui-i18n-placeholder="aiSettings.passphrasePlaceholder" placeholder="12 or more characters"></label>
              <button id="ai-unlock-vault" type="button" data-ui-i18n="aiSettings.unlock">Unlock vault</button>
              <p class="ai-field-note" data-ui-i18n="aiSettings.vaultNote">The derived key remains in memory only and is discarded when you lock or refresh this page.</p>
            </div>
            <div class="ai-settings-card">
              <label for="ai-api-key"><span data-ui-i18n="aiSettings.apiKey">Provider API key</span><input id="ai-api-key" type="password" autocomplete="off" data-ui-i18n-placeholder="aiSettings.apiKeyPlaceholder" placeholder="Stored as AES-256-GCM ciphertext"></label>
              <div class="ai-vault-actions">
                <button id="ai-lock-vault" class="secondary" type="button" data-ui-i18n="aiSettings.lock">Lock vault</button>
                <button id="ai-clear-vault" class="secondary ai-danger-button" type="button" data-ui-i18n="aiSettings.clear">Clear vault</button>
              </div>
            </div>
          </section>

          <section id="ai-settings-panel-usage" class="ai-settings-section" role="tabpanel" aria-labelledby="ai-settings-tab-usage" data-ai-settings-panel="usage" hidden>
            <div class="ai-settings-section-heading"><span><span class="ai-section-kicker" data-ui-i18n="aiSettings.usageKicker">RUNTIME GUARDRAILS</span><h3 data-ui-i18n="aiSettings.usageHeading">Usage limits</h3></span><p data-ui-i18n="aiSettings.usageDescription">Cap agent steps. Cost limits activate only when both token prices are supplied.</p></div>
            <div class="ai-settings-card ai-profile-grid">
              <label><span data-ui-i18n="aiSettings.maxSteps">Max agent steps</span><input id="ai-max-steps" type="number" min="4" max="100" step="1" value="100"></label>
              <span class="ai-settings-callout" data-ui-i18n="aiSettings.maxStepsNote">Allowed range: 4–100. The default is 100 steps.</span>
              <label><span data-ui-i18n="aiSettings.inputPrice">Input $ / 1M tokens</span><input id="ai-input-price" type="number" min="0" step="0.000001" data-ui-i18n-placeholder="aiSettings.optional" placeholder="Optional"></label>
              <label><span data-ui-i18n="aiSettings.outputPrice">Output $ / 1M tokens</span><input id="ai-output-price" type="number" min="0" step="0.000001" data-ui-i18n-placeholder="aiSettings.optional" placeholder="Optional"></label>
              <label class="ai-wide-field"><span data-ui-i18n="aiSettings.maxCost">Maximum cost (USD)</span><input id="ai-max-cost" type="number" min="0.000001" step="0.01" data-ui-i18n-placeholder="aiSettings.maxCostPlaceholder" placeholder="Optional; requires both token prices"></label>
            </div>
          </section>

          <section id="ai-settings-panel-privacy" class="ai-settings-section" role="tabpanel" aria-labelledby="ai-settings-tab-privacy" data-ai-settings-panel="privacy" hidden>
            <div class="ai-settings-section-heading"><span><span class="ai-section-kicker" data-ui-i18n="aiSettings.privacyKicker">DATA BOUNDARIES</span><h3 data-ui-i18n="aiSettings.privacyHeading">Privacy controls</h3></span><p data-ui-i18n="aiSettings.privacyDescription">PrintForm minimizes tool results before they are sent to your selected provider.</p></div>
            <div class="ai-privacy-list">
              <article><strong data-ui-i18n="aiSettings.encryptedAtRest">Encrypted at rest</strong><p data-ui-i18n="aiSettings.encryptedAtRestDescription">Provider credentials are encrypted in the browser vault with a passphrase-derived key.</p></article>
              <article><strong data-ui-i18n="aiSettings.realData">Memory-only real-data chats</strong><p data-ui-i18n="aiSettings.realDataDescription">Real-data mode does not create a persistent chat database.</p></article>
              <article><strong data-ui-i18n="aiSettings.redactedOutput">Redacted tool output</strong><p data-ui-i18n="aiSettings.redactedOutputDescription">Agent results keep structural codes and safe geometry while removing rendered business values.</p></article>
              <article class="warning"><strong data-ui-i18n="aiSettings.promptMatters">Your prompt still matters</strong><p data-ui-i18n="aiSettings.promptMattersDescription">Text you type, including business values or raw replacements, is sent to your chosen provider.</p></article>
            </div>
          </section>
        </div>
      </div>

      <footer class="ai-settings-footer">
        <p id="ai-settings-status" role="status" aria-live="polite" data-ui-i18n="aiSettings.status">Settings are encrypted locally after you save.</p>
        <div>
          <button id="ai-settings-cancel" class="secondary" type="button" data-ui-i18n="aiSettings.cancel">Cancel</button>
          <button id="ai-save-profile" type="button" data-ui-i18n="aiSettings.save">Save changes</button>
        </div>
      </footer>
    </section>
  </div>`;
}
