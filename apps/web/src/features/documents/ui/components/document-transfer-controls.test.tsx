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
