// Side-by-side line diff for the "Apply source edit" confirmation panel.
// Classic LCS-based line alignment (same idea GitHub's split diff view
// uses) — O(m*n) in line count, which is fine for template/CSS/manifest
// sections (typically well under 1,000 lines). A large section (e.g. the
// 500-row sample-data scenario) is skipped to avoid an O(m*n) blow-up on a
// UI thread; the caller still sees full before/after text, just unhighlighted.
const MAX_DIFF_LINES = 1500;

export function diffLines(before, after) {
  const a = String(before ?? "").split("\n");
  const b = String(after ?? "").split("\n");
  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    return {
      left: a.map((text) => ({ text, type: "same" })),
      right: b.map((text) => ({ text, type: "same" })),
      truncated: true
    };
  }
  const m = a.length;
  const n = b.length;
  const lcs = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const left = [];
  const right = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      left.push({ text: a[i], type: "same" });
      right.push({ text: b[j], type: "same" });
      i += 1; j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      left.push({ text: a[i], type: "removed" });
      i += 1;
    } else {
      right.push({ text: b[j], type: "added" });
      j += 1;
    }
  }
  while (i < m) { left.push({ text: a[i], type: "removed" }); i += 1; }
  while (j < n) { right.push({ text: b[j], type: "added" }); j += 1; }
  return { left, right, truncated: false };
}

function renderPane(lines) {
  const pane = document.createElement("div");
  pane.className = "diff-pane";
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = `diff-line diff-line-${line.type}`;
    row.textContent = line.text.length ? line.text : " ";
    pane.appendChild(row);
  });
  return pane;
}

// sections: [{ key, label, before, after, isTrust }]
export function renderDiffSections(container, sections) {
  container.replaceChildren();
  sections.forEach((section) => {
    const block = document.createElement("section");
    block.className = "diff-section";

    const heading = document.createElement("h3");
    heading.textContent = section.label;
    block.appendChild(heading);

    if (section.isTrust) {
      const note = document.createElement("p");
      note.className = "diff-trust-note";
      note.textContent = `${section.before} → ${section.after}`;
      block.appendChild(note);
      container.appendChild(block);
      return;
    }

    const { left, right, truncated } = diffLines(section.before, section.after);
    if (truncated) {
      const note = document.createElement("p");
      note.className = "diff-truncated-note";
      note.textContent = section.truncatedLabel;
      block.appendChild(note);
    }
    const columns = document.createElement("div");
    columns.className = "diff-columns";
    columns.appendChild(renderPane(left));
    columns.appendChild(renderPane(right));
    block.appendChild(columns);
    container.appendChild(block);
  });
}
