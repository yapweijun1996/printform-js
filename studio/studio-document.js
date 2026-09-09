export function createDocumentController(app) {
  const { state } = app;

  function findPrintformScriptTag(doc) {
    return Array.from(doc.querySelectorAll("script[src]")).find((script) =>
      /printform(\.min)?\.js(\?|$)/i.test(script.getAttribute("src") || "")
    ) || null;
  }

  function applyOverrides(doc, overrides) {
    doc.querySelectorAll(".printform").forEach((form) => {
      Object.keys(overrides).forEach((attribute) => form.setAttribute(attribute, overrides[attribute]));
    });
  }

  function inlinePrintformScript(doc) {
    if (!state.printformSource) return false;
    const target = findPrintformScriptTag(doc);
    if (!target) return false;
    target.removeAttribute("src");
    target.textContent = state.printformSource;
    return true;
  }

  function extractInlinedPrintformScript(doc) {
    if (!state.printformSource) return null;
    const target = findPrintformScriptTag(doc);
    if (!target) return null;
    target.remove();
    target.removeAttribute("src");
    target.textContent = state.printformSource;
    return target;
  }

  function addBase(doc) {
    const base = doc.createElement("base");
    base.setAttribute("href", state.templateBaseHref);
    const head = doc.querySelector("head");
    if (head) head.insertBefore(base, head.firstChild);
  }

  function synthesizeHtml(side, forExport, skipBridge) {
    const html = app.renderWithData(state.workingHtml);
    if (!html) return null;
    const doc = new DOMParser().parseFromString(html, "text/html");
    applyOverrides(doc, state.overrides[side]);
    addBase(doc);

    if (!forExport) {
      doc.documentElement.setAttribute("data-studio-side", side);
      doc.documentElement.setAttribute("data-studio-mode", "preview");
      if (!skipBridge) {
        const bridge = doc.createElement("script");
        bridge.setAttribute("src", new URL("./bridge.js", location.href).href);
        const body = doc.querySelector("body");
        if (body) body.insertBefore(bridge, body.firstChild);
      }
    } else if (inlinePrintformScript(doc)) {
      const base = doc.querySelector("head > base");
      if (base) base.remove();
    }
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  function synthesizeStructureHtml(side) {
    const html = state.workingHtml;
    if (!html) return null;
    const doc = new DOMParser().parseFromString(html, "text/html");
    applyOverrides(doc, state.overrides[side]);
    Array.from(doc.querySelectorAll('script[src*="printform"]')).forEach((script) => script.remove());
    addBase(doc);
    doc.documentElement.setAttribute("data-studio-side", side);
    doc.documentElement.setAttribute("data-studio-mode", "structure");
    const bridge = doc.createElement("script");
    bridge.setAttribute("src", new URL("./bridge.js", location.href).href);
    const body = doc.querySelector("body");
    if (body) body.insertBefore(bridge, body.firstChild);
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  function withWorkingDoc(mutator) {
    const doc = new DOMParser().parseFromString(state.workingHtml, "text/html");
    const form = doc.querySelector(".printform");
    if (!form) return;
    const children = Array.from(form.children);
    mutator(doc, form, children);
    state.workingHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    app.reloadAll();
  }

  function applyBlockEdit(index, html) {
    withWorkingDoc((doc, form, children) => {
      const target = children[index];
      if (!target) return;
      const wrapper = doc.createElement("div");
      wrapper.innerHTML = html;
      const replacement = wrapper.firstElementChild;
      if (replacement) target.replaceWith(replacement);
    });
  }

  function duplicateBlock(index) {
    withWorkingDoc((doc, form, children) => {
      const target = children[index];
      if (target) target.after(target.cloneNode(true));
    });
  }

  function deleteBlock(index) {
    withWorkingDoc((doc, form, children) => {
      const target = children[index];
      if (!target) return;
      const rows = children.filter((child) => app.classify(child) === "prowitem");
      if (app.classify(target) === "prowitem" && rows.length <= 1) return;
      target.remove();
    });
  }

  function setRowCount(count) {
    withWorkingDoc((doc, form, children) => {
      const rows = children.filter((child) => app.classify(child) === "prowitem");
      if (!rows.length) return;
      let last = rows[rows.length - 1];
      while (rows.length < count) {
        const clone = last.cloneNode(true);
        last.after(clone);
        last = clone;
        rows.push(clone);
      }
      while (rows.length > count && rows.length > 1) rows.pop().remove();
    });
  }

  function synthesizePackageHtml() {
    const html = state.workingHtml;
    if (!html) return null;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const form = doc.querySelector(".printform");
    if (!form) return null;
    Object.keys(state.overrides[state.activeSide]).forEach((attribute) => {
      form.setAttribute(attribute, state.overrides[state.activeSide][attribute]);
    });
    const rawOuterHtml = form.outerHTML;
    const printformScript = extractInlinedPrintformScript(doc);
    const mount = doc.createElement("div");
    mount.id = "printform-mount";
    form.replaceWith(mount);

    const template = doc.createElement("template");
    template.id = "printform-raw-template";
    template.innerHTML = rawOuterHtml;
    const mustacheScript = doc.createElement("script");
    mustacheScript.textContent = state.mustacheLiteSource || "";
    const sampleData = JSON.stringify(state.sampleData || {}).replace(/<\/script/gi, "<\\/script");
    const bootstrap = doc.createElement("script");
    bootstrap.textContent = [
      "window.PrintFormTemplate = {",
      "  render: function (data) {",
      "    var raw = document.getElementById('printform-raw-template').innerHTML;",
      "    var rendered = window.MustacheLite.render(raw, data || {});",
      "    var mount = document.getElementById('printform-mount');",
      "    mount.innerHTML = rendered;",
      "    if (window.PrintForm && typeof window.PrintForm.formatAll === 'function') {",
      "      return window.PrintForm.formatAll({ force: true });",
      "    }",
      "    return Promise.resolve();",
      "  }",
      "};",
      `window.PrintFormTemplate.render(${sampleData});`
    ].join("\n");
    if (printformScript) mount.after(template, printformScript, mustacheScript, bootstrap);
    else mount.after(template, mustacheScript, bootstrap);
    return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  }

  return {
    findPrintformScriptTag,
    extractInlinedPrintformScript,
    synthesizeHtml,
    synthesizeStructureHtml,
    synthesizePackageHtml,
    applyBlockEdit,
    duplicateBlock,
    deleteBlock,
    setRowCount
  };
}
