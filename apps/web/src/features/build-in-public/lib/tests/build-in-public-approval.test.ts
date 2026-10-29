import type {
  BuildInPublicItem,
  BuildInPublicPreview,
} from "@cantiara/api/build-in-public";
import { expect, test } from "vitest";

import {
  buildApproval,
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
    parentId: null,
    publicStatusLabel: "Planned",
    title: "A",
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
