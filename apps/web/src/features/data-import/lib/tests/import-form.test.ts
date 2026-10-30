// @vitest-environment happy-dom

import { expect, test } from "vitest";
import {
  buildPreviewInput,
  importErrorText,
  lastApplyKey,
  projectScopeValue,
  rememberLastApplyKey,
  scopeOfChoice,
} from "../import-form";

test("reads a place choice back into the contract scope", () => {
  expect(scopeOfChoice("wiki")).toEqual({ kind: "wiki" });
  expect(scopeOfChoice("workspace")).toEqual({ kind: "workspace" });
  expect(scopeOfChoice(projectScopeValue("p1"))).toEqual({
    kind: "project",
    projectId: "p1",
  });
  expect(scopeOfChoice("")).toBeNull();
  expect(scopeOfChoice("project:")).toBeNull();
});

test("asks for a place before building the preview request", () => {
  expect(
    buildPreviewInput({
      catalogType: "",
      content: "# A",
      fileCount: 1,
      fileName: "a.md",
      scopeChoice: "",
    }),
  ).toEqual({ error: "Choose where to import." });
});

test("builds the request and keeps the number of chosen files", () => {
  const built = buildPreviewInput({
    catalogType: "Risk",
    content: "title\nA",
    fileCount: 3,
    fileName: "risks.csv",
    scopeChoice: projectScopeValue("p1"),
  });

  expect(built).toMatchObject({
    input: {
      catalogType: "Risk",
      fileCount: 3,
      fileName: "risks.csv",
      scope: { kind: "project", projectId: "p1" },
    },
  });
});

test("shows a refusal message without file content", () => {
  expect(importErrorText(new Error("Folders cannot be imported."))).toBe(
    "Folders cannot be imported.",
  );
  expect(importErrorText("x")).toBe(
    "The file could not be previewed. Try again.",
  );
});

test("remembers the last Apply Import key for receipt reopening", () => {
  expect(lastApplyKey()).toBeNull();
  rememberLastApplyKey("import-key-1");
  expect(lastApplyKey()).toBe("import-key-1");
  rememberLastApplyKey("import-key-2");
  expect(lastApplyKey()).toBe("import-key-2");
});
