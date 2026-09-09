export function createStudioState() {
  const state = {
    lang: localStorage.getItem("pfstudio.lang") || "zh",
    templateId: localStorage.getItem("pfstudio.template") || null,
    compare: localStorage.getItem("pfstudio.compare") === "1",
    activeSide: "A",
    overrides: { A: {}, B: {} },
    descriptors: [],
    templates: [],
    templateHtml: null,
    workingHtml: null,
    templateBaseline: {},
    templateBaseHref: null,
    metrics: { A: null, B: null },
    viewMode: "preview",
    selectedBlockIndex: null,
    selectedBlockSide: null,
    blockCount: 0,
    rowCount: 0,
    sampleData: {},
    mustacheLiteSource: null,
    printformSource: null
  };

  try {
    const saved = JSON.parse(localStorage.getItem("pfstudio.overrides") || "null");
    if (saved && saved.A && saved.B) state.overrides = saved;
  } catch (error) {
    // Corrupted storage is non-fatal; a new session starts with no overrides.
  }
  return state;
}

export function persistStudioState(state) {
  localStorage.setItem("pfstudio.lang", state.lang);
  localStorage.setItem("pfstudio.compare", state.compare ? "1" : "0");
  if (state.templateId) localStorage.setItem("pfstudio.template", state.templateId);
  localStorage.setItem("pfstudio.overrides", JSON.stringify(state.overrides));
}
