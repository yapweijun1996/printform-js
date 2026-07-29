import { beforeEach, describe, expect, it, vi } from "vitest";
import EN from "../../studio-v2/ui/locales/en.js";
import ZH from "../../studio-v2/ui/locales/zh.js";
import MS from "../../studio-v2/ui/locales/ms.js";
import JA from "../../studio-v2/ui/locales/ja.js";
import VI from "../../studio-v2/ui/locales/vi.js";
import { currentUiLocale, initUiI18n, setUiLocale, t } from "../../studio-v2/ui/ui-i18n.js";

function fixture() {
  document.body.innerHTML = `
    <select id="ui-locale-select"><option value="en-MY">English</option><option value="zh-CN">中文</option><option value="ms-MY">Melayu</option><option value="ja-JP">日本語</option><option value="vi-VN">Việt</option></select>
    <h2 data-ui-i18n="editor.projectSource">stale</h2>
    <textarea id="source"></textarea>
    <input data-ui-i18n-placeholder="editor.assetPlaceholder">
    <button data-ui-i18n-aria-label="actions.aria">Action</button>`;
}

describe("Studio UI i18n", () => {
  beforeEach(async () => {
    const values = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
      clear: () => values.clear()
    });
    fixture();
    await setUiLocale("en-MY", document, false);
  });

  it("defaults to English instead of the browser language", async () => {
    await initUiI18n();
    expect(currentUiLocale()).toBe("en-MY");
    expect(document.documentElement.lang).toBe("en-MY");
    expect(document.querySelector("h2").textContent).toBe("Project source");
  });

  it("switches text and attributes in place without losing editor focus", async () => {
    const editor = document.querySelector("#source");
    editor.focus();
    await setUiLocale("zh-CN");
    expect(document.activeElement).toBe(editor);
    expect(document.querySelector("h2").textContent).toBe("项目源");
    expect(document.querySelector("input").placeholder).toContain("HTTPS");
    expect(document.querySelector("button").getAttribute("aria-label")).toBe("文件与验证操作");
    expect(localStorage.getItem("printform-studio-v2-ui-locale")).toBe("zh-CN");
  });

  it("restores a persisted language and falls back to English keys", async () => {
    localStorage.setItem("printform-studio-v2-ui-locale", "ms-MY");
    await initUiI18n();
    expect(document.querySelector("h2").textContent).toBe("Sumber projek");
    expect(t("missing.key", {}, "Fallback copy")).toBe("Fallback copy");
  });

  it("ships a complete non-empty catalog for all five supported languages", () => {
    const catalogs = [EN, ZH, MS, JA, VI];
    for (const catalog of catalogs) {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(EN).sort());
      expect(Object.values(catalog).every((value) => typeof value === "string" && value.length > 0)).toBe(true);
    }
    expect([EN, ZH, MS, JA, VI].map((catalog) => catalog["editor.projectSource"]))
      .toEqual(["Project source", "项目源", "Sumber projek", "プロジェクトソース", "Nguồn dự án"]);
  });
});
