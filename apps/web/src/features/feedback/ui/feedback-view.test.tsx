// @vitest-environment happy-dom

import type { FeedbackRecord } from "@cantiara/api/feedback";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ConvertToWorkPreview } from "./convert-to-work-dialog";
import { FeedbackView } from "./feedback-view";

const record: FeedbackRecord = {
  attachments: [{ id: "a1", name: "screenshot.png" }],
  channel: "Email",
  company: null,
  contact: null,
  createdAt: "2026-10-01T09:00:00.000Z",
  id: "f1",
  link: "https://example.com/thread",
  occurredAt: "2026-09-30T12:00:00.000Z",
  originalMessage: "Export keeps failing\nfor large files.",
  projectId: "p1",
  revision: 1,
  status: "New",
  title: "Export fails",
  updatedAt: "2026-10-01T09:00:00.000Z",
  workOrigins: [],
};
const noop = async () => undefined;
const confirmConvert = () => noop;
const previewConvert = () => () => Promise.reject(new Error("unused"));

function render(overrides: { readOnly?: boolean; records?: FeedbackRecord[] }) {
  return renderToStaticMarkup(
    <FeedbackView
      attachmentOptions={[{ id: "a1", name: "screenshot.png" }]}
      companyOptions={[{ id: "co1", name: "Acme" }]}
      contactOptions={[{ id: "c1", name: "Ada" }]}
      onConfirmConvert={confirmConvert}
      onCreate={noop}
      onPreviewConvert={previewConvert}
      onSetIdentity={noop}
      onSetStatus={noop}
      readOnly={overrides.readOnly ?? false}
      records={overrides.records ?? [record]}
    />,
  );
}

test("Feedback shows the verbatim original message with channel, time, link and attachments", () => {
  const html = render({});
  expect(html).toContain("Export keeps failing\nfor large files.");
  expect(html).toContain("Email");
  expect(html).toContain("2026-09-30T12:00:00.000Z");
  expect(html).toContain("https://example.com/thread");
  expect(html).toContain("screenshot.png");
});

test("Create Feedback labels its fields and needs no Contact", () => {
  const html = render({ records: [] });
  for (const label of [
    "Create Feedback",
    "Title",
    "Original message",
    "Channel",
    "Occurred at",
    "Link",
    "Attachments",
    "No Feedback yet.",
  ]) {
    expect(html).toContain(label);
  }
  expect(html).toContain("Contact (optional)");
  expect(html).toContain("Company (optional)");
  expect(html).toContain("Unknown");
});

test("Status offers exactly New, Reviewed and Archived and no Work controls", () => {
  const html = render({});
  expect(html).toContain("New");
  expect(html).toContain("Reviewed");
  expect(html).toContain("Archived");
  for (const absent of [
    "Like",
    "Comment",
    "Vote",
    "Reply",
    "Recheck",
    "Priority",
    "Summary",
  ]) {
    expect(html).not.toContain(absent);
  }
});

test("archived Projects hide creation and disable status changes", () => {
  const html = render({ readOnly: true });
  expect(html).not.toContain("Create Feedback");
  expect(html).not.toContain("Convert to Work");
  expect(html).toContain("disabled");
  expect(html).toContain("Export fails");
});

test("an unknown sender shows Unknown Contact and Company and still offers Convert to Work", () => {
  const html = render({});
  expect(html).toContain("Unknown");
  expect(html).toContain("Convert to Work");
  expect(html).toContain('type="button"');
});

test("a known sender shows the linked Contact and Company", () => {
  const html = render({
    records: [
      {
        ...record,
        company: { id: "co1", name: "Acme" },
        contact: { displayName: "Ada", id: "c1" },
      },
    ],
  });
  expect(html).toContain("Ada");
  expect(html).toContain("Acme");
});

test("several origin-linked Work records are listed as provenance, not a count", () => {
  const html = render({
    records: [
      {
        ...record,
        workOrigins: [
          {
            createdAt: "2026-10-02T09:00:00.000Z",
            id: "o1",
            workId: "w1",
            workKey: "FBK-1",
            workTitle: "Fix export",
          },
        ],
      },
    ],
  });
  expect(html).toContain("Origin of");
  expect(html).toContain("FBK-1 Fix export");
  for (const absent of ["votes", "Votes", "Priority", "Score"]) {
    expect(html).not.toContain(absent);
  }
});

test("Convert to Work preview shows one Work, the Target Project, the mapping and the Origin relation", () => {
  const html = renderToStaticMarkup(
    <ConvertToWorkPreview
      plan={{
        feedbackId: "f1",
        feedbackRevision: 1,
        projectId: "p1",
        recordCount: 1,
        relation: "Origin",
        targetProject: { id: "p1", name: "Cantiara" },
        work: {
          description: "Export keeps failing\nfor large files.",
          title: "Export fails",
          type: "Bug",
        },
      }}
    />,
  );
  for (const expected of [
    "exactly one Work",
    "Target Project",
    "Cantiara",
    "Bug",
    "Export fails",
    "Export keeps failing\nfor large files.",
    "Origin",
    "stays as it is",
  ]) {
    expect(html).toContain(expected);
  }
  expect(html).not.toContain("AI");
});
