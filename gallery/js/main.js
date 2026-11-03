import { loadManifest } from "./manifest-loader.js";
import { newestFirst } from "./order.js";
import { filterDesigns } from "./filter.js";
import { normalizeFilters, readFilters, filterURL } from "./filter-state.js";
import { createFilters } from "./filter-controls.js";
import { createModal } from "./modal.js";
import { currentLanguage, pageCount, setLanguage, text, typeName } from "./i18n.js";
import "./pwa.js";

const grid = document.querySelector("#gallery-grid");
const search = document.querySelector("#search");
const empty = document.querySelector("#empty-state");
const count = document.querySelector("#result-count");
const status = document.querySelector("#load-status");
const retry = document.querySelector("#retry-load");
let manifest, modal, syncControls, filters, loadState = "loading", editingQuery = false;

// Keep the DOM in reading order while packing each card into the shortest column.
let layoutFrame = 0;
function layoutCards() {
  const cards = [...grid.children];
  const width = grid.clientWidth;
  if (!width) return;
  const columns = width < 580 ? 2 : width < 860 ? 3 : width < 1100 ? 4 : 5;
  const gap = width < 580 ? 10 : 18;
  const cardWidth = (width - gap * (columns - 1)) / columns;
  grid.classList.add("is-masonry");
  cards.forEach((card) => { card.style.width = `${cardWidth}px`; });
  const cardHeights = cards.map((card) => card.offsetHeight);
  const heights = Array(columns).fill(0);
  cards.forEach((card, index) => {
    const column = heights.indexOf(Math.min(...heights));
    card.style.left = `${column * (cardWidth + gap)}px`;
    card.style.top = `${heights[column]}px`;
    heights[column] += cardHeights[index] + gap;
  });
  grid.style.height = `${Math.max(0, ...heights) - (cards.length ? gap : 0)}px`;
}
function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(layoutCards);
}
const layoutObserver = new ResizeObserver(scheduleLayout);
function observeCards() {
  layoutObserver.disconnect();
  layoutObserver.observe(grid);
  [...grid.children].forEach((card) => layoutObserver.observe(card));
  layoutCards();
}
window.addEventListener("resize", layoutCards);

function update(patch, historyMode = "pushState") {
  filters = normalizeFilters(manifest, { ...filters, ...patch });
  const url = filterURL(location.href, filters);
  if (url.href !== location.href) history[historyMode](null, "", url);
  render();
}

function render() {
  syncControls(filters);
  if (search.value !== filters.query) search.value = filters.query;
  const designs = filterDesigns(manifest, filters);
  grid.replaceChildren(...designs.map((design) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "gallery-card";
    card.dataset.designId = design.id;
    const image = document.createElement("img");
    image.src = design.thumb;
    image.alt = design.title[currentLanguage()];
    image.width = design.width;
    image.height = design.height;
    image.loading = "lazy";
    const info = document.createElement("div");
    info.className = "card-info";
    const labels = document.createElement("div");
    const heading = document.createElement("h2");
    heading.textContent = design.title[currentLanguage()];
    const idLine = document.createElement("p");
    idLine.className = "card-id";
    idLine.textContent = design.no;
    const details = document.createElement("p");
    details.textContent = `${design.style[currentLanguage()]} · ${design.paper} · ${pageCount(design.pages)}`;
    labels.append(idLine, heading, details);
    const type = document.createElement("span");
    type.className = "type-tag";
    type.textContent = typeName(design.type);
    info.append(labels, type);
    card.append(image, info);
    card.addEventListener("click", () => modal.show(design, card));
    return card;
  }));
  observeCards();
  empty.hidden = designs.length !== 0;
  const noun = designs.length === 1 ? text("resultOne") : text("resultMany");
  count.textContent = `${designs.length}/${manifest.length} ${noun}`;
}

function showLoadState() {
  status.hidden = loadState === "ready";
  status.querySelector("span").textContent = text(loadState === "error" ? "loadError" : "loading");
  retry.hidden = loadState !== "error";
  grid.setAttribute("aria-busy", String(loadState === "loading"));
  document.querySelectorAll(".controls input, .controls select, #clear-filters").forEach((control) => { control.disabled = loadState !== "ready"; });
}
async function start() {
  const restoreFocus = document.activeElement === retry;
  loadState = "loading";
  showLoadState();
  try {
    manifest = newestFirst(await loadManifest());
    filters = readFilters(manifest, location.search);
    modal = createModal(document.querySelector("#design-modal"), manifest);
    syncControls = createFilters(manifest, (patch) => { editingQuery = false; update(patch); });
    loadState = "ready";
    showLoadState();
    update({}, "replaceState");
    if (restoreFocus) search.focus();
  } catch {
    loadState = "error";
    showLoadState();
  }
}
search.addEventListener("input", () => {
  update({ query: search.value }, editingQuery ? "replaceState" : "pushState");
  editingQuery = true;
});
search.addEventListener("blur", () => { editingQuery = false; });
retry.addEventListener("click", start);
window.addEventListener("popstate", () => {
  if (loadState !== "ready") return;
  editingQuery = false;
  filters = readFilters(manifest, location.search);
  update({}, "replaceState");
});
document.querySelectorAll("[data-language]").forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.language);
    showLoadState();
    if (loadState === "ready") render();
  });
});
setLanguage(localStorage.getItem("printform_lang") || "en");
start();
