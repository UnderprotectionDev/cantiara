import type {
  DocumentEvidenceBinding,
  DocumentEvidencePlan,
} from "@cantiara/api/document-evidence";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

const noop = () => undefined;

import { EvidencePreview, EvidenceRow } from "./document-evidence-controls";

const source = {
  recordType: "Document",
  recordId: "doc",
  projectId: "project",
  revision: 1,
  componentId: null,
};
const pin = {
  source,
  start: 4,
  end: 9,
  excerpt: "local",
  before: "keep ",
  after: " exports",
};

test("previews the exact version, range and the single new record before confirmation", () => {
  const plan: DocumentEvidencePlan = {
    pin,
    mode: "create",
    target: null,
    newRecord: { type: "Assumption", projectId: "project", title: "Offline" },
    targetTitle: "Offline",
    fields: { title: "Offline", statement: "local" },
    bindingId: null,
    bindingRevision: 0,
    currentRevision: 1,
  };
  const html = renderToStaticMarkup(<EvidencePreview plan={plan} />);
  expect(html).toContain("New record");
  expect(html).toContain("Assumption: Offline");
  expect(html).toContain("Version 1");
  expect(html).toContain("Range 4–9");
  expect(html).toContain("statement");
  expect(html).toContain("Unspecified");
});

test("shows Newer version exists without moving the old pin, plus the source and Origin Location", () => {
  const binding: DocumentEvidenceBinding = {
    id: "bind",
    revision: 1,
    pin,
    role: "Unspecified",
    target: {
      type: "Decision",
      recordId: "decision",
      projectId: "project",
      label: "Keep exports local",
      brokenReason: null,
      canOpenSourceRecord: true,
    },
    origin: true,
    newerVersionExists: true,
    currentRevision: 3,
    readOnly: false,
    createdAt: "2026-10-17T09:00:00.000Z",
    actorId: "account",
  };
  const html = renderToStaticMarkup(
    <EvidenceRow binding={binding} onRebind={noop} />,
  );
  expect(html).toContain("<mark>local</mark>");
  expect(html).toContain("Version 1");
  expect(html).toContain("Newer version exists");
  expect(html).toContain("Rebind to new version");
  expect(html).toContain("Origin Location");
  expect(html).toContain("Open source record");
});

test("does not offer a link or a rebind for an unavailable archived target", () => {
  const html = renderToStaticMarkup(
    <EvidenceRow
      binding={{
        id: "bind",
        revision: 1,
        pin,
        role: "Unspecified",
        target: {
          type: "Risk",
          recordId: "risk",
          projectId: null,
          label: null,
          brokenReason: "Permanently deleted",
          canOpenSourceRecord: false,
        },
        origin: false,
        newerVersionExists: true,
        currentRevision: 2,
        readOnly: true,
        createdAt: "2026-10-17T09:00:00.000Z",
        actorId: "account",
      }}
      onRebind={noop}
    />,
  );
  expect(html).toContain("Permanently deleted");
  expect(html).not.toContain("Open source record");
  expect(html).not.toContain("Rebind to new version");
});
