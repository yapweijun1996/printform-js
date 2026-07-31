import { describe, it, expect } from "vitest";
import { diffLines } from "../../studio-v2/ui/diff-view.js";

describe("diffLines", () => {
  it("marks every line as unchanged when before and after are identical", () => {
    const { left, right, truncated } = diffLines("a\nb\nc", "a\nb\nc");
    expect(truncated).toBe(false);
    expect(left.every((line) => line.type === "same")).toBe(true);
    expect(right.every((line) => line.type === "same")).toBe(true);
    expect(left.map((l) => l.text)).toEqual(["a", "b", "c"]);
  });

  it("marks appended lines as added on the right, unchanged lines as same on both", () => {
    const { left, right } = diffLines("a\nb", "a\nb\nc");
    expect(left.map((l) => l.type)).toEqual(["same", "same"]);
    expect(right.map((l) => [l.text, l.type])).toEqual([["a", "same"], ["b", "same"], ["c", "added"]]);
  });

  it("marks removed lines as removed on the left only", () => {
    const { left, right } = diffLines("a\nb\nc", "a\nc");
    expect(left.map((l) => [l.text, l.type])).toEqual([["a", "same"], ["b", "removed"], ["c", "same"]]);
    expect(right.map((l) => l.type)).toEqual(["same", "same"]);
  });

  it("aligns a single-line replacement as one removal and one addition, not a same-line match", () => {
    const { left, right } = diffLines("Title: Old", "Title: New");
    expect(left).toEqual([{ text: "Title: Old", type: "removed" }]);
    expect(right).toEqual([{ text: "Title: New", type: "added" }]);
  });

  it("flags truncated instead of computing an O(m*n) diff for very large inputs", () => {
    const huge = Array.from({ length: 2000 }, (_, i) => `line ${i}`).join("\n");
    const { truncated, left, right } = diffLines(huge, huge);
    expect(truncated).toBe(true);
    expect(left).toHaveLength(2000);
    expect(right).toHaveLength(2000);
    expect(left.every((line) => line.type === "same")).toBe(true);
  });

  it("treats missing before/after as an empty string rather than throwing", () => {
    expect(() => diffLines(undefined, "a")).not.toThrow();
    expect(() => diffLines("a", null)).not.toThrow();
  });
});
