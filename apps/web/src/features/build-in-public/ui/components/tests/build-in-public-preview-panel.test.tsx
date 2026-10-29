// @vitest-environment happy-dom

import type {
  BuildInPublicItem,
  BuildInPublicPreview,
} from "@cantiara/api/build-in-public";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { BuildInPublicPreviewPanel } from "../build-in-public-preview-panel";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

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
    title: "A-1 · Faster board",
    wallPart: null,
    workId: "a",
    ...overrides,
  };
}

const preview: BuildInPublicPreview = {
  fingerprint: "fp-1",
  items: [
    item({}),
    item({
      files: [{ attachmentId: "f1", name: "plan.png", version: 3 }],
      id: "attachment:a:f1",
      internalStatus: null,
      kind: "File Attachment",
      labelSource: null,
      parentId: "work:a",
      publicStatusLabel: null,
      title: "plan.png",
    }),
    item({
      blocker:
        "Choose a Public Status Label before this Work can be published.",
      id: "work:b",
      internalStatus: "Blocked",
      labelSource: "Unmapped",
      publicStatusLabel: null,
      title: "B-2 · Stuck",
      workId: "b",
    }),
    item({
      change: "Unpublished changes",
      diff: [
        {
          approved: "In Progress",
          field: "Public Status Label",
          proposed: "Completed",
        },
      ],
      id: "work:c",
      publicStatusLabel: "Completed",
      title: "C-3 · Done thing",
      workId: "c",
    }),
  ],
  metadata: { summary: null, title: null },
  notice: "Nothing is public until you approve it.",
  placeholders: [
    {
      context: "Hello {{name}}",
      field: "Title",
      itemId: "work:a",
      name: "name",
      sourceRecord: { id: "a", title: "Faster board", type: "Work" },
    },
  ],
  projectId: "project-1",
  written: false,
};

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(enabled = true) {
  const onApprove = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <BuildInPublicPreviewPanel
        enabled={enabled}
        onApprove={onApprove}
        preview={preview}
      />,
    ),
  );
  return { onApprove };
}

const button = (name: string) =>
  [...document.body.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name,
  ) as HTMLButtonElement;
const checkbox = (itemId: string) =>
  document.getElementById(`bip-item-${itemId}`) as HTMLElement;

test("shows the mapping, exact file version, diff and blockers per item", () => {
  render();
  const text = document.body.textContent ?? "";
  for (const expected of [
    "Public Status Label: Planned (from Not Started, Default map)",
    "File: plan.png (version 3)",
    "Unpublished changes",
    "Public Status Label: In Progress to Completed",
    "Choose a Public Status Label before this Work can be published.",
  ]) {
    expect(text).toContain(expected);
  }
  expect(
    document.body.querySelector('[role="checkbox"][aria-checked="true"]'),
  ).toBeNull();
});

test("a Work with no label blocks Publish; an unapproved item does not leave", () => {
  const { onApprove } = render();
  expect(button("Publish").disabled).toBe(true);

  act(() => checkbox("work:a").click());
  // The first Roadmap Work has a leaving placeholder.
  expect(button("Publish").disabled).toBe(true);
  act(() => document.getElementById("bip-publish-anyway")?.click());
  act(() => button("Publish").click());
  expect(onApprove).toHaveBeenCalledWith({
    approvedItemIds: ["work:a"],
    fingerprint: "fp-1",
    publishAnyway: true,
  });
});

test("nothing is published while Build in Public is off", () => {
  render(false);
  expect(document.body.textContent).toContain("Enable Build in Public");
  expect(button("Publish").disabled).toBe(true);
});
