// @vitest-environment happy-dom

import {
  emptyLinkEvidence,
  type FeedbackRecord,
  type FeedbackWorkOrigin,
} from "@cantiara/api/feedback";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { ConvertToWorkPreview } from "../../components/convert-to-work-dialog";
import { FeedbackView } from "../feedback-view";

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
const saveEvidence = () => noop;
const FOLLOWED_UP_SELECTED = /<option[^>]*value="Followed up"[^>]*selected/;
const CONTRADICTING_SELECTED = /<option[^>]*value="Contradicting"[^>]*selected/;

const origin: FeedbackWorkOrigin = {
  createdAt: "2026-10-02T09:00:00.000Z",
  evidence: emptyLinkEvidence(),
  id: "o1",
  workId: "w1",
  workKey: "FBK-1",
  workTitle: "Fix export",
};

function render(overrides: { readOnly?: boolean; records?: FeedbackRecord[] }) {
  return renderToStaticMarkup(
    <FeedbackView
      attachmentOptions={[{ id: "a1", name: "screenshot.png" }]}
      companyOptions={[{ id: "co1", name: "Acme" }]}
      contactOptions={[{ id: "c1", name: "Ada" }]}
      onConfirmConvert={confirmConvert}
      onCreate={noop}
      onPreviewConvert={previewConvert}
      onSaveEvidence={saveEvidence}
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
    "Occurred at",
    "Attachments",
    "No Feedback yet.",
  ]) {
    expect(html).toContain(label);
  }
  expect(html).toContain(">Channel</label>");
  expect(html).toContain(">Link</label>");
  expect(html).not.toContain("Channel (optional)");
  expect(html).not.toContain("Link (optional)");
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
        workOrigins: [origin],
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

function renderLinked(evidence = emptyLinkEvidence(), readOnly = false) {
  return render({
    readOnly,
    records: [{ ...record, workOrigins: [{ ...origin, evidence }] }],
  });
}

test("Evidence quality offers seven separate optional fields, Unknown and the original message stays separate text", () => {
  const html = renderLinked();
  for (const label of [
    "Evidence quality",
    "Reported problem",
    "Suggested solution",
    "Current workaround",
    "Impact severity",
    "Usage frequency",
    "Independence",
    "Audience fit",
    "Unknown",
    "Founder interpretation",
    "Evidence Role",
    "Follow-up",
    "Follow up",
    "Followed up",
    "Outcome verified",
  ]) {
    expect(html).toContain(label);
  }
  expect(html).toContain("Export keeps failing\nfor large files.");
  // Fields start blank: nothing is extracted from the message.
  expect(html).not.toContain('value="Export');
  for (const absent of ["Score", "Weight", "Rank", "Confidence"]) {
    expect(html).not.toContain(absent);
  }
});

test("an interpreted value shows Founder interpretation with author and time", () => {
  const evidence = emptyLinkEvidence();
  evidence.quality.impactSeverity = {
    author: "alias-1",
    founderInterpretation: true,
    recordedAt: "2026-10-03T08:00:00.000Z",
    value: "High",
  };
  const html = renderLinked(evidence);
  expect(html).toContain("Founder interpretation by alias-1");
  expect(html).toContain("2026-10-03T08:00:00.000Z");
  expect(html).toContain('value="High"');
});

test("the role and follow-up are separate controls with the closed labels", () => {
  const evidence = emptyLinkEvidence();
  evidence.role = "Contradicting";
  evidence.followUp = "Followed up";
  const html = renderLinked(evidence);
  for (const role of [
    "Supporting",
    "Contradicting",
    "Provides context",
    "Inconclusive",
    "Unspecified",
  ]) {
    expect(html).toContain(role);
  }
  expect(html).toMatch(FOLLOWED_UP_SELECTED);
  expect(html).toMatch(CONTRADICTING_SELECTED);
});

test("archived Projects show Evidence quality without a save control", () => {
  const html = renderLinked(emptyLinkEvidence(), true);
  expect(html).toContain("Reported problem");
  expect(html).not.toContain("Save Evidence quality");
});
