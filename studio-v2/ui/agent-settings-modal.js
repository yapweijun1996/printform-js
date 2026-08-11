const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

function visibleFocusable(modal) {
  return Array.from(modal.querySelectorAll(FOCUSABLE)).filter((node) => !node.hidden && node.getClientRects().length);
}

export function bindAgentSettingsModal({ get, onSave }) {
  const modal = get("#ai-provider-details");
  const settingsButton = get("#ai-settings-button");
  const closeButton = get("#ai-settings-close");
  const sidebar = modal.querySelector(".ai-settings-sidebar");
  const tabs = Array.from(modal.querySelectorAll("[data-ai-settings-section]"));
  const panels = Array.from(modal.querySelectorAll("[data-ai-settings-panel]"));
  const compactNavigation = window.matchMedia("(max-width: 440px)");
  let returnFocus = settingsButton;
  let inerted = [];

  function syncOrientation() {
    sidebar.setAttribute("aria-orientation", compactNavigation.matches ? "horizontal" : "vertical");
  }

  function selectSection(name, { moveFocus = false } = {}) {
    let selectedTab = tabs.find((tab) => tab.dataset.aiSettingsSection === name) || tabs[0];
    tabs.forEach((tab) => {
      const selected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.aiSettingsPanel !== selectedTab.dataset.aiSettingsSection; });
    if (moveFocus) selectedTab.focus();
    return selectedTab;
  }

  function open({ section = "provider", focusSelector, opener = document.activeElement } = {}) {
    if (!modal.hidden) return;
    returnFocus = opener instanceof HTMLElement ? opener : settingsButton;
    inerted = Array.from(document.body.children).filter((node) => node !== modal && !node.inert);
    inerted.forEach((node) => { node.inert = true; });
    modal.hidden = false;
    document.body.classList.add("ai-settings-modal-open");
    document.documentElement.classList.add("ai-settings-modal-open");
    settingsButton.setAttribute("aria-expanded", "true");
    selectSection(section);
    requestAnimationFrame(() => (focusSelector ? get(focusSelector) : closeButton)?.focus());
  }

  function close({ restoreFocus = true } = {}) {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("ai-settings-modal-open");
    document.documentElement.classList.remove("ai-settings-modal-open");
    settingsButton.setAttribute("aria-expanded", "false");
    inerted.forEach((node) => { node.inert = node.getAttribute("aria-hidden") === "true"; });
    inerted = [];
    if (restoreFocus) {
      const target = [returnFocus, settingsButton, get("#inspector-toggle")].find((node) => node?.isConnected && !node.closest("[inert]") && node.getClientRects().length);
      target?.focus();
    }
  }

  syncOrientation();
  compactNavigation.addEventListener?.("change", syncOrientation);
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectSection(tab.dataset.aiSettingsSection));
    tab.addEventListener("keydown", (event) => {
      const directionalKeys = compactNavigation.matches ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
      if (![...directionalKeys, "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const delta = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
      const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + delta + tabs.length) % tabs.length;
      selectSection(tabs[nextIndex].dataset.aiSettingsSection, { moveFocus: true });
    });
  });

  settingsButton.addEventListener("click", () => open({ opener: settingsButton }));
  get("#ai-open-settings").addEventListener("click", (event) => open({ section: "provider", focusSelector: "#ai-model", opener: event.currentTarget }));
  closeButton.addEventListener("click", () => close());
  get("#ai-settings-cancel").addEventListener("click", () => close());
  get("#ai-save-profile").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    const saved = await onSave();
    event.currentTarget.disabled = false;
    if (saved) close();
  });
  modal.addEventListener("click", (event) => { if (event.target === modal) close(); });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    event.stopPropagation();
    const focusable = visibleFocusable(modal);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });

  return { close, open, selectSection };
}
