import { describe, expect, test } from "vitest";

import {
  applyMermaidBlockOutcome,
  describeMermaidConversion,
  lineOfOffset,
  liveDiagramReference,
  MERMAID_CONVERT_LABELS,
  mermaidBlockSource,
  mermaidPreviewToken,
} from "./technical-diagram-mermaid";

const block = "```mermaid\ngraph TD\nweb[Web] --> api[API]\n```";
const body = `# Design\n\n${block}\n\nAfter`;
const range = {
  blockEnd: body.indexOf(block) + block.length,
  blockStart: body.indexOf(block),
};
const source = {
  ...range,
  blockLine: lineOfOffset(body, range.blockStart),
  documentId: "doc-1",
  documentRevision: 4,
  documentTitle: "Design",
};

describe("Mermaid block selection", () => {
  test("accepts only an exact fenced Mermaid block", () => {
    expect(mermaidBlockSource(block)).toBe("graph TD\nweb[Web] --> api[API]");
    expect(mermaidBlockSource("~~~~mermaid\ngraph TD\na --> b\n~~~~")).toBe(
      "graph TD\na --> b",
    );
    expect(mermaidBlockSource("```ts\nconst a = 1;\n```")).toBeNull();
    expect(mermaidBlockSource("```mermaid\ngraph TD\na --> b")).toBeNull();
  });
});

describe("block outcome", () => {
  test("keeps the block untouched by default and never deletes it", () => {
    expect(
      applyMermaidBlockOutcome(body, range, MERMAID_CONVERT_LABELS.keep, "d1"),
    ).toBe(body);
  });

  test("replaces exactly the chosen block with the live reference", () => {
    const next = applyMermaidBlockOutcome(
      body,
      range,
      MERMAID_CONVERT_LABELS.replace,
      "d1",
    );
    expect(next).toBe(`# Design\n\n${liveDiagramReference("d1")}\n\nAfter`);
    expect(next).not.toContain("mermaid");
  });

  test("a reference is a use-bind, not a Mermaid copy (no round-trip)", () => {
    expect(liveDiagramReference("d1")).toBe(':::live-diagram{diagramId="d1"}');
    expect(
      describeMermaidConversion(source, MERMAID_CONVERT_LABELS.keep, [])
        .roundTripSync,
    ).toBe(false);
  });
});

describe("conversion preview", () => {
  test("names source Document, version, block line and origin relation", () => {
    const effects = describeMermaidConversion(
      source,
      MERMAID_CONVERT_LABELS.keep,
      [],
    );
    expect(source.blockLine).toBe(3);
    expect(effects.originRelation).toBe(
      "Originates from Design, version 4, line 3",
    );
    expect(effects.blockEffect).toContain("stays independent Mermaid");
    expect(effects.documentRevisionAfter).toBe(4);
  });

  test("replacement states the Document revision increment", () => {
    const effects = describeMermaidConversion(
      source,
      MERMAID_CONVERT_LABELS.replace,
      [],
    );
    expect(effects.blockEffect).toContain("live Technical Diagram reference");
    expect(effects.documentRevisionAfter).toBe(5);
  });

  test("carries every lost line unchanged", () => {
    const lost = [
      { line: 3, reason: "Unsupported", text: "classDef danger fill:red" },
    ];
    expect(
      describeMermaidConversion(source, MERMAID_CONVERT_LABELS.keep, lost)
        .lostLines,
    ).toEqual(lost);
  });
});

describe("preview token", () => {
  const previewed = {
    ...range,
    canConvert: true,
    documentId: "doc-1",
    documentRevision: 4,
    lostLines: [] as { line: number; reason: string; text: string }[],
    model: { nodes: [{ id: "web" }] },
    originalBlock: MERMAID_CONVERT_LABELS.replace,
    source: "graph TD\nweb[Web] --> api[API]",
    title: "Web architecture",
  };

  test("is stable for the same previewed outcome", async () => {
    expect(await mermaidPreviewToken(previewed)).toBe(
      await mermaidPreviewToken({ ...previewed }),
    );
  });

  test("changes with the outcome, lost lines, block, title or revision", async () => {
    const token = await mermaidPreviewToken(previewed);
    const tokens = await Promise.all(
      [
        { originalBlock: MERMAID_CONVERT_LABELS.keep },
        {
          lostLines: [{ line: 3, reason: "Unsupported", text: "classDef x" }],
        },
        { source: "graph TD\nweb[Web] --> db[DB]" },
        { title: "Other" },
        { documentRevision: 5 },
      ].map((changed) => mermaidPreviewToken({ ...previewed, ...changed })),
    );
    for (const changedToken of tokens) {
      expect(changedToken).not.toBe(token);
    }
  });
});
