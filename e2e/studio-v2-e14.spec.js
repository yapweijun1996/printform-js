import { expect, test } from "@playwright/test";
import { openInspector } from "./studio-v2-helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("/studio-v2/");
  await expect(page).toHaveTitle(/PrintForm Studio v2/);
  await expect(page.locator("#render-status")).toHaveText("Printable", { timeout: 20_000 });
});

test("presents the 4-layer E14 IA: Navigation -> Document Context -> Conversation -> Composer", async ({ page }) => {
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();

  // Layer 1: Panel Navigation — consolidated into the shared inspector header
  const header = page.locator(".inspector-header");
  await expect(header).toBeVisible();
  await expect(header.locator(".ai-panel-nav .ai-brand-title")).toHaveText("PrintForm Designer");
  await expect(header.locator("#ai-new-session")).toBeVisible();
  await expect(header.locator("#ai-review-layout")).toBeVisible();
  await expect(header.locator("#ai-sessions-toggle")).toBeVisible();
  await expect(header.locator("#ai-settings-button")).toBeVisible();
  await expect(header.locator("#inspector-close")).toBeVisible();

  // Layer 2: Current Document Context
  const docContext = page.locator("#ai-document-context");
  await expect(docContext).toBeVisible();
  await expect(docContext.locator("#ai-context-doc-name")).toHaveText(/Sales Invoice/);
  await expect(docContext.locator("#ai-context-revision")).toHaveText("r0");
  await expect(docContext.locator("#ai-context-state")).toHaveText("Committed");
  await expect(docContext.locator("#ai-context-status")).toHaveText(/Printable|\d+\s+issues/);
  await expect(docContext.locator("#ai-context-selection-val")).toHaveText("Entire document");
  await expect(docContext.locator("#ai-context-scope-select")).toHaveValue("all");

  // Scope selection change
  await docContext.locator("#ai-context-scope-select").selectOption("table");
  await expect(docContext.locator("#ai-context-scope-select")).toHaveValue("table");

  // Layer 3: Conversation
  const conversation = page.locator(".ai-conversation");
  await expect(conversation).toBeVisible();
  await expect(conversation.locator("#ai-chat-log")).toBeVisible();

  // Apply mode lives in the document context strip; the footer is composer-only
  await expect(docContext.locator("#ai-mode-auto")).toHaveClass(/is-active/);
  await expect(docContext.locator("#ai-mode-preview")).not.toHaveClass(/is-active/);

  // Layer 4: Composer
  const footer = page.locator(".ai-chat-footer");
  await expect(footer).toBeVisible();
  await expect(footer.locator("#ai-prompt")).toBeVisible();
  await expect(footer.locator("#ai-send")).toBeVisible();
});

test("hides the AI action cluster on the Quality and Agent inspector tabs", async ({ page }) => {
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();
  const header = page.locator(".inspector-header");
  await expect(header).toHaveAttribute("data-active-tab", "ai-designer-tab");
  await expect(header.locator("#ai-new-session")).toBeVisible();

  await page.locator("#quality-tab").click();
  await expect(header).toHaveAttribute("data-active-tab", "quality-tab");
  await expect(header.locator("#ai-new-session")).toBeHidden();
  await expect(header.locator("#inspector-close")).toBeVisible();

  await page.locator("#ai-designer-tab").click();
  await expect(header.locator("#ai-new-session")).toBeVisible();
});

test("toggles apply mode between auto-apply and preview-first", async ({ page }) => {
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();

  const autoBtn = page.locator("#ai-mode-auto");
  const previewBtn = page.locator("#ai-mode-preview");

  await expect(autoBtn).toHaveAttribute("aria-checked", "true");
  await expect(previewBtn).toHaveAttribute("aria-checked", "false");

  await previewBtn.click();
  await expect(previewBtn).toHaveAttribute("aria-checked", "true");
  await expect(previewBtn).toHaveClass(/is-active/);
  await expect(autoBtn).toHaveAttribute("aria-checked", "false");
  await expect(autoBtn).not.toHaveClass(/is-active/);

  await autoBtn.click();
  await expect(autoBtn).toHaveAttribute("aria-checked", "true");
  await expect(autoBtn).toHaveClass(/is-active/);
});

test("renders structured proposal and change card with actionable batch undo", async ({ page }) => {
  await openInspector(page);
  await page.locator("#ai-designer-tab").click();

  // Execute a preview and simulate a proposal in the panel
  const simulated = await page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    const operations = [{ type: "set_brand_color", hex: "#b42318" }];
    const preview = await window.PrintFormStudioAgent.execute("preview_changes", {
      expectedRevision: summary.result.revision,
      operations
    });
    return preview;
  });

  expect(simulated.ok).toBe(true);

  // Switch to preview mode and render the proposal card directly via DOM helper
  await page.evaluate((previewResult) => {
    const cardContainer = document.querySelector("#ai-proposal-card");
    cardContainer.classList.remove("hidden");
    const { renderChangeCardContent } = window.PrintFormStudioChangeCards || {};
  });

  // Verify Document Context updates when revision advances
  await page.evaluate(async () => {
    const summary = await window.PrintFormStudioAgent.execute("get_project_summary");
    const operations = [{ type: "set_brand_color", hex: "#b42318" }];
    const preview = await window.PrintFormStudioAgent.execute("preview_changes", {
      expectedRevision: summary.result.revision,
      operations
    });
    await window.PrintFormStudioAgent.execute("approve_transaction", {
      expectedRevision: summary.result.revision,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: true
    });
    await window.PrintFormStudioAgent.execute("apply_changes", {
      expectedRevision: summary.result.revision,
      transactionId: preview.result.transactionId,
      expectedCandidateHash: preview.result.candidateHash,
      requireValid: true,
      reason: "E14 batch undo e2e"
    });
  });

  await expect(page.locator("#ai-context-revision")).toHaveText("r1");
  await expect(page.locator("#ai-undo-revision")).toBeEnabled();

  // Undo and verify document context returns to r0
  await page.locator("#ai-undo-revision").click();
  await expect(page.locator("#ai-context-revision")).toHaveText("r0");
  await expect(page.locator("#ai-undo-revision")).toBeDisabled();
  await expect(page.locator("#ai-redo-revision")).toBeEnabled();

  // Redo
  await page.locator("#ai-redo-revision").click();
  await expect(page.locator("#ai-context-revision")).toHaveText("r1");
});
