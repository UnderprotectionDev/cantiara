// @vitest-environment happy-dom
import type { TagRecord, TagSuggestion } from "@cantiara/api/tags";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  removeTag: vi.fn(),
  renameTag: vi.fn(),
  undoTagRename: vi.fn(),
}));

vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return { ...actual, client: rpc };
});

import { createClientShellQueryClient } from "@/features/web-macos-client/lib/client-shell";
import { orpc } from "@/utils/orpc";

import ProjectTagsSurface from "../project-tags-surface";

const tagSuggestions: TagSuggestion[] = [
  {
    projectUsageCount: 2,
    tag: {
      createdAt: "2026-09-20T09:00:00.000Z",
      id: "tag-1",
      name: "roadmap/next",
      revision: 0,
      updatedAt: "2026-09-20T09:00:00.000Z",
    },
  },
  {
    projectUsageCount: 0,
    tag: {
      createdAt: "2026-09-20T09:01:00.000Z",
      id: "tag-2",
      name: "customer",
      revision: 0,
      updatedAt: "2026-09-20T09:01:00.000Z",
    },
  },
];

const records: TagRecord[] = [
  {
    archivedAt: null,
    id: "work-1",
    key: "PAY-1",
    projectId: "project-1",
    recordType: "Work",
    tags: [tagSuggestions[0].tag],
    title: "Prepare launch",
  },
];

function renderSurface() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(
    orpc.tags.queryOptions({ input: { projectId: "project-1" } }).queryKey,
    tagSuggestions,
  );
  queryClient.setQueryData(
    orpc.tagRecords.queryOptions({ input: { projectId: "project-1" } })
      .queryKey,
    records,
  );

  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <ProjectTagsSurface projectId="project-1" />
    </QueryClientProvider>,
  );
}

describe("Project Tags surface", () => {
  test("uses the English Tags controls and shows Workspace suggestions", () => {
    const html = renderSurface();

    expect(html).toContain(">Tags</h2>");
    expect(html).toContain("Name");
    expect(html).toContain("Create tag");
    expect(html).toContain("Filter by tag");
    expect(html).toContain("Rename Tag");
    expect(html).toContain("New name");
    expect(html).toContain("All tags");
    expect(html).toContain("roadmap/next");
    expect(html).toContain("Suggested in this Project");
    expect(html).toContain("Apply tag");
    expect(html).toContain("Remove tag");
  });

  test("does not present a hierarchy or Project-local dictionary", () => {
    const html = renderSurface();

    expect(html).not.toContain("Tag hierarchy");
    expect(html).not.toContain("Project-local");
    expect(html).not.toContain("Merge tags");
  });
});

test("removing a tag also refreshes Smart Collection membership because collections match tag identity", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  rpc.removeTag.mockReset();
  rpc.removeTag.mockResolvedValue({});
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(
    orpc.tags.queryOptions({ input: { projectId: "project-1" } }).queryKey,
    [{ projectUsageCount: 1, tag: tagSuggestions[0].tag }],
  );
  queryClient.setQueryData(
    orpc.tagRecords.queryOptions({ input: { projectId: "project-1" } })
      .queryKey,
    records,
  );
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    await Promise.resolve();
    root.render(
      <QueryClientProvider client={queryClient}>
        <ProjectTagsSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });
  invalidate.mockClear();
  const button = container.querySelector<HTMLButtonElement>(
    'button[aria-label="Remove tag roadmap/next from Prepare launch"]',
  );
  await act(async () => {
    await Promise.resolve();
    button?.click();
  });
  expect(rpc.removeTag).toHaveBeenCalledOnce();
  for (const queryKey of [
    orpc.smartCollectionViews.key(),
    orpc.documentLiveOtherBlocks.key(),
  ]) {
    expect(invalidate).toHaveBeenCalledWith({ queryKey });
  }
  act(() => root.unmount());
});

test("retries Undo with its original Tag command and refreshes the affected queries", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const presentFailure = vi.fn();
  const queryClient = createClientShellQueryClient(presentFailure);
  queryClient.setDefaultOptions({
    queries: { staleTime: Number.POSITIVE_INFINITY },
  });
  const tagsKey = orpc.tags.queryKey({ input: { projectId: "project-1" } });
  queryClient.setQueryData(tagsKey, tagSuggestions);
  queryClient.setQueryData(
    orpc.tagRecords.queryKey({ input: { projectId: "project-1" } }),
    records,
  );
  const invalidate = vi
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue();
  rpc.renameTag.mockResolvedValue({
    receiptId: "rename-receipt",
    tag: { ...tagSuggestions[0].tag, name: "roadmap/later", revision: 1 },
  });
  rpc.undoTagRename
    .mockRejectedValueOnce(new Error("Undo failed."))
    .mockResolvedValue({});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function undoButton() {
    return [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Undo",
    );
  }
  try {
    await act(async () => {
      await Promise.resolve();
      root.render(
        <QueryClientProvider client={queryClient}>
          <ProjectTagsSurface projectId="project-1" />
        </QueryClientProvider>,
      );
    });
    const form = host.querySelector('form[aria-label="Rename Tag"]');
    const select = form?.querySelector("select");
    const name = form?.querySelector("input");
    if (!(form && select && name)) {
      throw new Error("Rename Tag form did not render");
    }
    await act(async () => {
      await Promise.resolve();
      select.value = "tag-1";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(name, "roadmap/later");
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      await Promise.resolve();
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await vi.waitFor(() => expect(undoButton()).toBeDefined());
    invalidate.mockClear();
    await act(async () => {
      undoButton()?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await vi.waitFor(() => expect(host.textContent).toContain("Undo failed."));
    expect(undoButton()).toBeDefined();
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => {
      await presentFailure.mock.calls[0]?.[1].retry?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(rpc.undoTagRename).toHaveBeenCalledTimes(2);
    expect(rpc.undoTagRename.mock.calls[1][0]).toEqual(
      rpc.undoTagRename.mock.calls[0][0],
    );
    expect(
      invalidate.mock.calls.every(([filters]) => Boolean(filters?.queryKey)),
    ).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: orpc.tags.key() });
    expect(host.textContent).not.toContain("Undo failed.");
    expect(undoButton()).toBeUndefined();
  } finally {
    act(() => root.unmount());
    host.remove();
    queryClient.clear();
  }
});
