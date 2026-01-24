/* eslint-disable no-console */

function safeSerialize(value) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (value instanceof Error) {
    const name = value.name || "Error";
    const message = value.message || "";
    return message ? `${name}: ${message}` : name;
  }
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return String(value);
    } catch {
      return "[unserializable]";
    }
  }
}

function formatArgs(args) {
  return Array.from(args).map(safeSerialize).join(" ");
}

function ensureDebugPanelStyle(doc) {
  if (!doc || !doc.head) return;
  const existing = doc.getElementById("printform-debug-panel-style");
  if (existing) return;
  const style = doc.createElement("style");
  style.id = "printform-debug-panel-style";
  style.textContent = `
    [data-printform-debug-panel="true"]{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;border:1px solid #ddd;background:#fafafa;color:#111;padding:12px;margin:12px 0;max-width:100%;overflow:auto}
    [data-printform-debug-panel="true"] .printform-debug-title{font-weight:700;margin-bottom:8px}
    [data-printform-debug-panel="true"] .printform-debug-meta{font-size:12px;opacity:.85;line-height:1.4;margin-bottom:8px;white-space:pre-wrap}
    [data-printform-debug-panel="true"] .printform-debug-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px}
    [data-printform-debug-panel="true"] button{font:inherit;font-size:12px;padding:6px 10px;border:1px solid #bbb;background:#fff;border-radius:6px}
    [data-printform-debug-panel="true"] button:active{transform:translateY(1px)}
    [data-printform-debug-panel="true"] .printform-debug-status{font-size:12px;opacity:.8}
    [data-printform-debug-panel="true"] pre{margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.35}
    @media print{[data-printform-debug-panel="true"]{display:none!important}}
  `.trim();
  doc.head.appendChild(style);
}

async function copyTextToClipboard(view, text) {
  if (!view) return { ok: false, method: "none" };
  const nav = view.navigator;
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === "function") {
    try {
      await nav.clipboard.writeText(text);
      return { ok: true, method: "navigator.clipboard.writeText" };
    } catch {
      // Fall back below.
    }
  }

  const doc = view.document;
  if (!doc) return { ok: false, method: "none" };
  const textarea = doc.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  doc.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const ok = doc.execCommand && doc.execCommand("copy");
    return { ok: Boolean(ok), method: "document.execCommand(copy)" };
  } catch {
    return { ok: false, method: "document.execCommand(copy)" };
  } finally {
    doc.body.removeChild(textarea);
  }
}

function formatConfigSummary(config) {
  if (!config) return "";
  const pick = (key) => (config && Object.prototype.hasOwnProperty.call(config, key) ? config[key] : undefined);
  const parts = [
    `papersizeWidth=${pick("papersizeWidth")}`,
    `papersizeHeight=${pick("papersizeHeight")}`,
    `paperSize=${pick("paperSize")}`,
    `orientation=${pick("orientation")}`,
    `dpi=${pick("dpi")}`,
    `nUp=${pick("nUp")}`,
    `repeatHeader=${pick("repeatHeader")}`,
    `repeatRowheader=${pick("repeatRowheader")}`,
    `repeatFooterLogo=${pick("repeatFooterLogo")}`,
    `repeatFooterPagenum=${pick("repeatFooterPagenum")}`
  ];
  return parts.join(", ");
}

