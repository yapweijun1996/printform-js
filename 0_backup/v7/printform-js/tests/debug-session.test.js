import { describe, it, expect, vi } from "vitest";

import { createPrintformDebugSession } from "../js/printform/debug.js";

describe("createPrintformDebugSession", () => {
  it("captures console logs and appends a copy panel", () => {
    const formEl = document.createElement("div");
    formEl.className = "printform";
    document.body.appendChild(formEl);

    const output = document.createElement("div");
    document.body.appendChild(output);

    const originalConsole = window.console;
    const fakeConsole = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    window.console = fakeConsole;

    try {
      const session = createPrintformDebugSession({
        enabled: true,
        formEl,
        config: { papersizeWidth: 750, papersizeHeight: 1050, dpi: 96 }
      });

      session.install();
      window.console.log("[printform] hello");
      window.console.warn("[printform] warn");
      session.markEnd({ pageCount: 2 });
      session.appendPanel(output, { pageCount: 2 });
      session.uninstall();

      const panel = output.querySelector('[data-printform-debug-panel="true"]');
      expect(panel).toBeTruthy();
      expect(panel.textContent).toContain("Copy all logs");
      expect(panel.textContent).toContain("hello");
      expect(panel.textContent).toContain("DEBUG SESSION END");
      expect(session.getText()).toContain("warn");
    } finally {
      window.console = originalConsole;
      formEl.remove();
      output.remove();
    }
  });
});

