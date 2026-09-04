import { beforeEach, describe, expect, it, vi } from "vitest";
import EN from "../../studio-v2/ui/locales/en.js";
import ZH from "../../studio-v2/ui/locales/zh.js";
import MS from "../../studio-v2/ui/locales/ms.js";
import JA from "../../studio-v2/ui/locales/ja.js";
import VI from "../../studio-v2/ui/locales/vi.js";
import { settingsModalMarkup } from "../../studio-v2/ui/agent-settings-view.js";
import { panelMarkup, headerClusterMarkup } from "../../studio-v2/ui/agent-panel-view.js";
import { translateAgentError } from "../../studio-v2/ui/agent-error-text.js";
import { applyUiI18n, currentUiLocale, initUiI18n, setUiLocale, t } from "../../studio-v2/ui/ui-i18n.js";

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

  it("applies the selected locale to a settings modal inserted after startup", async () => {
    document.body.insertAdjacentHTML("beforeend", settingsModalMarkup());
    await setUiLocale("zh-CN", document, false);
    applyUiI18n(document);
    expect(document.querySelector("#ai-settings-title").textContent).toBe("提供商设置");
    expect(document.querySelector("#ai-save-profile").textContent).toBe("保存更改");
    expect(document.querySelector("#ai-settings-close").getAttribute("aria-label")).toBe("关闭提供商设置");
    expect(document.querySelector("#ai-vault-passphrase").placeholder).toBe("至少 12 个字符");

    await setUiLocale("ja-JP", document, false);
    expect(document.querySelector("#ai-settings-title").textContent).toBe("プロバイダー設定");
    expect(document.querySelector("#ai-save-profile").textContent).toBe("変更を保存");
  });

  it("localizes the complete AI Chatbox shell, prompts, and accessibility attributes", async () => {
    document.body.insertAdjacentHTML("beforeend", panelMarkup());
    // Brand + primary actions render into the shared inspector header at runtime.
    const cluster = headerClusterMarkup();
    document.body.insertAdjacentHTML("beforeend", cluster.brand + cluster.actions);
    const expected = {
      "en-MY": { title: "Design your print form", send: "Send", aria: "Start a new AI chat", placeholder: "Ask AI to redesign this print form…", prompt: "Make the Description column wider and keep the table within the page." },
      "zh-CN": { title: "设计你的打印表单", send: "发送", aria: "开始新的 AI 聊天", placeholder: "让 AI 重新设计这个打印表单…", prompt: "加宽 Description 列，并确保表格仍在页面范围内。" },
      "ms-MY": { title: "Reka bentuk borang cetakan anda", send: "Hantar", aria: "Mulakan sembang AI baharu", placeholder: "Minta AI mereka bentuk semula borang cetakan ini…", prompt: "Lebarkan lajur Description dan pastikan jadual kekal dalam halaman." },
      "ja-JP": { title: "印刷フォームをデザイン", send: "送信", aria: "新しいAIチャットを開始", placeholder: "AIに印刷フォームの再デザインを依頼…", prompt: "Description列を広げ、表がページ内に収まるようにしてください。" },
      "vi-VN": { title: "Thiết kế biểu mẫu in của bạn", send: "Gửi", aria: "Bắt đầu cuộc trò chuyện AI mới", placeholder: "Yêu cầu AI thiết kế lại biểu mẫu in này…", prompt: "Mở rộng cột Description và giữ bảng nằm trong trang." }
    };
    for (const [locale, copy] of Object.entries(expected)) {
      await setUiLocale(locale, document, false);
      expect(document.querySelector("#ai-welcome-title").textContent).toBe(copy.title);
      expect(document.querySelector("#ai-send").textContent.trim()).toContain(copy.send);
      expect(document.querySelector("#ai-prompt").placeholder).toBe(copy.placeholder);
      expect(document.querySelector("#ai-new-session").getAttribute("aria-label")).toBe(copy.aria);
      expect(document.querySelector("#ai-proposal-card h3").textContent).toBe(t("aiChat.proposal.title"));
      expect(document.querySelector(".ai-auto-apply-note").textContent).toBe(t("aiChat.proposal.autoApply"));
      expect(document.querySelector("#ai-undo-revision").getAttribute("aria-label")).toBe(t("aiChat.undo"));
      expect(document.querySelector("#ai-redo-revision").getAttribute("aria-label")).toBe(t("aiChat.redo"));
      expect(document.querySelector("#ai-delete-session").title).toBe(t("aiChat.deleteTitle"));
      expect(t("aiChat.prompt.widen")).toBe(copy.prompt);
      expect(t("aiChat.prompt.redPurchaseOrder")).toBeTruthy();
    }
  });

  it("translates known Chatbox validation and runtime errors in every locale", async () => {
    const errors = {
      "en-MY": "Choose OpenAI, Gemini or Custom LLM.",
      "zh-CN": "请选择 OpenAI、Gemini 或自定义 LLM。",
      "ms-MY": "Pilih OpenAI, Gemini atau LLM tersuai.",
      "ja-JP": "OpenAI、Gemini、またはカスタムLLMを選択してください。",
      "vi-VN": "Chọn OpenAI, Gemini hoặc LLM tùy chỉnh."
    };
    for (const [locale, expected] of Object.entries(errors)) {
      await setUiLocale(locale, document, false);
      expect(translateAgentError("Choose OpenAI, Gemini or Custom LLM.")).toBe(expected);
    }
    await setUiLocale("en-MY", document, false);
    expect(translateAgentError({ code: "TERMINAL_ACTION_REQUIRED", message: "The provider turn failed." }))
      .toBe("The provider did not execute a PrintForm action. Retry the design request.");
  });
});
