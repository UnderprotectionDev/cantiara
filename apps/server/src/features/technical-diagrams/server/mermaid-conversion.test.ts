import { expect, test } from "vitest";

import { parseMermaidArchitecture } from "./mermaid-conversion";

test("converts a supported Mermaid flowchart into an independent structural model", () => {
  expect(
    parseMermaidArchitecture(
      "graph TD\nweb[Web] --> api[API]\napi --> db[Database]",
    ),
  ).toEqual({
    nodes: [
      { id: "web", label: "Web", kind: "Component" },
      { id: "api", label: "API", kind: "Component" },
      { id: "db", label: "Database", kind: "Component" },
    ],
    links: [
      { from: "web", to: "api", label: null },
      { from: "api", to: "db", label: null },
    ],
  });
});

test("refuses unsupported Mermaid syntax instead of losing source lines", () => {
  expect(() =>
    parseMermaidArchitecture("sequenceDiagram\nAlice->>Bob: Hello"),
  ).toThrow("Unsupported Mermaid line 1");
  expect(() =>
    parseMermaidArchitecture("graph TD\nclassDef danger fill:red"),
  ).toThrow("Unsupported Mermaid line 2");
});
