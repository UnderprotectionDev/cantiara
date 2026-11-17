// @vitest-environment happy-dom
import type { TagRecord, TagSuggestion } from "@cantiara/api/tags";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({ removeTag: vi.fn() }));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return { ...actual, client: { removeTag: rpc.removeTag } };
});

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
  const queryClient = new QueryClient();
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
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    orpc.tags.queryOptions({ input: { projectId: "project-1" } }).queryKey,
    [{ projectUsageCount: 1, tag: tagSuggestions[0].tag }],
  );
  queryClient.setQueryData(
    orpc.tagRecords.queryOptions({ input: { projectId: "project-1" } })
      .queryKey,
    records,
  );
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
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
  await act(async () => root.unmount());
});
