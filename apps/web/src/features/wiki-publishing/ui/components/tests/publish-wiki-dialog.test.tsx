// @vitest-environment happy-dom

import type { WikiPublishPreview } from "@cantiara/api/wiki-publishing";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import { PublishWikiDialog } from "../publish-wiki-dialog";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const member = {
  fields: [{ name: "Title", value: "Child notes" }],
  files: [],
  recordId: "wiki-2",
  recordType: "Document",
  title: "Child notes",
  version: 2,
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
    {
      id: "live:Smart Collection:view-1::",
      kind: "Live Smart Collection",
      liveSourceLabel: "Open bugs view",
      member: { ...member, recordId: "view-1", title: "Open bugs" },
    },
  ],
  fingerprint: "fp-1",
  notice: "Free text is not scanned for secrets.",
  placeholders: [
    {
      context: "Dear {{name}}",
      embedId: "child:wiki-2",
      field: "Body",
      name: "name",
      sourceRecord: { id: "wiki-2", title: "Child notes", type: "Document" },
    },
  ],
  root: { ...member, recordId: "wiki-1", title: "Release habits", version: 4 },
  written: false,
};

let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render() {
  const onCancel = vi.fn();
  const onPublish = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root?.render(
      <PublishWikiDialog
        onCancel={onCancel}
        onPublish={onPublish}
        open
        preview={preview}
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
const checkbox = (labelText: string) =>
  [...document.body.querySelectorAll<HTMLElement>('[role="checkbox"]')].find(
    (box) => {
      const labelId = box.getAttribute("aria-labelledby");
      return (
        labelId &&
        document.getElementById(labelId)?.textContent?.includes(labelText)
      );
    },
  ) as HTMLElement;

test("is the named Publish Wiki Document dialog listing each embed", () => {
  render();

  const surface = dialog();
  const titleId = surface?.getAttribute("aria-labelledby");
  expect(titleId && document.getElementById(titleId)?.textContent).toBe(
    "Publish Wiki Document",
  );
  const text = surface?.textContent ?? "";
  for (const expected of [
    "Release habits (version 4)",
    "Include Child document",
    "Include Live Smart Collection",
    "read-only snapshot of Open bugs view",
    "Dear {{name}}",
    "not scanned for secrets",
  ]) {
    expect(text).toContain(expected);
  }
  for (const box of document.body.querySelectorAll('[role="checkbox"]')) {
    expect(box.getAttribute("aria-checked")).toBe("false");
  }
});

test("a leaving placeholder blocks Publish until Publish/share anyway is ticked", () => {
  const { onPublish } = render();

  act(() => checkbox("Include Child document").click());
  expect(button("Publish Wiki Document").disabled).toBe(true);

  act(() => checkbox("Publish/share anyway").click());
  act(() => button("Publish Wiki Document").click());
  expect(onPublish).toHaveBeenCalledWith({
    approvedEmbedIds: ["child:wiki-2"],
    fingerprint: "fp-1",
    publishAnyway: true,
  });
});

test("an unapproved embed does not block and Cancel publishes nothing", () => {
  const { onCancel, onPublish } = render();

  expect(button("Publish Wiki Document").disabled).toBe(false);
  act(() => button("Cancel").click());
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onPublish).not.toHaveBeenCalled();
});
