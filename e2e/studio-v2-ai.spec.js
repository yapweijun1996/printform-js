import { expect, test } from "@playwright/test";
import { openEditor, openInspector } from "./studio-v2-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("loads the embedded agrun Designer skill and keeps BYOK ciphertext secret", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "The browser storage smoke runs once in Chromium");
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();
  await expect(page.locator("#ai-designer-tabpanel")).toBeVisible();
  const result = await page.evaluate(async () => {
    const { DesignerRuntimeController } = await import("/studio-v2/ui/agent-runtime.js");
    const { AgentSessionManager } = await import("/studio-v2/ui/agent-sessions.js");
    const { ByokVault } = await import("/studio-v2/ui/agent-vault.js");
    const sessions = new AgentSessionManager({ realData: true });
    const session = await sessions.create("Runtime smoke");
    const controller = await DesignerRuntimeController.create({
      Agrun: window.Agrun,
      gateway: { execute: async () => ({ ok: true, result: {} }) },
      sessionManager: sessions,
      sessionId: session.id,
      profile: { id: "smoke", provider: "openai", model: "gpt-smoke", apiKey: "memory-only", inputPricePer1M: "0.15", outputPricePer1M: "0.60", maxCostUsd: "2" },
      onProposal: () => {},
      onEvent: () => {}
    });
    const dbName = `vault-e2e-${crypto.randomUUID()}`;
    const vault = new ByokVault({ dbName });
    await vault.unlock("correct horse battery staple");
    await vault.saveProfile({ id: "smoke-profile", provider: "openai", model: "gpt-smoke", apiKey: "TOPSECRET-E2E-KEY" });
    const ciphertext = JSON.stringify(await vault.readAll());
    vault.lock();
    let wrongCode = null;
    try { await vault.unlock("wrong passphrase 123"); } catch (error) { wrongCode = error.code; }
    await vault.clear();
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content;
    const scriptPolicy = csp.match(/script-src[^;]*/)?.[0] || "";
    return {
      agrun: Boolean(window.Agrun),
      skillNames: controller.runtime.getAgentSkills().map((skill) => skill.name),
      ciphertextHidesKey: !ciphertext.includes("TOPSECRET-E2E-KEY"),
      wrongCode,
      cspBlocksInlineScript: !scriptPolicy.includes("unsafe-inline")
    };
  });
  expect(result.agrun).toBe(true);
  expect(result.skillNames).toContain("printform-designer");
  expect(result.ciphertextHidesKey).toBe(true);
  expect(result.wrongCode).toBe("VAULT_UNLOCK_FAILED");
  expect(result.cspBlocksInlineScript).toBe(true);
  await page.locator("#ai-settings-button").click();
  await page.locator("#ai-settings-tab-vault").click();
  await expect(page.locator("#ai-clear-vault")).toBeVisible();
  await expect(page.getByLabel("Vault passphrase")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await expect(page.getByLabel("AI design request", { exact: true })).toBeVisible();
});

test("keeps the AI Designer panel inside a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator("#inspector-toggle").click();
  await expect(page.locator("#inspector-toggle")).toHaveAttribute("aria-expanded", "true");
  await page.locator("#ai-designer-tab").click();
  await page.locator("#ai-settings-button").click();
  await expect(page.locator("#ai-provider-details")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Provider settings" })).toBeVisible();
  await expect(page.locator(".ai-settings-sidebar")).toHaveAttribute("aria-orientation", "horizontal");
  await page.locator("#ai-settings-tab-provider").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#ai-settings-tab-vault")).toBeFocused();
  const dimensions = await page.evaluate(() => {
    const rect = document.querySelector(".ai-settings-dialog").getBoundingClientRect();
    return { scroll: document.documentElement.scrollWidth, overflowY: getComputedStyle(document.documentElement).overflowY, viewport: window.innerWidth, dialog: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, viewportHeight: innerHeight };
  });
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.overflowY).toBe("hidden");
  expect(dimensions.dialog.x).toBeCloseTo(0, 0);
  expect(dimensions.dialog.y).toBeCloseTo(0, 0);
  expect(dimensions.dialog.width).toBeCloseTo(dimensions.viewport, 0);
  expect(dimensions.dialog.height).toBeCloseTo(dimensions.viewportHeight, 0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#ai-provider-details")).toBeHidden();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe("auto");
  await expect(page.locator("#inspector-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#ai-settings-button")).toBeFocused();
  await expect(page.locator("#ai-prompt")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#inspector-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#ai-designer-tabpanel")).toBeHidden();
});

test("keeps the tablet workspace flush with the viewport below dynamic banners", async ({ page }) => {
  await page.setViewportSize({ width: 995, height: 778 });
  await openEditor(page);
  await page.locator("#update-banner").evaluate((node) => node.classList.remove("hidden"));
  const layout = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const rect = (selector) => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height };
    };
    return {
      viewportHeight: innerHeight,
      scrollY,
      bodyOverflow: getComputedStyle(document.body).overflowY,
      editorScrollable: document.querySelector(".editor-panel").scrollHeight > document.querySelector(".editor-panel").clientHeight,
      topbar: rect(".topbar"),
      banner: rect("#update-banner"),
      workspace: rect(".workspace")
    };
  });
  expect(layout.scrollY).toBe(0);
  expect(layout.bodyOverflow).toBe("hidden");
  expect(layout.editorScrollable).toBe(true);
  expect(layout.workspace.top).toBeCloseTo(layout.banner.bottom, 0);
  expect(layout.workspace.bottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.workspace.height).toBeGreaterThan(0);
});

