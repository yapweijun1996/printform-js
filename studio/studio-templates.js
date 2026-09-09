export function createTemplateController(app) {
  const { state } = app;

  function parseBaseline(html) {
    state.templateBaseline = {};
    const doc = new DOMParser().parseFromString(html, "text/html");
    const form = doc.querySelector(".printform");
    if (!form) return;
    Array.from(form.attributes).forEach((attribute) => {
      if (attribute.name.indexOf("data-") === 0) state.templateBaseline[attribute.name] = attribute.value;
    });
  }

  function loadPrintformSource(html) {
    state.printformSource = null;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const target = Array.from(doc.querySelectorAll("script[src]")).find((script) =>
      /printform(\.min)?\.js(\?|$)/i.test(script.getAttribute("src") || "")
    );
    if (!target) return;
    const url = new URL(target.getAttribute("src"), state.templateBaseHref).href;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`fetch ${response.status}`);
        return response.text();
      })
      .then((source) => { state.printformSource = source; })
      .catch(() => { /* export falls back to the original script reference */ });
  }

  function loadTemplate(id) {
    const template = state.templates.find((item) => item.id === id);
    if (!template) return Promise.reject(new Error(`unknown template: ${id}`));
    state.templateId = id;
    app.persist();

    let htmlPromise;
    if (template.html !== undefined) {
      state.templateBaseHref = new URL("../", location.href).href;
      htmlPromise = Promise.resolve(template.html);
    } else {
      const url = new URL(template.path, location.href);
      state.templateBaseHref = new URL("./", url).href;
      htmlPromise = fetch(url).then((response) => {
        if (!response.ok) throw new Error(`fetch ${response.status}`);
        return response.text();
      });
    }

    return htmlPromise.then((html) => {
      state.templateHtml = html;
      state.workingHtml = html;
      parseBaseline(html);
      app.initSampleDataForTemplate(html);
      app.buildConfigPanel();
      app.$("#row-count-range").disabled = true;
      app.reloadAll();
      loadPrintformSource(html);
    });
  }

  function importTemplateFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const html = String(reader.result || "");
      const id = `imported:${Date.now()}`;
      state.templates.push({ id, html, name: { zh: `📥 ${file.name}`, en: `📥 ${file.name}` } });
      buildTemplatePicker();
      app.$("#template-select").value = id;
      loadTemplate(id);
    };
    reader.readAsText(file);
  }

  function buildTemplatePicker() {
    const select = app.$("#template-select");
    select.innerHTML = "";
    state.templates.forEach((template) => {
      const option = document.createElement("option");
      option.value = template.id;
      option.textContent = template.name[state.lang] || template.name.zh;
      select.appendChild(option);
    });
    select.value = state.templateId;
  }

  return { parseBaseline, loadPrintformSource, loadTemplate, importTemplateFile, buildTemplatePicker };
}
