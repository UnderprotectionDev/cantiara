// @vitest-environment happy-dom

import type {
  ApplyImportInput,
  ImportApplyResult,
  ImportPreview,
  ImportReceipt,
  PreviewImportInput,
} from "@cantiara/api/data-import";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { rememberLastApplyKey } from "../../../lib/import-form";
import { ImportView } from "../import-view";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const preview: ImportPreview = {
  catalogType: "Risk",
  counts: {
    create: 1,
    excluded: 0,
    invalid: 1,
    skip: 0,
    total: 2,
    updateExisting: 0,
  },
  expiresAt: "2026-10-31T10:00:00.000Z",
  family: "Catalog",
  fileName: "risks.csv",
  finalSetFingerprint: "a".repeat(64),
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

const KEY_PATTERN = /^import-/;

const validPreview: ImportPreview = {
  ...preview,
  counts: { ...preview.counts, excluded: 0, invalid: 0, total: 1 },
  finalSetFingerprint: "b".repeat(64),
  invalidRows: [],
  invalidTotal: 0,
};

const receipt: ImportReceipt = {
  catalogType: "Risk",
  completedAt: "2026-10-30T10:00:00.000Z",
  counts: { created: 1, excluded: 0, skipped: 0, updated: 0 },
  family: "Catalog",
  fileName: "risks.csv",
  finalSetFingerprint: "b".repeat(64),
  idempotencyKey: "import-key",
  provenance: null,
  scopeLabel: "Project Atlas",
  status: "committed",
};

let root: Root | undefined;
let host: HTMLDivElement | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  window.localStorage.removeItem("cantiara:data-import:last-apply-key");
});

function mount(
  onPreview: (input: PreviewImportInput) => Promise<ImportPreview>,
  handlers: {
    onApply?: (input: ApplyImportInput) => Promise<ImportApplyResult>;
    onCancel?: (stagingId: string) => Promise<unknown>;
    onReopenReceipt?: (idempotencyKey: string) => Promise<ImportReceipt>;
  } = {},
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => {
    root?.render(
      <ImportView
        onApply={handlers.onApply ?? (() => Promise.reject(new Error("no")))}
        onCancel={handlers.onCancel ?? (() => Promise.resolve({}))}
        onPreview={onPreview}
        onReopenReceipt={handlers.onReopenReceipt}
        projects={[{ id: "p1", name: "Project Atlas" }]}
      />,
    );
  });
}

function button(label: string) {
  return [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === label,
  );
}

