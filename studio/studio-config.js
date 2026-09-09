const BOOL_TOKENS = { y: true, yes: true, true: true, 1: true, n: false, no: false, false: false, 0: false };

export function createConfigController(app) {
  const { state } = app;

  function descLabel(descriptor) {
    return state.lang === "en" && descriptor.descriptionEn ? descriptor.descriptionEn : descriptor.description;
  }

  function catLabel(descriptor) {
    return state.lang === "en" && descriptor.categoryEn ? descriptor.categoryEn : descriptor.category;
  }

  function currentOverrides() {
    return state.overrides[state.activeSide];
  }

  function defaultAsString(descriptor) {
    const value = descriptor.defaultValue;
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "y" : "n";
    return String(value);
  }

  function baselineValue(descriptor) {
    if (Object.prototype.hasOwnProperty.call(state.templateBaseline, descriptor.htmlAttr)) {
      return state.templateBaseline[descriptor.htmlAttr];
    }
    return defaultAsString(descriptor);
  }

  function effectiveValue(descriptor) {
    const overrides = currentOverrides();
    return Object.prototype.hasOwnProperty.call(overrides, descriptor.htmlAttr)
      ? overrides[descriptor.htmlAttr]
      : baselineValue(descriptor);
  }

  function isChanged(descriptor) {
    return Object.prototype.hasOwnProperty.call(currentOverrides(), descriptor.htmlAttr);
  }

  function clearConflictingPaperSizeFields(descriptor, value) {
    if (value === "") return false;
    const overrides = currentOverrides();
    let touched = false;
    function clearField(htmlAttr) {
      const field = state.descriptors.find((item) => item.htmlAttr === htmlAttr);
      if (!field) return;
      if (baselineValue(field) === "") {
        if (Object.prototype.hasOwnProperty.call(overrides, htmlAttr)) {
          delete overrides[htmlAttr];
          touched = true;
        }
      } else if (overrides[htmlAttr] !== "") {
        overrides[htmlAttr] = "";
        touched = true;
      }
    }
    if (descriptor.htmlAttr === "data-paper-size") {
      clearField("data-papersize-width");
      clearField("data-papersize-height");
    } else if (descriptor.htmlAttr === "data-papersize-width" || descriptor.htmlAttr === "data-papersize-height") {
      clearField("data-paper-size");
    }
    return touched;
  }

  function refreshItemState(descriptor) {
    const item = app.$(`[data-attr="${descriptor.htmlAttr}"]`);
    if (item) item.classList.toggle("changed", isChanged(descriptor));
  }

  function setOverride(descriptor, value) {
    const overrides = currentOverrides();
    if (value === baselineValue(descriptor)) delete overrides[descriptor.htmlAttr];
    else overrides[descriptor.htmlAttr] = value;

    const touchedSiblings = clearConflictingPaperSizeFields(descriptor, value);
    app.persist();
    app.scheduleReload(state.activeSide);
    if (touchedSiblings) buildConfigPanel();
    else refreshItemState(descriptor);
  }

  function isBooleanDescriptor(descriptor) {
    if (typeof descriptor.defaultValue === "boolean") return true;
    const value = String(descriptor.defaultValue).toLowerCase();
    return descriptor.type === "Boolean" || ["y", "n", "yes", "no"].includes(value);
  }

  function isMultilineDescriptor(descriptor) {
    return /content/i.test(descriptor.key);
  }

  function buildConfigPanel() {
    const host = app.$("#config-groups");
    const previouslyOpen = {};
    host.querySelectorAll("details.config-group").forEach((element) => {
      const label = element.querySelector("summary span");
      if (label) previouslyOpen[label.textContent] = element.open;
    });
    host.innerHTML = "";
    const filter = (app.$("#config-search").value || "").toLowerCase();
    const groups = [];
    const byCategory = {};
    state.descriptors.forEach((descriptor) => {
      const category = catLabel(descriptor);
      const text = `${descriptor.htmlAttr} ${descLabel(descriptor)}`.toLowerCase();
      if (filter && !text.includes(filter)) return;
      if (!byCategory[category]) {
        byCategory[category] = [];
        groups.push(category);
      }
      byCategory[category].push(descriptor);
    });

    groups.forEach((category) => {
      const details = document.createElement("details");
      details.className = "config-group";
      details.open = Object.prototype.hasOwnProperty.call(previouslyOpen, category)
        ? previouslyOpen[category]
        : Boolean(filter) || groups.length <= 2;
      const summary = document.createElement("summary");
      summary.innerHTML = `<span>${category}</span> <span class='count'>(${byCategory[category].length})</span>`;
      details.appendChild(summary);
      byCategory[category].forEach((descriptor) => details.appendChild(buildConfigItem(descriptor)));
      host.appendChild(details);
    });
  }

  function buildConfigItem(descriptor) {
    const item = document.createElement("div");
    item.className = "config-item";
    item.setAttribute("data-attr", descriptor.htmlAttr);
    if (isChanged(descriptor)) item.classList.add("changed");

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = descriptor.htmlAttr.replace(/^data-/, "");
    label.title = `${descriptor.htmlAttr}\n${descLabel(descriptor)}\n${state.lang === "zh" ? "模板值" : "template"}: ${baselineValue(descriptor) || "(empty)"}`;
    item.appendChild(label);

    const resetButton = document.createElement("button");
    resetButton.className = "reset-btn";
    resetButton.textContent = "↺";
    resetButton.title = "reset";
    resetButton.addEventListener("click", () => {
      delete currentOverrides()[descriptor.htmlAttr];
      app.persist();
      app.scheduleReload(state.activeSide);
      buildConfigPanel();
    });
    item.appendChild(resetButton);

    const value = effectiveValue(descriptor);
    if (isBooleanDescriptor(descriptor)) {
      const switchLabel = document.createElement("label");
      switchLabel.className = "switch";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = BOOL_TOKENS[String(value).toLowerCase()] === true;
      const track = document.createElement("span");
      track.className = "track";
      input.addEventListener("change", () => setOverride(descriptor, input.checked ? "y" : "n"));
      switchLabel.append(input, track);
      item.appendChild(switchLabel);
    } else if (descriptor.options) {
      const select = document.createElement("select");
      descriptor.options.forEach((option) => {
        const element = document.createElement("option");
        element.value = option;
        element.textContent = option === "" ? "(auto)" : option;
        select.appendChild(element);
      });
      select.value = value;
      select.addEventListener("change", () => setOverride(descriptor, select.value));
      item.appendChild(select);
    } else if (isMultilineDescriptor(descriptor)) {
      item.classList.add("multiline");
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.spellcheck = false;
      let timer = null;
      textarea.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => setOverride(descriptor, textarea.value), 500);
      });
      item.appendChild(textarea);
    } else {
      const input = document.createElement("input");
      input.type = descriptor.type === "Number" ? "number" : "text";
      input.value = value;
      input.placeholder = baselineValue(descriptor);
      input.addEventListener("change", () => setOverride(descriptor, input.value));
      item.appendChild(input);
    }
    return item;
  }

  return { buildConfigPanel, currentOverrides };
}
