import type { ShareItem, ShareScopePreview } from "@cantiara/api/link-sharing";
import { describe, expect, test } from "vitest";

import {
  defaultShareScopeDraft,
  groupsNeedingChoice,
  shareItemSections,
} from "../share-scope-form";

const item = (
  overrides: Partial<ShareItem> & { itemId: string },
): ShareItem => ({
  candidate: false,
  group: null,
  kind: "Field",
  label: overrides.itemId,
  leavesScope: false,
  live: false,
  liveEligible: false,
  parentId: "record:Screen:s1",
  selectable: true,
  state: null,
  value: null,
  ...overrides,
});

const preview = (
  items: ShareItem[],
  surface: ShareScopePreview["surface"] = null,
): ShareScopePreview => ({
  blockers: [],
  diff: null,
  items,
  placeholders: [],
  projectId: "p1",
  root: { id: "s1", kind: "Screen", title: "Home" },
  surface,
});

const record = item({
  itemId: "record:Screen:s1",
  kind: "Record",
  parentId: null,
});
const versionOne = item({
  group: "Wireframe version",
  itemId: "v1",
  kind: "Version",
});
const versionTwo = item({
  group: "Wireframe version",
  itemId: "v2",
  kind: "Version",
});
const versions = [versionOne, versionTwo];

describe("Share scope form", () => {
  test("a first preview checks listed records and fields but leaves a version group unchosen", () => {
    const draft = defaultShareScopeDraft(
      preview([record, item({ itemId: "f1" }), ...versions]),
    );
    expect(draft.approved).toEqual(["record:Screen:s1", "f1"]);
    expect(draft.publishAnyway).toBe(false);
  });

  test("on an existing surface only earlier approvals stay checked; candidates and new content wait", () => {
    const surface = {
      label: "Some fields live" as const,
      lastApprovedAt: "2026-01-01T00:00:00.000Z",
      revision: 2,
      surfaceId: "surf",
    };
    const draft = defaultShareScopeDraft(
      preview(
        [
          { ...record, state: "Approved" },
          item({ itemId: "kept", live: true, state: "Approved" }),
          item({ itemId: "edited", state: "Changed since approval" }),
          item({ itemId: "fresh", state: "Never approved" }),
          item({
            candidate: true,
            itemId: "cand",
            kind: "Record",
            state: "Never approved",
          }),
          item({ itemId: "gone", leavesScope: true, state: "Approved" }),
          { ...versionOne, state: "Approved" },
        ],
        surface,
      ),
    );
    expect(draft.approved).toEqual([
      "record:Screen:s1",
      "kept",
      "edited",
      "v1",
    ]);
    expect(draft.live).toEqual(["kept"]);
  });

  test("names a group that still needs exactly one choice", () => {
    const p = preview([record, ...versions]);
    expect(groupsNeedingChoice(p, ["record:Screen:s1"])).toEqual([
      "Wireframe version",
    ]);
    expect(groupsNeedingChoice(p, ["record:Screen:s1", "v1", "v2"])).toEqual([
      "Wireframe version",
    ]);
    expect(groupsNeedingChoice(p, ["record:Screen:s1", "v2"])).toEqual([]);
    expect(groupsNeedingChoice(p, [])).toEqual([]);
  });

  test("groups items under their record and separates exclusive groups", () => {
    const [section] = shareItemSections(
      preview([record, item({ itemId: "f1" }), ...versions]),
    );
    expect(section?.items.map((entry) => entry.itemId)).toEqual(["f1"]);
    expect(section?.groups[0]?.name).toBe("Wireframe version");
    expect(section?.groups[0]?.items).toHaveLength(2);
  });
});
