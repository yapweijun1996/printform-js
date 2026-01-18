import { describe, it, expect } from "vitest";
import { splitParagraphIntoHtmlChunks } from "../js/printform/text.js";

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function parseChunk(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.querySelector("p");
}

describe("splitParagraphIntoHtmlChunks", () => {
  it("preserves inline tags when splitting inside them", () => {
    const paragraph = document.createElement("p");
    paragraph.innerHTML = "Alpha <strong>Bravo Charlie</strong> <span>Delta</span> <a href=\"#\">Echo Foxtrot</a> Golf";

    const chunks = splitParagraphIntoHtmlChunks(paragraph, 2);

    expect(chunks.length).toBe(4);

    const parsedChunks = chunks.map(parseChunk);
    parsedChunks.forEach(chunk => expect(chunk).not.toBeNull());

    const combined = normalizeText(parsedChunks.map(chunk => chunk.textContent || "").join(" "));
    expect(combined).toBe(normalizeText(paragraph.textContent || ""));

    expect(parsedChunks[0].querySelector("strong")).not.toBeNull();
    expect(parsedChunks[1].querySelector("strong")).not.toBeNull();
    expect(parsedChunks[1].querySelector("span")).not.toBeNull();
    expect(parsedChunks[2].querySelector("a")).not.toBeNull();
  });
});
