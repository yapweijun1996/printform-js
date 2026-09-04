import { DEFAULT_PROVIDER_PRESET, publicDefaultProviderProfile, validateProviderProfile } from "./agent-provider.js";
import { gatewayBadgeKey, gatewayOptionLabel, gatewayProfileFromForm, gatewayStatusKey } from "./agent-public-gateway.js";
import { populateProviderForm } from "./agent-settings-form.js";
import { agentErrorKey, translateAgentError } from "./agent-error-text.js";

export function bindAgentPanelVault({ $, vault, state, status, t }) {
  function profile() {
    return state.profileId === DEFAULT_PROVIDER_PRESET.id
      ? publicDefaultProviderProfile(state.publicGatewayKey)
      : state.profileId ? vault.getProfile(state.profileId) : null;
  }

  function renderProfiles() {
    const select = $("#ai-profile-select");
    if (!select) return;
    select.replaceChildren();
    const profiles = vault.listProfiles().filter((item) => item.id !== DEFAULT_PROVIDER_PRESET.id);
    select.append(new Option(gatewayOptionLabel(t, Boolean(state.publicGatewayKey)), DEFAULT_PROVIDER_PRESET.id));
    profiles.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      const providerKey = { openai: "aiSettings.providerOpenai", gemini: "aiSettings.providerGemini", custom: "aiSettings.providerCustom" }[item.provider];
      option.textContent = t("aiSettings.runtime.profileOption", { provider: t(providerKey, {}, item.provider), model: item.model });
      select.append(option);
    });
    if (state.profileId) select.value = state.profileId;
    const badge = $("#ai-settings-badge");
    if (badge) {
      badge.textContent = t(state.profileId === DEFAULT_PROVIDER_PRESET.id ? gatewayBadgeKey(Boolean(state.publicGatewayKey)) : "aiSettings.encryptedByok");
    }
  }

  function loadProfile(id) {
    state.profileId = id;
    const item = vault.getProfile(id) || (id === DEFAULT_PROVIDER_PRESET.id ? publicDefaultProviderProfile(state.publicGatewayKey) : null);
    if (!item) return;
    populateProviderForm($, item);
  }

  async function unlock() {
    try {
      await vault.unlock($("#ai-vault-passphrase").value);
      $("#ai-vault-passphrase").value = "";
      state.profileId = DEFAULT_PROVIDER_PRESET.id;
      populateProviderForm($, publicDefaultProviderProfile(state.publicGatewayKey));
      renderProfiles();
      status("aiSettings.runtime.unlocked");
    } catch (error) {
      status(agentErrorKey(error) || translateAgentError(error));
    }
  }

  async function saveProfile() {
    try {
      const draft = gatewayProfileFromForm($);
      if (!draft.isDefaultGateway && !vault.unlocked) throw new Error("Unlock the provider vault first");
      const error = validateProviderProfile(draft.profile);
      if (error) throw new Error(error);
      if (draft.isDefaultGateway) {
        state.publicGatewayKey = draft.gatewayKey;
        state.profileId = DEFAULT_PROVIDER_PRESET.id;
        populateProviderForm($, draft.profile);
        renderProfiles();
        status(gatewayStatusKey(Boolean(draft.gatewayKey)));
        return true;
      }
      await vault.saveProfile(draft.item);
      state.profileId = draft.item.id;
      renderProfiles();
      status("aiSettings.runtime.profileSaved");
      return true;
    } catch (error) {
      status(agentErrorKey(error) || translateAgentError(error));
      return false;
    }
  }

  async function clearVault() {
    if (!window.confirm(t("aiSettings.runtime.clearConfirm"))) return;
    try {
      state.controller?.stop();
      state.controller = null;
      state.profileId = DEFAULT_PROVIDER_PRESET.id;
      await vault.clear();
      $("#ai-api-key").value = "";
      $("#ai-input-price").value = "";
      $("#ai-output-price").value = "";
      $("#ai-max-cost").value = "";
      renderProfiles();
      populateProviderForm($, publicDefaultProviderProfile(state.publicGatewayKey));
      status(gatewayStatusKey(Boolean(state.publicGatewayKey)));
    } catch (error) {
      status(agentErrorKey(error) || translateAgentError(error));
    }
  }

  $("#ai-unlock-vault")?.addEventListener("click", unlock);
  $("#ai-clear-vault")?.addEventListener("click", clearVault);
  $("#ai-lock-vault")?.addEventListener("click", () => {
    state.controller?.stop();
    state.controller = null;
    vault.lock();
    state.profileId = DEFAULT_PROVIDER_PRESET.id;
    populateProviderForm($, publicDefaultProviderProfile(state.publicGatewayKey));
    renderProfiles();
    status(gatewayStatusKey(Boolean(state.publicGatewayKey)));
  });
  $("#ai-profile-select")?.addEventListener("change", (event) => loadProfile(event.target.value));

  return { profile, renderProfiles, loadProfile, unlock, saveProfile, clearVault };
}
