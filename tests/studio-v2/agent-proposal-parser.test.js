import { describe, expect, it } from "vitest";
import { parseTextProposal, TEXT_PROPOSAL_LIMITS } from "../../studio-v2/ui/agent-proposal-parser.js";

describe("provider text proposal recovery", () => {
  it("extracts one semantic operation from prose", () => {
    const result = parseTextProposal(`Semantic proposal (1):
      { "type": "set_brand_color", "hex": "#854d0e" }
      Preview is ready.`);
    expect(result).toEqual({ operations: [{ type: "set_brand_color", hex: "#854d0e" }] });
  });

  it("accepts an operations envelope and preserves a revision guard", () => {
    const result = parseTextProposal('```json\n{"expectedRevision":4,"operations":[{"type":"set_font_scale","basePt":9.5}]}\n```');
    expect(result).toEqual({ expectedRevision: 4, operations: [{ type: "set_font_scale", basePt: 9.5 }] });
  });

  it("accepts several safe semantic operations and ignores non-proposal JSON", () => {
    const result = parseTextProposal('Validation: {"valid":true}. Proposal: [{"type":"set_brand_color","hex":"#854d0e"},{"type":"set_column_widths","tableSelector":".items","widths":["8%","52%","20%","20%"]}]');
    expect(result?.operations).toEqual([
      { type: "set_brand_color", hex: "#854d0e" },
      { type: "set_column_widths", tableSelector: ".items", widths: ["8%", "52%", "20%", "20%"] }
    ]);
  });

  it("rejects invalid, unknown, and high-risk raw replacement operations", () => {
    expect(parseTextProposal('{"type":"set_brand_color","hex":"not-a-color"}')).toBeNull();
    expect(parseTextProposal('{"type":"invented_operation","value":true}')).toBeNull();
    expect(parseTextProposal('{"type":"replace_template","value":"<div></div>"}')).toBeNull();
    expect(parseTextProposal('Example only: {"type":"set_brand_color","hex":"#854d0e"}')).toBeNull();
    expect(parseTextProposal('{"type":"replace_template","value":"<div></div>"}', { allowHighRisk: true })).toMatchObject({
      operations: [{ type: "replace_template" }]
    });
  });

  it("bounds text scanning and operation count", () => {
    expect(TEXT_PROPOSAL_LIMITS).toMatchObject({ maxTextChars: 20000, maxJsonCandidates: 64, maxOperations: 13 });
    expect(parseTextProposal(JSON.stringify({ operations: Array.from({ length: 14 }, () => ({ type: "set_brand_color", hex: "#854d0e" })) }))).toBeNull();
  });
});
