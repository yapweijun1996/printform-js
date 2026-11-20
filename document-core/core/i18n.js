export const PRINT_LOCALES = Object.freeze(["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"]);

function issue(code, message, path = "/i18n") {
  return { code, message, path, severity: "error" };
}

function templateKeys(html) {
  const doc = new DOMParser().parseFromString(`<template id="pf-i18n-scan">${html || ""}</template>`, "text/html");
  return [...new Set(Array.from(doc.getElementById("pf-i18n-scan").content.querySelectorAll("[data-pf-i18n]"))
    .map((node) => node.getAttribute("data-pf-i18n")?.trim()).filter(Boolean))];
}

function localeSupported(locale) {
  try { return Intl.DateTimeFormat.supportedLocalesOf([locale]).length === 1; }
  catch { return false; }
}

export function validateLocaleSettings(manifest = {}) {
  const errors = [];
  const locale = manifest.locale || "en-MY";
  if (!localeSupported(locale)) errors.push(issue("LOCALE_UNSUPPORTED", `Locale ${locale} is not supported`, "/manifest/locale"));
  try { new Intl.DateTimeFormat(locale, { timeZone: manifest.timeZone || "UTC" }); }
  catch { errors.push(issue("TIMEZONE_INVALID", `Time zone ${manifest.timeZone || "missing"} is invalid`, "/manifest/timeZone")); }
  try { new Intl.NumberFormat(locale, { style: "currency", currency: manifest.currency || "" }); }
  catch { errors.push(issue("CURRENCY_INVALID", `Currency ${manifest.currency || "missing"} is invalid`, "/manifest/currency")); }
  return errors;
}

export function validateI18n(project) {
  const errors = validateLocaleSettings(project.manifest);
  const keys = templateKeys(project.templateHtml);
  if (!keys.length) return { valid: errors.length === 0, errors, keys, locales: [] };
  const config = project.manifest?.i18n || {};
  const locales = config.supportedLocales || [];
  const fallback = config.fallbackLocale || "en-MY";
  if (!Array.isArray(locales) || !locales.length) errors.push(issue("I18N_LOCALES_MISSING", "Templates with data-pf-i18n require supportedLocales", "/manifest/i18n/supportedLocales"));
  locales.forEach((locale) => {
    if (!PRINT_LOCALES.includes(locale)) errors.push(issue("I18N_LOCALE_NOT_ALLOWED", `Locale ${locale} is outside the supported five-language profile`, "/manifest/i18n/supportedLocales"));
  });
  if (locales.length && !locales.includes(fallback)) errors.push(issue("I18N_FALLBACK_INVALID", `Fallback locale ${fallback} is not supported`, "/manifest/i18n/fallbackLocale"));
  if (locales.length && !locales.includes(project.manifest.locale)) errors.push(issue("I18N_ACTIVE_LOCALE_INVALID", `Active locale ${project.manifest.locale} is not supported`, "/manifest/locale"));
  locales.forEach((locale) => keys.forEach((key) => {
    if (typeof project.i18n?.[locale]?.[key] !== "string" || !project.i18n[locale][key].trim()) {
      errors.push(issue("I18N_KEY_MISSING", `Missing ${locale} translation for ${key}`, `/i18n/${locale}/${key}`));
    }
  }));
  return { valid: errors.length === 0, errors, keys, locales };
}

export function translateFragment(fragment, catalog = {}, locale, fallbackLocale) {
  const report = { locale, translated: 0, errors: [] };
  const active = catalog[locale] || {};
  const fallback = catalog[fallbackLocale] || {};
  fragment.querySelectorAll("[data-pf-i18n]").forEach((node) => {
    const key = node.getAttribute("data-pf-i18n");
    const value = active[key] ?? fallback[key];
    if (typeof value !== "string") report.errors.push(issue("I18N_KEY_MISSING", `Missing translation for ${key}`, `/i18n/${locale}/${key}`));
    else { node.textContent = value; report.translated += 1; }
  });
  return report;
}
