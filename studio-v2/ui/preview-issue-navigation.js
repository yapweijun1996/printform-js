function literal(value) {
  return JSON.stringify(value);
}

// This is injected into the sandboxed preview bridge. The parent cannot read
// the frame DOM, so navigation must be a revision-bound command handled by
// the same isolated page that produced the diagnostic.
export function buildPreviewIssueNavigation(revision, token) {
  const expectedRevision = literal(revision);
  const expectedToken = literal(token);
  return `
    if (data.type === "focus-issue") {
      if (data.revision !== ${expectedRevision} || data.token !== ${expectedToken}) return;
      var issue = data.issue && typeof data.issue === "object" ? data.issue : {};
      var pages = document.querySelectorAll(".printform_page");
      var pageIndex = Number.isInteger(issue.pageIndex) ? issue.pageIndex : Number(issue.page) - 1;
      var page = Number.isInteger(pageIndex) && pageIndex >= 0 ? pages[pageIndex] : null;
      var target = null;
      if (page && typeof issue.selector === "string" && issue.selector && issue.selector !== "unknown") {
        try { target = page.querySelector(issue.selector); } catch (error) { target = null; }
      }
      if (!target && page && typeof issue.componentId === "string" && issue.componentId) {
        var candidates = page.querySelectorAll("[data-pf-component-id], [data-pf-table-id], [id]");
        for (var index = 0; index < candidates.length; index += 1) {
          var candidate = candidates[index];
          if (candidate.getAttribute("data-pf-component-id") === issue.componentId
            || candidate.getAttribute("data-pf-table-id") === issue.componentId
            || candidate.id === issue.componentId) {
            target = candidate;
            break;
          }
        }
      }
      if (!target) return;
      clearSelection();
      target.setAttribute("data-pf-preview-selected", "true");
      target.style.outline = "2px solid #2457d6";
      target.style.outlineOffset = "-2px";
      if (typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      parent.postMessage({
        source: "printform-studio-v2-preview",
        type: "selection",
        revision: ${expectedRevision},
        token: ${expectedToken},
        payload: { componentId: target.getAttribute("data-pf-component-id") || issue.componentId || target.id || "", pageIndex: pageIndex }
      }, "*");
      return;
    }
`;
}
