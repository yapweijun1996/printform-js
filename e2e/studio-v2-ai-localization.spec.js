import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("localizes the complete AI Chatbox across all supported languages", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "AI Chatbox locale smoke runs once in Chromium");
  await page.setViewportSize({ width: 995, height: 778 });
  await page.locator("#inspector-toggle").click();
  await page.locator("#ai-designer-tab").click();

  const expected = {
    "en-MY": { title: "Design your print form", description: "Ask for visual or structural changes. Safe changes are validated and applied automatically; use Undo or Redo when needed.", sessionLabel: "AI chat session", suggestion: "Widen Description", prompt: "Make the Description column wider and keep the table within the page.", placeholder: "Ask AI to redesign this print form…", newMessage: "New design chat." },
    "zh-CN": { title: "设计你的打印表单", description: "告诉 AI 你想要的视觉或结构调整。安全改动会自动验证并应用；需要时可使用撤销或重做。", sessionLabel: "AI 聊天会话", suggestion: "加宽描述列", prompt: "加宽 Description 列，并确保表格仍在页面范围内。", placeholder: "让 AI 重新设计这个打印表单…", newMessage: "新建设计聊天。" },
    "ms-MY": { title: "Reka bentuk borang cetakan anda", description: "Minta perubahan visual atau struktur. Perubahan selamat disahkan dan digunakan secara automatik; gunakan Buat asal atau Buat semula jika perlu.", sessionLabel: "Sesi sembang AI", suggestion: "Lebarkan Description", prompt: "Lebarkan lajur Description dan pastikan jadual kekal dalam halaman.", placeholder: "Minta AI mereka bentuk semula borang cetakan ini…", newMessage: "Sembang reka bentuk baharu." },
    "ja-JP": { title: "印刷フォームをデザイン", description: "見た目や構造の変更を依頼できます。安全な変更は検証後に自動適用され、必要に応じて元に戻す・やり直すことができます。", sessionLabel: "AIチャットセッション", suggestion: "Description列を広げる", prompt: "Description列を広げ、表がページ内に収まるようにしてください。", placeholder: "AIに印刷フォームの再デザインを依頼…", newMessage: "新しいデザインチャット。" },
    "vi-VN": { title: "Thiết kế biểu mẫu in của bạn", description: "Yêu cầu thay đổi về hình thức hoặc cấu trúc. Các thay đổi an toàn sẽ được xác thực và áp dụng tự động; bạn có thể Hoàn tác hoặc Làm lại khi cần.", sessionLabel: "Phiên trò chuyện AI", suggestion: "Mở rộng cột Description", prompt: "Mở rộng cột Description và giữ bảng nằm trong trang.", placeholder: "Yêu cầu AI thiết kế lại biểu mẫu in này…", newMessage: "Cuộc trò chuyện thiết kế mới." }
  };

  for (const [locale, copy] of Object.entries(expected)) {
    await page.locator("#ui-locale-select").selectOption(locale);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("#ai-welcome-title")).toHaveText(copy.title);
    await expect(page.locator(".ai-chat-welcome p")).toHaveText(copy.description);
    await expect(page.locator("#ai-prompt")).toHaveAttribute("placeholder", copy.placeholder);
    await expect(page.locator("#ai-session-select")).toHaveAttribute("aria-label", copy.sessionLabel);
    await page.getByRole("button", { name: copy.suggestion, exact: true }).click();
    await expect(page.locator("#ai-prompt")).toHaveValue(copy.prompt);
  }

  await page.locator("#ai-settings-button").click();
  await page.locator("#ai-settings-tab-vault").click();
  await page.locator("#ai-vault-passphrase").fill("short");
  await page.locator("#ai-unlock-vault").click();
  await expect(page.locator("#ai-status")).toHaveText("Cụm mật khẩu phải có ít nhất 12 ký tự.");
  await page.locator("#ui-locale-select").selectOption("ja-JP");
  await expect(page.locator("#ai-status")).toHaveText("パスフレーズは12文字以上必要です。");
  await page.locator("#ai-settings-close").click();
  await page.locator("#ui-locale-select").selectOption("vi-VN");
  await page.locator("#ai-new-session").click();
  await expect(page.locator("#ai-chat-log")).toContainText(expected["vi-VN"].newMessage);
});
