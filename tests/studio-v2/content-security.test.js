import { describe, expect, it } from "vitest";
import { validateTrustedContent } from "../../studio-v2/core/content-security.js";
import { applyOperations } from "../../studio-v2/core/operations.js";
import { createEmptyProject } from "../../studio-v2/core/project-model.js";
import { validateProject } from "../../studio-v2/core/acceptance.js";

describe("trusted print artifact content security", () => {
  it("rejects dangerous tags, event handlers and javascript URLs", () => {
    const project = createEmptyProject();
    project.templateHtml = '<div class="printform" onclick="evil()"><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)">bad</a></div>';
    const report = validateTrustedContent(project);
    expect(report.valid).toBe(false);
    expect(report.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "DANGEROUS_TAG_BLOCKED", "EVENT_HANDLER_BLOCKED", "JAVASCRIPT_URL_BLOCKED",
    ]));
    expect(validateProject(project).valid).toBe(false);
  });

  it("rejects unsafe attributes before they enter a candidate project", () => {
    const project = createEmptyProject();
    expect(() => applyOperations(project, [{
      type: "set_attribute", selector: ".printform", name: "onclick", value: "evil()",
    }])).toThrowError(expect.objectContaining({ code: "EVENT_HANDLER_BLOCKED" }));
  });

  it("allows an explicitly trusted HTTPS asset but records external network use", () => {
    const project = createEmptyProject();
    project.manifest.assets = { allowExternalHttps: true };
    project.templateHtml = '<div class="printform"><img src="https://assets.example/logo.png" alt="Logo"></div>';
    expect(validateTrustedContent(project).valid).toBe(true);
    expect(validateTrustedContent(project).externalNetwork).toBe(true);
  });
});
