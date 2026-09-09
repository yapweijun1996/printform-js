const SECONDARY_BUTTON_IDS = [
  "import-html", "compare-toggle", "mode-toggle", "toggle-config",
  "toggle-inspector", "lang-toggle", "print-preview"
];
const PANEL_QUERY = "(max-width: 900px)";

export function createResponsiveController(app) {
  function setupResponsiveTopbar() {
    const topbar = app.$("#topbar");
    const moreMenu = app.$("#more-menu");
    const moreToggle = app.$("#more-menu-toggle");
    const spacer = topbar.querySelector(".spacer");

    function closeMenu() {
      moreMenu.classList.remove("open");
      moreToggle.setAttribute("aria-expanded", "false");
    }
    function openMenu() {
      const rect = moreToggle.getBoundingClientRect();
      moreMenu.style.top = `${rect.bottom + 6}px`;
      moreMenu.style.right = `${window.innerWidth - rect.right}px`;
      moreMenu.style.left = "auto";
      moreMenu.classList.add("open");
      moreToggle.setAttribute("aria-expanded", "true");
    }
    function applyLayout(isCompact) {
      topbar.classList.toggle("compact", isCompact);
      if (isCompact) {
        moreMenu.append(...SECONDARY_BUTTON_IDS.map((id) => app.$(`#${id}`)));
      } else {
        closeMenu();
        spacer.before(app.$("#import-html"), app.$("#compare-toggle"), app.$("#mode-toggle"));
        app.$("#export-html").before(app.$("#toggle-config"), app.$("#toggle-inspector"), app.$("#lang-toggle"), app.$("#print-preview"));
      }
    }
    moreToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      if (moreMenu.classList.contains("open")) closeMenu();
      else openMenu();
    });
    moreMenu.addEventListener("click", (event) => {
      if (event.target.closest("button")) closeMenu();
    });
    document.addEventListener("click", (event) => {
      if (!app.$("#more-menu-wrap").contains(event.target)) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    function checkFit() {
      applyLayout(false);
      if (topbar.scrollWidth > topbar.clientWidth + 1) applyLayout(true);
    }
    checkFit();
    window.addEventListener("resize", checkFit);
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(checkFit).observe(topbar);
    window.addEventListener("resize", closeMenu);
    return checkFit;
  }

  function setupMobilePanels() {
    const media = window.matchMedia(PANEL_QUERY);
    const closeConfig = () => document.body.classList.add("hide-config");
    const closeInspector = () => document.body.classList.add("hide-inspector");
    app.$("#close-config").addEventListener("click", closeConfig);
    app.$("#close-inspector").addEventListener("click", closeInspector);
    function applyDefault(isMobile) {
      if (isMobile) {
        closeConfig();
        closeInspector();
      }
    }
    applyDefault(media.matches);
    media.addEventListener("change", (event) => applyDefault(event.matches));
    window.addEventListener("resize", () => applyDefault(media.matches));
  }

  return { setupResponsiveTopbar, setupMobilePanels };
}
