import type { TagRecord, TagSuggestion } from "@cantiara/api/tags";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";

import ProjectTagsSurface from "./project-tags-surface";

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