async function click(label: string) {
  await act(async () => {
    button(label)?.click();
    await Promise.resolve();
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

test("shows the Import surface with the write-free preview and a blocked Apply Import", async () => {
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
  expect(button("Apply Import")?.disabled).toBe(true);
  expect(text).toContain("must be corrected in the file or dropped");
  expect(document.activeElement?.id).toBe("import-preview-title");
});

test("dropping an invalid row previews again with that row excluded", async () => {
  const onPreview = vi.fn(() => Promise.resolve(preview));
  mount(onPreview);
  await choose([new File(["Name\nSlip\n"], "risks.csv")], "project:p1", "Risk");

  await click("Exclude row");

  expect(onPreview).toHaveBeenLastCalledWith(
    expect.objectContaining({ excludedRows: [2] }),
  );
});

test("Apply Import confirms the exact previewed set once and shows the receipt", async () => {
  const onPreview = vi.fn(() => Promise.resolve(validPreview));
  const onApply = vi.fn(() =>
    Promise.resolve({ receipt, replayed: false, status: "committed" } as const),
  );
  mount(onPreview, { onApply });
  await choose([new File(["Name\nSlip\n"], "risks.csv")], "project:p1", "Risk");

  expect(button("Apply Import")?.disabled).toBe(false);
  await click("Apply Import");

  expect(onApply).toHaveBeenCalledTimes(1);
  expect(onApply).toHaveBeenCalledWith({
    finalSetFingerprint: "b".repeat(64),
    idempotencyKey: expect.stringMatching(KEY_PATTERN),
    stagingId: "s1",
  });
  const text = document.body.textContent ?? "";
  expect(text).toContain("Import receipt");
  expect(text).toContain("Committed.");
  expect(button("Apply Import")).toBeUndefined();
});

test("after the commit barrier the status is Finalizing and Cancel is gone", async () => {
  const onPreview = vi.fn(() => Promise.resolve(validPreview));
  const onApply = vi.fn(() =>
    Promise.resolve({ label: "Finalizing", status: "finalizing" } as const),
  );
  const onCancel = vi.fn(() => Promise.resolve({}));
  mount(onPreview, { onApply, onCancel });
  await choose([new File(["Name\nSlip\n"], "risks.csv")], "project:p1", "Risk");
  expect(button("Cancel")).toBeDefined();

  await click("Apply Import");

  expect(
    document.querySelector('[role="status"]:not(#x)')?.textContent,
  ).toBeTruthy();
  expect(document.body.textContent).toContain("Finalizing");
  expect(button("Cancel")).toBeUndefined();
  expect(onCancel).not.toHaveBeenCalled();
});

test("the reopen control appears right after Apply Import stored its key", async () => {
  const onApply = vi.fn(() =>
    Promise.resolve({ receipt, replayed: false, status: "committed" } as const),
  );
  mount(
    vi.fn(() => Promise.resolve(validPreview)),
    { onApply, onReopenReceipt: vi.fn() },
  );
  await choose([new File(["Name\nSlip\n"], "risks.csv")], "project:p1", "Risk");
  expect(button("Reopen receipt")).toBeUndefined();

  await click("Apply Import");

  expect(button("Reopen receipt")).toBeDefined();
});

test("Cancel before Apply Import releases the staged file and clears the preview", async () => {
  const onPreview = vi.fn(() => Promise.resolve(validPreview));
  const onCancel = vi.fn(() => Promise.resolve({ status: "cancelled" }));
  mount(onPreview, { onCancel });
  await choose([new File(["Name\nSlip\n"], "risks.csv")], "project:p1", "Risk");

  await click("Cancel");

  expect(onCancel).toHaveBeenCalledWith("s1");
  expect(document.body.textContent).not.toContain("Preview: risks.csv");
});

test("a dropped connection offers Retry with the same key", async () => {
  const onPreview = vi.fn(() => Promise.resolve(validPreview));
  const onApply = vi
    .fn()
    .mockRejectedValueOnce(new Error("Network lost"))
    .mockResolvedValueOnce({ receipt, replayed: true, status: "committed" });
  mount(onPreview, { onApply });
  await choose([new File(["Name\nSlip\n"], "risks.csv")], "project:p1", "Risk");

  await click("Apply Import");
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    "Network lost",
  );
  await click("Retry");

  const keys = onApply.mock.calls.map(
    ([input]) => (input as ApplyImportInput).idempotencyKey,
  );
  expect(keys[0]).toBe(keys[1]);
  expect(document.body.textContent).toContain("Import receipt");
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

test("a dropped receipt reopens by the stored key of the last Apply Import", async () => {
  rememberLastApplyKey("import-stored-0001");
  const onReopenReceipt = vi.fn(() =>
    Promise.resolve({ ...receipt, idempotencyKey: "import-stored-0001" }),
  );
  mount(
    vi.fn(() => Promise.resolve(validPreview)),
    { onReopenReceipt },
  );

  expect(button("Reopen receipt")).toBeDefined();
  await click("Reopen receipt");

  expect(onReopenReceipt).toHaveBeenCalledWith("import-stored-0001");
  expect(document.body.textContent).toContain(
    "This is the same receipt, reopened.",
  );
});

test("without a stored key no reopen control is offered", () => {
  mount(vi.fn());

  expect(button("Reopen receipt")).toBeUndefined();
});
