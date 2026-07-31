import EN from "./locales/en.js";

export const UI_LOCALES = Object.freeze(["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"]);
const STORAGE_KEY = "printform-studio-v2-ui-locale";
const loaders = {
  "zh-CN": () => import("./locales/zh.js"), "ms-MY": () => import("./locales/ms.js"),
  "ja-JP": () => import("./locales/ja.js"), "vi-VN": () => import("./locales/vi.js")
};
let locale = "en-MY";
let messages = EN;

function interpolate(value, variables) {
  return String(value).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => variables[key] ?? match);
}

export function t(key, variables = {}, fallback = key) {
  return interpolate(messages[key] ?? EN[key] ?? fallback, variables);
}

export function currentUiLocale() { return locale; }

function applyMessages(root) {
  root.querySelectorAll("[data-ui-i18n]").forEach((node) => { node.textContent = t(node.dataset.uiI18n); });
  const attributes = { uiI18nAriaLabel: "aria-label", uiI18nPlaceholder: "placeholder", uiI18nTitle: "title" };
  Object.entries(attributes).forEach(([datasetKey, attribute]) => {
    root.querySelectorAll(`[data-${datasetKey.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}]`).forEach((node) => node.setAttribute(attribute, t(node.dataset[datasetKey])));
  });
  root.documentElement.lang = locale;
  const select = root.getElementById("ui-locale-select");
  if (select) select.value = locale;
}

export async function setUiLocale(nextLocale, root = document, persist = true) {
  const requested = UI_LOCALES.includes(nextLocale) ? nextLocale : "en-MY";
  const loaded = requested === "en-MY" ? EN : (await loaders[requested]()).default;
  locale = requested;
  messages = loaded;
  applyMessages(root);
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* private storage can be unavailable */ }
  }
  window.dispatchEvent(new CustomEvent("printform:ui-locale", { detail: { locale } }));
  return locale;
}

export async function initUiI18n(root = document) {
  let saved = "en-MY";
  try { saved = localStorage.getItem(STORAGE_KEY) || "en-MY"; } catch { /* use English */ }
  try {
    return await setUiLocale(saved, root, false);
  } catch {
    // A failed dynamic locale import (404 / flaky network) must not reject the
    // module's top-level await in app.js — that would brick the whole Studio.
    return setUiLocale("en-MY", root, false);
  }
}

export function translateIssue(item) {
  return t(`issue.${item.code}`, {}, item.message);
}
