import type { PublishPreview } from "@cantiara/api/release-communication";
import { expect, test } from "vitest";

import {
  buildPublishApproval,
  EMPTY_PUBLISH_SELECTION,
  toggled,
  whyTrailFieldKey,
} from "../publish-approval";

const preview: PublishPreview = {
  buildInPublicEvents: [{ id: "event-1", title: "Shipped" }],
  changelogLinks: [{ href: "https://example.test/c", label: "Changelog" }],
  fingerprint: "fp-1",
  findings: [],
  noteId: "note-1",
  releaseId: "release-1",
  scope: [
    {
      currentPublicLabel: null,
      internalStatus: "Closed",
      proposedPublicLabel: "Released",
      title: "Faster start",
      workId: "work-1",
    },
  ],
  whyTrail: [
    {
      proposedFields: [
        { name: "Summary", value: "One click." },
        { name: "Context", value: "Private." },
      ],
      sourceId: "decision-1",
      sourceType: "Decision",
    },
  ],
  written: false,
};

test("approves nothing by default: every proposal stays private", () => {
  expect(buildPublishApproval(preview, EMPTY_PUBLISH_SELECTION)).toEqual({
    buildInPublicEventIds: [],
    changelogLinkHrefs: [],
    fingerprint: "fp-1",
    publicLabels: [],
    whyTrail: [
      { approvedFields: [], sourceId: "decision-1", sourceType: "Decision" },
    ],
  });
});

test("carries only the ticked items", () => {
  const approval = buildPublishApproval(preview, {
    eventIds: new Set(["event-1"]),
    fieldKeys: toggled(
      new Set<string>(),
      whyTrailFieldKey(
        { sourceId: "decision-1", sourceType: "Decision" },
        "Summary",
      ),
      true,
    ),
    linkHrefs: new Set(),
    workIds: new Set(["work-1"]),
  });

  expect(approval.publicLabels).toEqual([
    { label: "Released", workId: "work-1" },
  ]);
  expect(approval.whyTrail[0]?.approvedFields).toEqual(["Summary"]);
  expect(approval.buildInPublicEventIds).toEqual(["event-1"]);
  expect(approval.changelogLinkHrefs).toEqual([]);
});
