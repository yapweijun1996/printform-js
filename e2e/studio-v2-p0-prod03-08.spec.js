import { expect, test } from "@playwright/test";
import { admitPublicGateway, openInspector, passLayoutReview } from "./studio-v2-helpers.js";

test.describe.configure({ timeout: 180_000 });

const LOCALES = {
  "en-MY": { exportProduction: "Production export", exportReady: "● Ready", exportBlocked: "⚠ Blocked", saveSaved: "Saved", reviewPending: "Pending", reviewPass: "Passed · Revision {revision}", contextCommitted: "Committed", contextBlocked: "Blocked", contextIssues: "{count} issues", qualityBlocked: "Blocked · {count} errors", qualityPass: "Production quality gate passed · {count} notices", rendering: "Rendering", ready: "Printable", waiting: "Waiting to render" },
  "zh-CN": { exportProduction: "生产导出", exportReady: "● 就绪", exportBlocked: "⚠ 已阻断", saveSaved: "已保存", reviewPending: "待完成", reviewPass: "通过 · Revision {revision}", contextCommitted: "已提交", contextBlocked: "存在阻断", contextIssues: "{count} 项问题", qualityBlocked: "已阻断 · {count} 项错误", qualityPass: "生产质量门通过 · {count} 项提醒", rendering: "渲染中", ready: "可打印", waiting: "等待渲染" },
  "ms-MY": { exportProduction: "Eksport produksi", exportReady: "● Sedia", exportBlocked: "⚠ Disekat", saveSaved: "Disimpan", reviewPending: "Belum selesai", reviewPass: "Lulus · Revisi {revision}", contextCommitted: "Komited", contextBlocked: "Disekat", contextIssues: "{count} isu", qualityBlocked: "Disekat · {count} ralat", qualityPass: "Gerbang kualiti produksi lulus · {count} peringatan", rendering: "Sedang merender", ready: "Boleh dicetak", waiting: "Menunggu render" },
  "ja-JP": { exportProduction: "本番エクスポート", exportReady: "● 準備完了", exportBlocked: "⚠ ブロック", saveSaved: "保存済み", reviewPending: "未完了", reviewPass: "合格・Revision {revision}", contextCommitted: "コミット済み", contextBlocked: "ブロック中", contextIssues: "{count} 件の問題", qualityBlocked: "ブロック済み・エラー{count}件", qualityPass: "本番品質ゲート合格・通知{count}件", rendering: "レンダー中", ready: "印刷可能", waiting: "レンダー待ち" },
  "vi-VN": { exportProduction: "Xuất bản sản xuất", exportReady: "● Sẵn sàng", exportBlocked: "⚠ Bị chặn", saveSaved: "Đã lưu", reviewPending: "Chưa hoàn tất", reviewPass: "Đạt · Phiên bản {revision}", contextCommitted: "Đã cam kết", contextBlocked: "Bị chặn", contextIssues: "{count} vấn đề", qualityBlocked: "Đã chặn · {count} lỗi", qualityPass: "Cổng chất lượng sản xuất đạt · {count} lưu ý", rendering: "Đang kết xuất", ready: "Có thể in", waiting: "Đang chờ kết xuất" }
};

async function readSurface(page) {
  return page.evaluate(async () => {
    const response = await window.PrintFormStudioAgent.execute("request_export");
    const text = (selector) => document.querySelector(selector)?.textContent.trim() || "";
    return {
      response,
      readiness: response.result,
      lang: document.documentElement.lang,
      render: text("#render-status"),
      quality: text("#quality-summary"),
      contextRevision: text("#ai-context-revision"),
      contextState: text("#ai-context-state"),
      contextStatus: text("#ai-context-status"),
      exportChip: text("#export-readiness"),
      exportButton: text("#export-button"),
      exportDisabled: document.querySelector("#export-button")?.disabled,
      reviewStatus: text("#review-status"),
      saveState: text("#save-state"),
      candidateBanner: !document.querySelector("#candidate-preview-banner")?.classList.contains("hidden")
    };
  });
}

function replaceCount(template, count) {
  return template.replace("{count}", String(count));
}

function replaceRevision(template, revision) {
  return template.replace("{revision}", String(revision));
}

