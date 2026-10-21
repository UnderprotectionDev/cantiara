// @vitest-environment happy-dom

import type { FeedRow } from "@cantiara/api/feedback-feed";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FeedView, masterRecordElementId } from "../feed-view";

const feedbackRow: FeedRow = {
  attachments: [{ id: "a1", name: "screenshot.png" }],
  body: "Export keeps failing\nfor large files.",
  id: "feedback-1",
  identity: "Email",
  kind: "Feedback",
  occurredAt: "2026-09-30T12:00:00.000Z",
  projectId: "project-1",
  related: [
    {
      id: "w1",
      projectId: "project-1",
      title: "CAN-1 Fix export",
      type: "Work",
    },
  ],
  status: "New",
  title: "Export fails",
};
const sourceRow: FeedRow = {
  ...feedbackRow,
  attachments: [],
  id: "source-1",
  identity: null,
  kind: "Source",
  related: [],
  status: null,
  title: "Export article",
};

const noQueryChange = () => undefined;

function render(rows: FeedRow[]) {
  return renderToStaticMarkup(
    <FeedView
      onChangeQuery={noQueryChange}
      query={{ sort: "Newest first" }}
      rows={rows}
    />,
  );
}

test("Feed rows show identity or channel, time, attachments, project and related Work with Open Source Record", () => {
  const html = render([feedbackRow, sourceRow]);
  expect(html).toContain(">Feed<");
  expect(html.match(/Open Source Record</g)).toHaveLength(2);
  for (const text of [
    "Email",
    "2026-09-30T12:00:00.000Z",
    "screenshot.png",
    "project-1",
    "Work: CAN-1 Fix export",
    "Export keeps failing\nfor large files.",
  ]) {
    expect(html).toContain(text);
  }
  expect(html).toContain('data-record-id="feedback-1"');
  expect(html).toContain('data-record-id="source-1"');
});

test("Open Source Record targets the id of the same master record", () => {
  expect(masterRecordElementId(feedbackRow)).toBe("feedback-record-feedback-1");
  expect(masterRecordElementId(sourceRow)).toBe("source-record-source-1");
});

test("Feed offers no like, comment, vote, status edit or notification control", () => {
  const html = render([feedbackRow, sourceRow]).toLowerCase();
  for (const forbidden of [
    "like",
    "comment",
    "vote",
    "reply",
    "mark as read",
    "notification",
    "recheck",
    "priority",
  ]) {
    expect(html).not.toContain(forbidden);
  }
  expect(html).not.toContain("<textarea");
  // Only filters and one button per row are interactive.
  expect(html.match(/<button/g)).toHaveLength(2);
  expect(html.match(/<select/g)).toHaveLength(3);
});