test("keeps the stacked mobile Studio vertically scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openEditor(page);
  const mobile = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    return {
      scrollY,
      bodyPosition: getComputedStyle(document.body).position,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: innerHeight
    };
  });
  expect(mobile.bodyPosition).toBe("static");
  expect(mobile.scrollHeight).toBeGreaterThan(mobile.viewportHeight);
  expect(mobile.scrollY).toBeGreaterThan(0);
});

test("presents a chat-first AI Designer with provider setup tucked away", async ({ page }) => {
  await page.setViewportSize({ width: 995, height: 778 });
  await page.locator("#inspector-toggle").click();
  await page.locator("#ai-designer-tab").click();

  await expect(page.getByText("PrintForm Designer", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Design your print form" })).toBeVisible();
  await expect(page.locator("#ai-provider-details")).toBeHidden();
  await expect(page.locator("#ai-settings-button")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#ai-undo-revision")).toBeVisible();
  await expect(page.locator("#ai-redo-revision")).toBeVisible();
  await expect(page.locator("#ai-undo-revision")).toBeDisabled();
  await expect(page.locator("#ai-redo-revision")).toBeDisabled();
  await expect(page.locator("#ai-apply-proposal, #ai-reject-proposal")).toHaveCount(0);

  await page.getByRole("button", { name: "Widen Description" }).click();
  await expect(page.locator("#ai-prompt")).toHaveValue(/Description column wider/);
  await expect(page.locator("#ai-prompt")).toBeFocused();

  await page.getByRole("button", { name: "Red Purchase Order" }).click();
  await expect(page.locator("#ai-prompt")).toHaveValue(/professional red Purchase Order/);

  await page.locator("#ai-settings-button").click();
  await expect(page.locator("#ai-provider-details")).toBeVisible();
  await expect(page.locator("#ai-settings-button")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("tab", { name: /Provider/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ai-profile-id")).toHaveValue("own-gpt-server");
  await expect(page.locator("#ai-provider")).toHaveValue("openai");
  await expect(page.locator("#ai-model")).toHaveValue("gpt-5.4-mini");
  await expect(page.locator("#ai-api-variant")).toHaveValue("responses");
  await expect(page.locator("#ai-endpoint")).toHaveValue("https://gpt.yapweijun1996.com/v1");
  await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await page.locator("#ai-settings-cancel").click();
  await expect(page.locator("#ai-settings-button")).toBeFocused();
  expect(await page.locator(".workspace").evaluate((node) => node.inert)).toBe(false);
  await page.locator("#ai-open-settings").click();
  await expect(page.getByRole("tab", { name: /Provider/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#ai-model")).toBeFocused();
  await page.locator("#ai-settings-close").click();

  await expect(page.locator("#ai-status")).toContainText("Built-in Gateway ready");

  await page.locator("#ai-new-session").click();
  await expect(page.locator("#ai-session-select")).not.toHaveValue("");
  await expect(page.locator("#ai-delete-session")).toBeEnabled();
  await expect(page.locator("#ai-chat-log")).toContainText("New design chat.");
});

test("provides an accessible provider settings modal shell", async ({ page }) => {
  await page.setViewportSize({ width: 995, height: 778 });
  await page.locator("#inspector-toggle").click();
  await page.locator("#ai-designer-tab").click();
  await page.locator("#ai-settings-button").click();

  const dialog = page.getByRole("dialog", { name: "Provider settings" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".ai-settings-topbar")).toBeVisible();
  await expect(dialog.locator(".ai-settings-sidebar")).toBeVisible();
  await expect(dialog.locator(".ai-settings-content")).toBeVisible();
  await expect(dialog.locator(".ai-settings-footer")).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  expect(await page.locator(".workspace").evaluate((node) => node.inert)).toBe(true);
  await expect(page.locator("#ai-settings-panel-provider")).toBeVisible();
  await expect(page.locator("#ai-settings-panel-vault")).toBeHidden();

  await page.locator("#ai-settings-close").focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#ai-save-profile")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#ai-settings-close")).toBeFocused();

  const providerTab = page.locator("#ai-settings-tab-provider");
  await providerTab.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#ai-settings-tab-vault")).toBeFocused();
  await expect(page.locator("#ai-settings-panel-provider")).toBeHidden();
  await expect(page.locator("#ai-settings-panel-vault")).toBeVisible();

  await page.locator("#ai-save-profile").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("#ai-settings-close")).toBeFocused();
});

test("localizes provider settings modal across all supported languages", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Locale modal smoke runs once in Chromium");
  await page.setViewportSize({ width: 995, height: 778 });
  await page.locator("#inspector-toggle").click();
  await page.locator("#ai-designer-tab").click();
  await page.locator("#ai-settings-button").click();

  const expected = {
    "en-MY": { title: "Provider settings", save: "Save changes", provider: "Provider", navLabel: "Provider setting sections", profileState: "Default gateway: gpt-5.4-mini · built-in public credential", status: "Built-in Gateway ready · server abuse controls apply." },
    "zh-CN": { title: "提供商设置", save: "保存更改", provider: "提供商", navLabel: "提供商设置分区", profileState: "默认 Gateway：gpt-5.4-mini · 内置公开凭证", status: "内置 Gateway 已就绪 · 服务端滥用控制生效。" },
    "ms-MY": { title: "Tetapan pembekal", save: "Simpan perubahan", provider: "Pembekal", navLabel: "Bahagian tetapan pembekal", profileState: "Gateway lalai: gpt-5.4-mini · kelayakan awam terbina dalam", status: "Gateway terbina dalam sedia · kawalan penyalahgunaan pelayan berkuat kuasa." },
    "ja-JP": { title: "プロバイダー設定", save: "変更を保存", provider: "プロバイダー", navLabel: "プロバイダー設定セクション", profileState: "既定ゲートウェイ：gpt-5.4-mini · 組み込み公開認証情報", status: "組み込みGatewayは準備完了です。サーバー側の不正利用対策が適用されます。" },
    "vi-VN": { title: "Cài đặt nhà cung cấp", save: "Lưu thay đổi", provider: "Nhà cung cấp", navLabel: "Các mục cài đặt nhà cung cấp", profileState: "Gateway mặc định: gpt-5.4-mini · thông tin công khai tích hợp", status: "Gateway tích hợp đã sẵn sàng · áp dụng kiểm soát lạm dụng phía máy chủ." }
  };

  for (const [locale, copy] of Object.entries(expected)) {
    await page.locator("#ui-locale-select").selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("#ai-settings-title")).toHaveText(copy.title);
    await expect(page.locator("#ai-save-profile")).toHaveText(copy.save);
    await expect(page.locator("#ai-settings-tab-provider strong")).toHaveText(copy.provider);
    await expect(page.locator(".ai-settings-sidebar")).toHaveAttribute("aria-label", copy.navLabel);
    await expect(page.locator("#ai-profile-select option")).toHaveText(copy.profileState);
    await expect(page.locator("#ai-status")).toHaveText(copy.status);
  }

  await page.locator("#ai-settings-tab-vault").click();
  await expect(page.locator("#ai-vault-passphrase")).toHaveAttribute("placeholder", "12 ký tự trở lên");
});

test("closes and reopens the inspector from the visible panel control", async ({ page }) => {
  await page.setViewportSize({ width: 995, height: 778 });
  await page.locator("#inspector-toggle").click();
  await expect(page.locator("#inspector-close")).toBeVisible();
  await expect(page.locator("#inspector-close")).toBeFocused();
  await page.locator("#inspector-close").click();
  await expect(page.locator("#inspector-panel")).toHaveClass(/is-closed/);
  await expect(page.locator("#inspector-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#inspector-toggle")).toBeFocused();
  await page.locator("#inspector-toggle").click();
  await expect(page.locator("#inspector-panel")).toBeVisible();
  await expect(page.locator("#inspector-toggle")).toHaveAttribute("aria-expanded", "true");
});

test("lets users hide and reopen the structured source editor while using AI Designer", async ({ page }) => {
  await page.setViewportSize({ width: 995, height: 778 });
  await openEditor(page);
  await expect(page.locator("#editor-panel")).toBeVisible();
  await expect(page.locator("#editor-panel")).toHaveAttribute("aria-hidden", "false");
  await page.locator("#editor-panel-close").click();
  await expect(page.locator("#editor-panel")).toHaveClass(/is-closed/);
  await expect(page.locator("#editor-panel")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("#editor-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#editor-toggle")).toHaveText(/Show source/);
  await expect(page.locator("#editor-toggle")).toBeFocused();
  await page.locator("#editor-toggle").click();
  await expect(page.locator("#editor-panel")).toBeVisible();
  await expect(page.locator("#editor-panel")).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#editor-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#editor-panel-close")).toBeFocused();
});