function assertBlockedSurface(surface, copy, expectedRender) {
  expect(surface.response.ok).toBe(true);
  expect(surface.readiness.ready).toBe(false);
  expect(surface.readiness.validation.errors.map((item) => item.code)).toContain("LAYOUT_REVIEW_REQUIRED");
  expect(surface.render).toBe(expectedRender);
  expect(surface.quality).toBe(replaceCount(copy.qualityBlocked, surface.readiness.validation.errors.length));
  expect(surface.contextState).toBe(copy.contextCommitted);
  expect(surface.contextStatus).toBe(copy.contextBlocked);
  expect(surface.exportChip).toBe(copy.exportBlocked);
  expect(surface.exportButton).toBe(copy.exportProduction);
  expect(surface.exportDisabled).toBe(true);
  expect(surface.reviewStatus).toBe(copy.reviewPending);
  expect(surface.saveState).toBe(copy.saveSaved);
}

test.describe("Studio v2 PROD-03 03-08 surface agreement", () => {
  test("keeps context, Quality, actions and request_export aligned across state transitions and locales", async ({ page, browserName }) => {
    const pageErrors = [];
    const consoleErrors = [];
    const knownFirefoxAgrunCspDiagnostic = (message) => browserName === "firefox"
      && /Content-Security-Policy:[\s\S]*blocked a JavaScript eval[\s\S]*agrun\.min\.js/i.test(message);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

    await page.addInitScript(() => {
      const nativeSetTimeout = window.setTimeout.bind(window);
      const nativeClearTimeout = window.clearTimeout.bind(window);
      const held = [];
      const marker = 3_080_000;
      window.__p0Prod0308 = {
        releaseInitialPreview() { held.splice(0).forEach((callback) => callback()); },
        heldCount: () => held.length
      };
      window.setTimeout = (callback, delay, ...args) => {
        if (delay === 180 && typeof callback === "function") {
          held.push(() => callback(...args));
          return marker;
        }
        return nativeSetTimeout(callback, delay, ...args);
      };
      window.clearTimeout = (handle) => { if (handle !== marker) nativeClearTimeout(handle); };
    });

    await page.goto("/studio-v2/?sample=sales-invoice");
    await expect(page).toHaveTitle(/PrintForm Studio v2/);
    await expect.poll(() => page.evaluate(() => window.__p0Prod0308.heldCount())).toBeGreaterThan(0);
    await openInspector(page);
    await page.locator("#ai-designer-tab").click();
    await admitPublicGateway(page);

    const initial = await readSurface(page);
    expect(initial.lang).toBe("en-MY");
    expect(initial.readiness.validation.errors.map((item) => item.code)).toEqual(expect.arrayContaining(["PREVIEW_REQUIRED", "LAYOUT_REVIEW_REQUIRED"]));
    assertBlockedSurface(initial, LOCALES["en-MY"], LOCALES["en-MY"].rendering);

    await page.evaluate(() => window.__p0Prod0308.releaseInitialPreview());
    await expect(page.locator("#render-status")).toHaveText(LOCALES["en-MY"].ready, { timeout: 20_000 });
    const unreviewed = await readSurface(page);
    expect(unreviewed.readiness.validation.errors.map((item) => item.code)).not.toContain("PREVIEW_REQUIRED");
    assertBlockedSurface(unreviewed, LOCALES["en-MY"], LOCALES["en-MY"].ready);

    for (const [locale, copy] of Object.entries(LOCALES)) {
      await page.locator("#ui-locale-select").selectOption(locale);
      await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale);
      const localizedBlocked = await readSurface(page);
      expect(localizedBlocked.lang).toBe(locale);
      assertBlockedSurface(localizedBlocked, copy, copy.ready);
    }

    await page.locator("#ui-locale-select").selectOption("en-MY");
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("en-MY");
    const review = await passLayoutReview(page);
    expect(review.ok).toBe(true);
    await expect(page.locator("#render-status")).toHaveText(LOCALES["en-MY"].ready, { timeout: 20_000 });
    const ready = await readSurface(page);
    const warningCount = ready.readiness.validation.warnings.length;
    expect(warningCount).toBeGreaterThan(0);
    expect(ready.readiness).toMatchObject({ revision: 0, ready: true, requiresUserConfirmation: true });
    expect(ready.readiness.validation.errors).toEqual([]);
    expect(ready.render).toBe(LOCALES["en-MY"].ready);
    expect(ready.quality).toBe(replaceCount(LOCALES["en-MY"].qualityPass, warningCount));
    expect(ready.contextRevision).toBe("r0");
    expect(ready.contextState).toBe("Committed");
    expect(ready.contextStatus).toBe(replaceCount(LOCALES["en-MY"].contextIssues, warningCount));
    expect(ready.exportChip).toBe(LOCALES["en-MY"].exportReady);
    expect(ready.exportButton).toBe(LOCALES["en-MY"].exportProduction);
    expect(ready.exportDisabled).toBe(false);
    expect(ready.reviewStatus).toBe(replaceRevision(LOCALES["en-MY"].reviewPass, 0));
    expect(ready.saveState).toBe(LOCALES["en-MY"].saveSaved);

    for (const [locale, copy] of Object.entries(LOCALES)) {
      await page.locator("#ui-locale-select").selectOption(locale);
      await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale);
      const localizedReady = await readSurface(page);
      expect(localizedReady.lang).toBe(locale);
      expect(localizedReady.render).toBe(copy.ready);
      expect(localizedReady.quality).toBe(replaceCount(copy.qualityPass, warningCount));
      expect(localizedReady.contextStatus).toBe(replaceCount(copy.contextIssues, warningCount));
      expect(localizedReady.exportChip).toBe(copy.exportReady);
      expect(localizedReady.exportButton).toBe(copy.exportProduction);
      expect(localizedReady.exportDisabled).toBe(false);
      expect(localizedReady.reviewStatus).toBe(replaceRevision(copy.reviewPass, 0));
      expect(localizedReady.saveState).toBe(copy.saveSaved);
    }

    await page.locator("#ui-locale-select").selectOption("en-MY");
    await page.evaluate((expectedRevision) => {
      let runtimeOptions;
      const control = { runs: 0, actionCalls: [], downloadClicks: 0 };
      const originalAnchorClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        if (this.download) control.downloadClicks += 1;
        return originalAnchorClick.call(this);
      };
      const session = {
        getState: () => ({ cumulativeUsage: { totalTokens: 0 } }),
        runStream() {
          control.runs += 1;
          return (async function* () {
            const action = runtimeOptions.customActions.find((item) => item.name === "printform_preview_changes");
            if (!action) throw new Error("printform_preview_changes was not registered");
            control.actionCalls.push(action.name);
            await action.execute({}, { expectedRevision, operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
            yield { type: "completed", detail: { terminalKind: "done", result: { output: { text: "Surface agreement candidate" } } } };
          }());
        }
      };
      window.Agrun = {
        defineAction: (definition) => definition,
        createInMemorySessionStore: () => ({}),
        createRuntime: (options) => {
          runtimeOptions = options;
          return { createSession: async () => session, openSession: async () => session, getAgentSkills: () => [] };
        },
        openaiBrowserSkill: {},
        geminiBrowserSkill: {}
      };
      window.__p0Prod0308 = { ...window.__p0Prod0308, control };
    }, ready.readiness.revision);
    await page.locator("#ai-mode-preview").click();
    await page.locator("#ai-prompt").fill("Preview a warm amber brand colour");
    await page.locator("#ai-send").click();
    await expect(page.locator("#ai-reject-proposal")).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => page.evaluate(() => window.__p0Prod0308.control.runs)).toBe(1);
    const candidate = await readSurface(page);
    expect(candidate.candidateBanner).toBe(true);
    expect(candidate.contextState).toMatch(/Candidate/);
    expect(candidate.readiness).toMatchObject({ revision: 0, ready: true });
    expect(candidate.quality).toBe(replaceCount(LOCALES["en-MY"].qualityPass, warningCount));
    expect(candidate.exportChip).toBe(LOCALES["en-MY"].exportReady);
    expect(candidate.exportDisabled).toBe(false);
    expect(candidate.response.result.requiresUserConfirmation).toBe(true);
    expect(await page.evaluate(() => window.__p0Prod0308.control.downloadClicks)).toBe(0);

    await page.locator("#ai-reject-proposal").click();
    await expect(page.locator("#candidate-preview-banner")).toBeHidden();
    await expect(page.locator("#ai-context-state")).toHaveText("Committed");
    await expect(page.locator("#render-status")).toHaveText(LOCALES["en-MY"].ready, { timeout: 20_000 });
    await page.evaluate(() => { window.confirm = () => false; });
    await page.locator("#export-button").click();
    await expect(page.locator("#save-state")).toHaveText("Save cancelled");
    const cancelled = await readSurface(page);
    expect(cancelled.readiness.ready).toBe(true);
    expect(cancelled.exportChip).toBe(LOCALES["en-MY"].exportReady);
    expect(cancelled.exportDisabled).toBe(false);
    expect(await page.evaluate(() => window.__p0Prod0308.control.downloadClicks)).toBe(0);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors.filter((message) => !knownFirefoxAgrunCspDiagnostic(message))).toEqual([]);
    if (consoleErrors.some(knownFirefoxAgrunCspDiagnostic)) test.info().annotations.push({
      type: "known-browser-diagnostic",
      description: "Firefox reports the existing AGRUN CSP eval diagnostic; no functional page error was observed."
    });
  });
});
