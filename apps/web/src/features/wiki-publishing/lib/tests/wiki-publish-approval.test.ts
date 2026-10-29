import type { WikiPublishPreview } from "@cantiara/api/wiki-publishing";
import { describe, expect, test } from "vitest";

import {
  buildWikiPublishApproval,
  leavingPlaceholders,
  toggledEmbed,
} from "../wiki-publish-approval";

const member = {
  fields: [],
  files: [],
  recordId: "r",
  recordType: "Document",
  title: "T",
  version: 1,
};

const preview: WikiPublishPreview = {
  documentId: "wiki-1",
  embeds: [
    {
      id: "child:wiki-2",
      kind: "Child document",
      liveSourceLabel: null,
      member,
    },
    { id: "backlink:wiki-9", kind: "Backlink", liveSourceLabel: null, member },
  ],
  fingerprint: "fp-1",
  notice: "n",
  placeholders: [
    {
      context: "Dear {{name}}",
      embedId: "child:wiki-2",
      field: "Body",
      name: "name",
      sourceRecord: { id: "wiki-2", title: "Child", type: "Document" },
    },
  ],
  root: member,
  written: false,
};

describe("Wiki publish approval", () => {
  test("approves nothing by default and only what was ticked", () => {
    expect(
      buildWikiPublishApproval(preview, new Set(), false).approvedEmbedIds,
    ).toEqual([]);
    const ticked = toggledEmbed(new Set(), "backlink:wiki-9", true);
    expect(
      buildWikiPublishApproval(preview, ticked, false).approvedEmbedIds,
    ).toEqual(["backlink:wiki-9"]);
  });

  test("drops ids the preview does not list and keeps Publish/share anyway separate", () => {
    const approval = buildWikiPublishApproval(
      preview,
      new Set(["child:wiki-2", "other"]),
      true,
    );

    expect(approval).toEqual({
      approvedEmbedIds: ["child:wiki-2"],
      fingerprint: "fp-1",
      publishAnyway: true,
    });
  });

  test("lists only the placeholders that would leave", () => {
    expect(leavingPlaceholders(preview, new Set())).toEqual([]);
    expect(
      leavingPlaceholders(preview, new Set(["child:wiki-2"])),
    ).toHaveLength(1);
  });
});
