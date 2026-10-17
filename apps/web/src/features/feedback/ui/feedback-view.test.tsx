// @vitest-environment happy-dom

import type { FeedbackRecord } from "@cantiara/api/feedback";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FeedbackView } from "./feedback-view";

const record: FeedbackRecord = {
  attachments: [{ id: "a1", name: "screenshot.png" }],
  channel: "Email",
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
};
const noop = async () => undefined;

function render(overrides: { readOnly?: boolean; records?: FeedbackRecord[] }) {
  return renderToStaticMarkup(
    <FeedbackView
      attachmentOptions={[{ id: "a1", name: "screenshot.png" }]}
      onCreate={noop}
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
  expect(html).not.toContain("Contact");
});

test("Status offers exactly New, Reviewed and Archived and no Work controls", () => {
  const html = render({});
  expect(html).toContain("New");
  expect(html).toContain("Reviewed");
  expect(html).toContain("Archived");
  for (const absent of [
    "Convert to Work",
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
  expect(html).toContain("disabled");
  expect(html).toContain("Export fails");
});
