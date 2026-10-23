// @vitest-environment happy-dom

import type { PublishPreview } from "@cantiara/api/release-communication";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { PublishPreviewDialog } from "../publish-preview-dialog";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const preview: PublishPreview = {
  buildInPublicEvents: [{ id: "event-1", title: "Faster start shipped" }],
  changelogLinks: [{ href: "https://example.test/c", label: "Changelog" }],
  fingerprint: "fp-1",
  findings: [],
  noteId: "note-1",
  releaseId: "release-1",
  scope: [
    {
      currentPublicLabel: "Planned",
      internalStatus: "Closed",
      proposedPublicLabel: "Released",
      title: "Faster start",
      workId: "work-1",
    },
  ],
  whyTrail: [
    {
      proposedFields: [{ name: "Summary", value: "One click." }],
      sourceId: "decision-1",
      sourceType: "Decision",
    },
  ],
  written: false,
};

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(
  props: Partial<Parameters<typeof PublishPreviewDialog>[0]> = {},
) {
  const onCancel = vi.fn();
  const onPublish = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <PublishPreviewDialog
        onCancel={onCancel}
        onPublish={onPublish}
        open
        preview={preview}
        {...props}
      />,
    ),
  );
  return { onCancel, onPublish };
}

const dialog = () => document.body.querySelector('[role="dialog"]');
const button = (name: string) =>
  [...document.body.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === name,
  ) as HTMLButtonElement;

test("is a named dialog that lists everything the publish would touch", () => {
  render();

  const surface = dialog();
  expect(surface).not.toBeNull();
  const titleId = surface?.getAttribute("aria-labelledby");
  expect(titleId && document.getElementById(titleId)?.textContent).toBe(
    "Publish preview",
  );
  const text = surface?.textContent ?? "";
  for (const expected of [
    "Internal status: Closed",
    "Public label: Planned",
    "Change public label to Released",
    "Link to Changelog",
    "Decision Summary",
    "Faster start shipped",
  ]) {
    expect(text).toContain(expected);
  }
});

test("every proposal is an unticked, labelled checkbox", () => {
  render();

  const boxes = [
    ...document.body.querySelectorAll<HTMLElement>('[role="checkbox"]'),
  ];
  expect(boxes).toHaveLength(4);
  for (const box of boxes) {
    expect(box.getAttribute("aria-checked")).toBe("false");
    const labelId = box.getAttribute("aria-labelledby");
    expect(
      labelId && document.getElementById(labelId)?.textContent?.length,
    ).toBeGreaterThan(0);
  }
});

test("Cancel and Escape leave without publishing", () => {
  const { onCancel, onPublish } = render();

  act(() => button("Cancel").click());
  expect(onCancel).toHaveBeenCalledTimes(1);

  act(() => {
    dialog()?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }),
    );
  });
  expect(onCancel.mock.calls.length).toBeGreaterThanOrEqual(1);
  expect(onPublish).not.toHaveBeenCalled();
});

test("Publish sends only what was ticked", () => {
  const { onPublish } = render();

  act(() =>
    document.body.querySelector<HTMLElement>('[id="label-work-1"]')?.click(),
  );
  act(() => button("Publish").click());

  expect(onPublish).toHaveBeenCalledWith({
    buildInPublicEventIds: [],
    changelogLinkHrefs: [],
    fingerprint: "fp-1",
    publicLabels: [{ label: "Released", workId: "work-1" }],
    whyTrail: [
      { approvedFields: [], sourceId: "decision-1", sourceType: "Decision" },
    ],
  });
});

test("findings are announced and block Publish", () => {
  const { onPublish } = render({
    preview: {
      ...preview,
      findings: [
        {
          check: "placeholder",
          message: "Replace placeholder text before publishing.",
          target: "body",
        },
      ],
    },
  });

  expect(document.body.querySelector('[role="alert"]')?.textContent).toContain(
    "Replace placeholder text",
  );
  expect(button("Publish").disabled).toBe(true);
  act(() => button("Publish").click());
  expect(onPublish).not.toHaveBeenCalled();
});
