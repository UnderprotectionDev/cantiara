import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { DocumentTransferPreviewPanel } from "./document-transfer-controls";

test("shows selection, target, owned File Attachments, broken references and publication effects before Apply", () => {
  const html = renderToStaticMarkup(
    <DocumentTransferPreviewPanel
      preview={{
        allowed: false,
        reason: "Cancel External Surface before Move.",
        fingerprint: "preview",
        targetLabel: "Launch",
        documents: [{ id: "root", title: "Architecture", revision: 2 }],
        attachments: [{ id: "file", name: "Architecture.pdf", revision: 1 }],
        externalSurfaceIds: ["surface"],
        brokenReferences: [{ recordId: "missing", label: "Old source" }],
      }}
    />,
  );
  expect(html).toContain("Launch");
  expect(html).toContain("Architecture.pdf");
  expect(html).toContain("Old source");
  expect(html).toContain("Cancel External Surface before Move.");
  expect(html).toContain("No content becomes public.");
});

test("retains available reference scopes and detached children in the unified transfer preview", () => {
  const preview = {
    allowed: true,
    reason: null,
    fingerprint: "preview",
    targetLabel: "Personal Wiki",
    documents: [{ id: "root", title: "Architecture", revision: 2 }],
    attachments: [],
    externalSurfaceIds: [],
    brokenReferences: [],
    detachedChildren: [
      { id: "child", title: "Project-only child", revision: 1 },
    ],
    references: [
      {
        recordType: "Document",
        id: "source",
        title: "Project knowledge",
        available: true,
        projectId: "project",
      },
      {
        recordType: "Document section",
        id: "missing",
        title: "Missing section",
        available: false,
        projectId: null,
      },
    ],
  };
  const html = renderToStaticMarkup(
    <DocumentTransferPreviewPanel preview={preview} />,
  );
  expect(html).toContain("Project-only child");
  expect(html).toContain("Project knowledge");
  expect(html).toContain("Available");
  expect(html).toContain("Project: project");
  expect(html).toContain("Missing section");
  expect(html).toContain("Unavailable");
});
