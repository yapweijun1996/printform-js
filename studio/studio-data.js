export function createDataController(app) {
  const { state } = app;

  function showDataJsonError(message) {
    const element = app.$("#data-json-error");
    if (!element) return;
    element.textContent = message;
    element.style.display = "";
  }

  function hideDataJsonError() {
    const element = app.$("#data-json-error");
    if (element) element.style.display = "none";
  }

  function renderWithData(html) {
    if (!html || !window.MustacheLite || !window.MustacheLite.hasPlaceholders(html)) return html;
    try {
      const rendered = window.MustacheLite.render(html, state.sampleData || {});
      hideDataJsonError();
      return rendered;
    } catch (error) {
      const prefix = state.lang === "zh" ? "渲染错误: " : "Render error: ";
      showDataJsonError(prefix + (error && error.message ? error.message : error));
      return html;
    }
  }

  function buildSampleSkeleton(html) {
    if (!window.MustacheLite) return {};
    let scan;
    try {
      scan = window.MustacheLite.scan(html);
    } catch (error) {
      const prefix = state.lang === "zh" ? "模板解析错误: " : "Template parse error: ";
      showDataJsonError(prefix + (error && error.message ? error.message : error));
      return {};
    }
    const data = {};
    scan.fields.forEach((name) => { data[name] = `${state.lang === "zh" ? "示例 " : "Sample "}${name}`; });
    scan.sections.forEach((section) => {
      const rows = [];
      for (let index = 1; index <= 3; index += 1) {
        const row = {};
        section.fields.forEach((field) => {
          if (/qty|count|num|quantity/i.test(field)) row[field] = index;
          else if (/price|amount|subtotal|total|cost/i.test(field)) row[field] = (index * 10).toFixed(2);
          else row[field] = `${field} ${index}`;
        });
        rows.push(row);
      }
      data[section.name] = rows;
    });
    return data;
  }

  function initSampleDataForTemplate(html) {
    const hasPlaceholders = window.MustacheLite && window.MustacheLite.hasPlaceholders(html);
    const panel = app.$("#data-panel");
    const emptyHint = app.$("#data-empty-hint");
    const jsonArea = app.$("#data-json");
    const actions = app.$("#data-actions");
    hideDataJsonError();

    if (!hasPlaceholders) {
      state.sampleData = {};
      emptyHint.style.display = "";
      jsonArea.style.display = "none";
      actions.style.display = "none";
      panel.open = false;
      return;
    }
    emptyHint.style.display = "none";
    jsonArea.style.display = "";
    actions.style.display = "flex";
    panel.open = true;

    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(`pfstudio.data.${state.templateId}`) || "null");
    } catch (error) {
      // Corrupted sample data falls back to the deterministic skeleton.
    }
    state.sampleData = saved || buildSampleSkeleton(html);
    jsonArea.value = JSON.stringify(state.sampleData, null, 2);
  }

  return { showDataJsonError, hideDataJsonError, renderWithData, buildSampleSkeleton, initSampleDataForTemplate };
}