export function createPrintformDebugSession({ enabled, formEl, config }) {
  const doc = formEl && formEl.ownerDocument ? formEl.ownerDocument : null;
  const view = doc && doc.defaultView ? doc.defaultView : null;
  const startMs = Date.now();
  const lines = [];
  let installed = false;
  let originals = null;
  let removeErrorHandlers = null;

  const pushLine = (level, args) => {
    const delta = Date.now() - startMs;
    const message = formatArgs(args);
    lines.push(`+${delta}ms [${level}] ${message}`);
  };

  const addEventLine = (level, message) => {
    const delta = Date.now() - startMs;
    lines.push(`+${delta}ms [${level}] ${message}`);
  };

  const install = () => {
    if (!enabled || installed || !view || !view.console) return;
    installed = true;
    const con = view.console;
    originals = {
      log: con.log,
      info: con.info,
      warn: con.warn,
      error: con.error
    };

    const wrap = (level) => function wrappedConsoleMethod(...args) {
      pushLine(level, args);
      const original = originals && originals[level];
      if (typeof original === "function") {
        try {
          original.apply(con, args);
        } catch {
          // Ignore console failures.
        }
      }
    };

    try {
      con.log = wrap("log");
      con.info = wrap("info");
      con.warn = wrap("warn");
      con.error = wrap("error");
    } catch {
      installed = false;
      originals = null;
      return;
    }

    const onError = (event) => {
      const message = event && event.message ? event.message : "window.error";
      addEventLine("error", message);
    };
    const onUnhandledRejection = (event) => {
      const reason = event && event.reason ? safeSerialize(event.reason) : "unhandledrejection";
      addEventLine("error", `unhandledrejection: ${reason}`);
    };
    if (typeof view.addEventListener === "function" && typeof view.removeEventListener === "function") {
      view.addEventListener("error", onError);
      view.addEventListener("unhandledrejection", onUnhandledRejection);
      removeErrorHandlers = () => {
        view.removeEventListener("error", onError);
        view.removeEventListener("unhandledrejection", onUnhandledRejection);
      };
    }

    try {
      con.log("[printform] ===== DEBUG SESSION START =====");
      con.log(`[printform] time: ${new Date(startMs).toISOString()}`);
      if (view.navigator && view.navigator.userAgent) {
        con.log(`[printform] userAgent: ${view.navigator.userAgent}`);
      }
      if (typeof view.devicePixelRatio === "number") {
        con.log(`[printform] devicePixelRatio: ${view.devicePixelRatio}`);
      }
      if (typeof view.innerWidth === "number" && typeof view.innerHeight === "number") {
        con.log(`[printform] viewport: ${view.innerWidth}x${view.innerHeight}`);
      }
      if (view.visualViewport) {
        con.log(`[printform] visualViewport: ${safeSerialize({ width: view.visualViewport.width, height: view.visualViewport.height, scale: view.visualViewport.scale })}`);
      }
      con.log(`[printform] config: ${formatConfigSummary(config)}`);
    } catch {
      // Ignore.
    }
  };

  const uninstall = () => {
    if (!installed || !view || !view.console) return;
    const con = view.console;
    if (removeErrorHandlers) {
      try {
        removeErrorHandlers();
      } catch {
        // Ignore.
      }
    }
    if (originals) {
      con.log = originals.log;
      con.info = originals.info;
      con.warn = originals.warn;
      con.error = originals.error;
    }
  };

  const markEnd = (details) => {
    if (!enabled || !installed || !view || !view.console) return;
    const con = view.console;
    try {
      con.log("[printform] ===== DEBUG SESSION END =====");
      if (details && typeof details === "object") {
        con.log(`[printform] debugSummary: ${safeSerialize(details)}`);
      }
    } catch {
      // Ignore.
    }
  };

  const getText = () => lines.join("\n");

  const appendPanel = (outputContainer, details) => {
    if (!enabled || !doc || !outputContainer) return;
    ensureDebugPanelStyle(doc);
    const panel = doc.createElement("div");
    panel.setAttribute("data-printform-debug-panel", "true");

    const title = doc.createElement("div");
    title.className = "printform-debug-title";
    title.textContent = "PrintForm Debug (data-debug=y)";
    panel.appendChild(title);

    const meta = doc.createElement("div");
    meta.className = "printform-debug-meta";
    const pageCount = details && Number.isFinite(details.pageCount) ? details.pageCount : null;
    const formId = formEl && formEl.id ? `#${formEl.id}` : "";
    const formClass = formEl && typeof formEl.className === "string" ? `.${formEl.className.split(/\s+/).filter(Boolean).join(".")}` : "";
    const formLabel = (formId || formClass) ? `${formId}${formClass}` : "(no id/class)";
    meta.textContent = [
      `form: ${formLabel}`,
      pageCount !== null ? `pages: ${pageCount}` : null,
      `config: ${formatConfigSummary(config)}`
    ].filter(Boolean).join("\n");
    panel.appendChild(meta);

    const actions = doc.createElement("div");
    actions.className = "printform-debug-actions";

    const copyButton = doc.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "Copy all logs";
    actions.appendChild(copyButton);

    const status = doc.createElement("span");
    status.className = "printform-debug-status";
    status.textContent = "";
    actions.appendChild(status);

    panel.appendChild(actions);

    const pre = doc.createElement("pre");
    pre.textContent = getText();
    panel.appendChild(pre);

    copyButton.addEventListener("click", async () => {
      const text = getText();
      const result = await copyTextToClipboard(view, text);
      status.textContent = result.ok ? `copied (${result.method})` : `copy failed (${result.method})`;
    });

    outputContainer.appendChild(panel);
  };

  return {
    install,
    markEnd,
    uninstall,
    appendPanel,
    getText
  };
}
