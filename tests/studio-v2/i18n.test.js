import { describe, expect, it } from "vitest";
import { bindTemplate } from "../../studio-v2/core/binding.js";
import { validateI18n } from "../../studio-v2/core/i18n.js";
import { createSalesInvoiceProject } from "../../studio-v2/samples/sales-invoice.js";

describe("PrintForm five-language profile", () => {
  it("requires every template key in all declared locales", () => {
    const project = createSalesInvoiceProject();
    expect(validateI18n(project)).toMatchObject({ valid: true, locales: ["en-MY", "zh-CN", "ms-MY", "ja-JP", "vi-VN"] });
    delete project.i18n["ja-JP"]["invoice.title"];
    const result = validateI18n(project);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "I18N_KEY_MISSING", path: "/i18n/ja-JP/invoice.title" }));
  });

  it("renders translated labels as escaped text", () => {
    const template = document.createElement("template");
    template.innerHTML = '<p data-pf-i18n="title"></p>';
    const result = bindTemplate(template, {}, { locale: "zh-CN", i18n: { fallbackLocale: "en-MY" } }, { i18n: { "zh-CN": { title: "<采购订单>" } } });
    expect(result.fragment.querySelector("p").textContent).toBe("<采购订单>");
    expect(result.fragment.querySelector("script")).toBeNull();
  });
});
