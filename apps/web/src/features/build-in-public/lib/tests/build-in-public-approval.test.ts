import type {
  BuildInPublicItem,
  BuildInPublicPreview,
} from "@cantiara/api/build-in-public";
import { expect, test } from "vitest";

import {
  buildApproval,
  featureCandidates,
  featuredEndsAt,
  initialApproved,
  leavingItems,
  unlabeledWorks,
} from "../build-in-public-approval";

function item(overrides: Partial<BuildInPublicItem>): BuildInPublicItem {
  return {
    blocker: null,
    change: "New",
    diff: [],
    fields: [],
    files: [],
    id: "work:a",
    internalStatus: "Not Started",
    kind: "Roadmap Work",
    labelSource: "Default map",
    memberKind: null,
    parentId: null,
    publicStatusLabel: "Planned",
    title: "A",
    wallPart: null,
    workId: "a",
    ...overrides,
  };
}

const preview: BuildInPublicPreview = {
  fingerprint: "fp",
  items: [
    item({ change: "Unchanged" }),
    item({ id: "attachment:a:f", kind: "File Attachment", parentId: "work:a" }),
    item({ id: "work:b", publicStatusLabel: null, workId: "b" }),
  ],
  metadata: { summary: null, title: "Board" },
  notice: "",
  placeholders: [],
  planChanges: [],
  projectId: "p",
  written: false,
};

test("only unchanged, already approved items start ticked", () => {
  expect([...initialApproved(preview)]).toEqual(["work:a"]);
});

test("a dependent leaves only with its ticked Work", () => {
  expect(
    leavingItems(preview, new Set(["attachment:a:f"])).map((i) => i.id),
  ).toEqual([]);
  expect(
    leavingItems(preview, new Set(["work:a", "attachment:a:f"])).map(
      (i) => i.id,
    ),
  ).toEqual(["work:a", "attachment:a:f"]);
});

test("a Work without a label is reported until one is chosen", () => {
  expect(unlabeledWorks(preview, new Set(["work:b"])).map((i) => i.id)).toEqual(
    ["work:b"],
  );
  expect(unlabeledWorks(preview, new Set(["work:a"]))).toEqual([]);
});

test("the approval lists ticked items in preview order with the metadata", () => {
  expect(buildApproval(preview, new Set(["work:b", "work:a"]), false)).toEqual({
    approvedItemIds: ["work:a", "work:b"],
    fingerprint: "fp",
    metadata: { summary: null, title: "Board" },
    publishAnyway: false,
  });
});

test("a Wall part leaves only with its ticked Wall, and featuring offers only approved Releases and Decisions", () => {
  const wall = item({
    id: "member:wall-1",
    kind: "Project member",
    memberKind: "Project Wall",
    workId: null,
  });
  const card = item({
    id: "wall:wall-1:Card:c1",
    kind: "Wall part",
    parentId: "member:wall-1",
    wallPart: "Card",
    workId: null,
  });
  const decision = item({
    id: "member:decision-1",
    kind: "Project member",
    memberKind: "Decision",
    workId: null,
  });
  const wallPreview: BuildInPublicPreview = {
    ...preview,
    items: [wall, card, decision],
  };

  expect(
    leavingItems(wallPreview, new Set([card.id])).map((i) => i.id),
  ).toEqual([]);
  expect(
    leavingItems(wallPreview, new Set([wall.id, card.id])).map((i) => i.id),
  ).toEqual([wall.id, card.id]);
  expect(featureCandidates(wallPreview, new Set([wall.id]))).toEqual([]);
  expect(
    featureCandidates(wallPreview, new Set([decision.id])).map((i) => i.id),
  ).toEqual([decision.id]);
});

test("featuring is omitted unless chosen and the end time becomes an instant", () => {
  const plain = buildApproval(preview, new Set(["work:a"]), false);
  expect("featured" in plain).toBe(false);
  expect(
    buildApproval(preview, new Set(["work:a"]), false, null).featured,
  ).toBeNull();
  expect(featuredEndsAt("")).toBeNull();
  expect(featuredEndsAt("2027-01-01T10:00")?.slice(0, 4)).toBe("2027");
});
