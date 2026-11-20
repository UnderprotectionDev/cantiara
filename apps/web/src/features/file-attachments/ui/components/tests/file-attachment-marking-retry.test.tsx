// @vitest-environment happy-dom

import {
  FILE_ATTACHMENT_UI_LABELS,
  type FileAttachment,
  type FileAttachmentMarkingInput,
} from "@cantiara/api/file-attachments";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import type { MarkingFeedback } from "../file-attachment-markup";
import { FileAttachmentPreviewPanel } from "../file-attachment-preview";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("@/utils/orpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/utils/orpc")>();
  return {
    ...original,
    client: { ...original.client, createFileAttachmentMarking: create },
  };
});
vi.mock("../file-attachment-pdf", () => ({
  FileAttachmentPdfPreview: () => null,
}));
vi.mock("../file-attachment-markup", () => ({
  FileAttachmentMarkup: ({
    markingFeedback,
    onCreateMarking,
  }: {
    markingFeedback: MarkingFeedback;
    onCreateMarking: (input: FileAttachmentMarkingInput) => Promise<void>;
  }) => {
    function draw() {
      onCreateMarking(command).catch(() => undefined);
    }
    return (
      <>
        <button onClick={draw} type="button">
          Draw
        </button>
        {markingFeedback.error ? (
          <p role="alert">{markingFeedback.error}</p>
        ) : null}
        {markingFeedback.retry ? (
          <button onClick={markingFeedback.retry} type="button">
            Retry
          </button>
        ) : null}
      </>
    );
  },
}));

const attachment: FileAttachment = {
  createdAt: "2026-09-21T10:00:00.000Z",
  currentVersion: {
    byteSize: 2048,
    contentHash: "a".repeat(64),
    createdAt: "2026-09-21T10:00:00.000Z",
    detectedMimeType: "image/png",
    extension: ".png",
    fileName: "photo.png",
    id: "version-1",
    mimeType: "image/png",
    number: 1,
    preview: "image",
  },
  id: "attachment-1",
  lifecycleStatus: "Active",
  name: "photo.png",
  revision: 0,
  scope: { kind: "project", projectId: "project-1" },
  updatedAt: "2026-09-21T10:00:00.000Z",
};
const input = {
  attachmentId: attachment.id,
  versionId: attachment.currentVersion.id,
};
const command: FileAttachmentMarkingInput = {
  ...input,
  clientIdempotencyKey: "marking-1",
  geometry: {
    kind: "path",
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  tool: "pen",
};

afterEach(() => vi.unstubAllGlobals());

test("the preview refetches its asset and retries the exact marking on its attachment version", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  create
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce({});
  const fetchAsset = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce(new Response(new Blob(["asset"])));
  vi.stubGlobal("fetch", fetchAsset);
  const path = "/api/file-attachments/attachment-1/versions/version-1/asset";
  const cache = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  cache.setQueryData(orpc.previewFileAttachment.queryKey({ input }), {
    ...input,
    downloadPath: path,
    gallery: { mediumPath: path, smallPath: path },
    kind: "image",
    previewPath: path,
    status: "available",
  });
  cache.setQueryData(orpc.fileAttachmentMarkings.queryKey({ input }), []);
  const refresh = vi.spyOn(cache, "invalidateQueries").mockResolvedValue();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find(
      (candidate) => candidate.textContent === label,
    );

  try {
    await act(() => {
      root.render(
        <QueryClientProvider client={cache}>
          <FileAttachmentPreviewPanel attachment={attachment} open />
        </QueryClientProvider>,
      );
    });
    await vi.waitFor(() =>
      expect(button(FILE_ATTACHMENT_UI_LABELS.retryPreview)).toBeDefined(),
    );
    act(() => button(FILE_ATTACHMENT_UI_LABELS.retryPreview)?.click());
    await vi.waitFor(() => expect(button("Draw")).toBeDefined());
    expect(fetchAsset).toHaveBeenCalledTimes(2);
    await act(async () => {
      button("Draw")?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Marking could not be saved.",
    );
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      button("Retry")?.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(create.mock.calls).toEqual([[command], [command]]);
    expect(refresh).toHaveBeenCalledExactlyOnceWith({
      queryKey: orpc.fileAttachmentMarkings.key({ input }),
    });
    expect(host.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
