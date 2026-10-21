import { expect, test } from "vitest";

import {
  parseMermaidArchitecture,
  previewMermaidArchitecture,
} from "./mermaid-conversion";

test("preview reports each unsupported line and still converts the supported subset", async () => {
  const preview = await previewMermaidArchitecture(
    "graph TD\nweb[Web] --> api[API]\nclassDef danger fill:red\nstyle web fill:#f00",
  );
  expect(preview.canConvert).toBe(true);
  expect(preview.model.links).toHaveLength(1);
  expect(
    preview.unparseableLines.map(({ line, text }) => [line, text]),
  ).toEqual([
    [3, "classDef danger fill:red"],
    [4, "style web fill:#f00"],
  ]);
});

test("preview refuses a non-flowchart and reports its header as lost", async () => {
  const preview = await previewMermaidArchitecture(
    "sequenceDiagram\nAlice->>Bob: Hello",
  );
  expect(preview.canConvert).toBe(false);
  expect(preview.unparseableLines[0]).toMatchObject({ line: 1 });
});

test("converts a supported Mermaid flowchart into an independent structural model", async () => {
  expect(
    await parseMermaidArchitecture(
      "graph TD\nweb[Web] --> api[API]\napi --> db[Database]",
    ),
  ).toEqual({
    nodes: [
      { id: "web", label: "Web", kind: "Component" },
      { id: "api", label: "API", kind: "Component" },
      { id: "db", label: "Database", kind: "Component" },
    ],
    links: [
      { from: "web", kind: "Depends on", label: null, to: "api" },
      { from: "api", kind: "Depends on", label: null, to: "db" },
    ],
  });
});

test("refuses unsupported Mermaid syntax instead of losing source lines", async () => {
  await expect(
    parseMermaidArchitecture("sequenceDiagram\nAlice->>Bob: Hello"),
  ).rejects.toThrow("Unsupported Mermaid line 1");
  await expect(
    parseMermaidArchitecture("graph TD\nclassDef danger fill:red"),
  ).rejects.toThrow("Unsupported Mermaid line 2");
});
