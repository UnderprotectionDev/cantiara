// @vitest-environment happy-dom

import type {
  ImportPreview,
  PreviewImportInput,
} from "@cantiara/api/data-import";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { ImportView } from "../import-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const preview: ImportPreview = {
  catalogType: "Risk",
  counts: { create: 1, invalid: 1, skip: 0, total: 2, updateExisting: 0 },
  expiresAt: "2026-10-31T10:00:00.000Z",
  family: "Catalog",
  fileName: "risks.csv",
  format: "CSV",
  invalidRows: [
    {
      action: "invalid",
      problems: ["title is empty."],
      rowNumber: 2,
      values: {},
    },
  ],
  invalidTotal: 1,
  losses: [
    { detail: 'Column "Owner" is not imported.', kind: "unmapped column" },
  ],
  mapping: [
    { origin: false, source: "Name", target: "title" },
    { origin: false, source: "Owner", target: null },
  ],
  mappingTargets: ["title", "ignore"],
  origin: {
    column: null,
    note: "This file has no stable origin key.",
    provenance: null,
  },
  primaryWrites: "none",
  rows: [
    {
      action: "create",
      problems: [],
      rowNumber: 1,
      values: { title: "Slip" },
    },
  ],
  rowsTruncated: false,
  scope: { kind: "project", label: "Project Atlas" },
  stagingId: "s1",
};

const APPLY_IMPORT = /Apply Import/;

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function mount(
  onPreview: (input: PreviewImportInput) => Promise<ImportPreview>,
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ImportView
        onPreview={onPreview}
        projects={[{ id: "p1", name: "Project Atlas" }]}
      />,
    );
  });
}

async function choose(files: File[], scope: string, type: string) {
  const fileInput = document.querySelector<HTMLInputElement>("#import-file");
  const scopeSelect =
    document.querySelector<HTMLSelectElement>("#import-scope");
  const typeSelect = document.querySelector<HTMLSelectElement>("#import-type");
  act(() => {
    Object.defineProperty(fileInput, "files", {
      configurable: true,
      value: files,
    });
    fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
    if (scopeSelect) {
      scopeSelect.value = scope;
      scopeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (typeSelect) {
      typeSelect.value = type;
      typeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await act(async () => {
    await Promise.resolve();
    document
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

test("shows the Import surface with the write-free preview and no Apply control", async () => {
  const onPreview = vi.fn(() => Promise.resolve(preview));
  mount(onPreview);

  expect(
    document.querySelector('section[aria-label="Import"] h2')?.textContent,
  ).toBe("Import");
  await choose(
    [new File(["Name,Owner\nSlip,Mert\n,x"], "risks.csv")],
    "project:p1",
    "Risk",
  );

  expect(onPreview).toHaveBeenCalledWith(
    expect.objectContaining({
      catalogType: "Risk",
      fileCount: 1,
      fileName: "risks.csv",
      scope: { kind: "project", projectId: "p1" },
    }),
  );
  const text = document.body.textContent ?? "";
  expect(text).toContain("Nothing has been written to your records.");
  expect(text).toContain('Column "Owner" is not imported.');
  expect(text).toContain("Invalid: title is empty.");
  expect(APPLY_IMPORT.test(text)).toBe(false);
  expect(document.activeElement?.id).toBe("import-preview-title");
});

test("passes the number of chosen files so the server can refuse a multi-file choice", async () => {
  const onPreview = vi.fn(() =>
    Promise.reject(new Error("Import takes one file at a time.")),
  );
  mount(onPreview);

  await choose(
    [new File(["# A"], "a.md"), new File(["# B"], "b.md")],
    "wiki",
    "",
  );

  expect(onPreview).toHaveBeenCalledWith(
    expect.objectContaining({ fileCount: 2, scope: { kind: "wiki" } }),
  );
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Import takes one file at a time.",
  );
});

test("asks for a file before reading anything", async () => {
  const onPreview = vi.fn();
  mount(onPreview);

  await choose([], "wiki", "");

  expect(onPreview).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Choose a file.",
  );
});
