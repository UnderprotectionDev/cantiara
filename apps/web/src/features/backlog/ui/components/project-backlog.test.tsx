import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import ProjectBacklog from "./project-backlog";

const mocks = vi.hoisted(() => ({ useQuery: vi.fn(), mutationError: false }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isError: mocks.mutationError, isPending: false }),
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="#work">{children}</a>
  ),
}));
vi.mock("@/features/priority-metrics/hooks/use-priority-metrics", () => ({
  usePriorityMetricProjectValues: () => ({ query: { data: undefined } }),
}));
vi.mock("@/features/project-shell/lib/project-shell-navigation", () => ({
  workRecordHash: (id: string) => `work-${id}`,
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
  orpc: {
    projectBacklog: {
      queryOptions: () => ({}),
    },
    projectBacklogOrder: {
      queryOptions: () => ({}),
    },
  },
}));

function renderBacklog(queryResult: unknown) {
  vi.mocked(useQuery)
    .mockReturnValueOnce(queryResult as never)
    .mockReturnValueOnce({
      data: { revision: 0, workIds: [] },
      isPending: false,
    } as never);
  return renderToStaticMarkup(<ProjectBacklog projectId="project-1" />);
}

describe("Project Backlog", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    mocks.mutationError = false;
  });

  test("shows the loading copy while its prepared collection loads", () => {
    const html = renderBacklog({ isPending: true });

    expect(html).toContain("Loading Backlog…");
    expect(html).toContain('role="status"');
  });

  test("shows a retry instruction when the prepared collection fails", () => {
    const html = renderBacklog({ isError: true });

    expect(html).toContain(
      "Backlog is unavailable. Try loading this page again.",
    );
    expect(html).toContain('role="alert"');
  });

  test("explains an empty prepared collection", () => {
    const html = renderBacklog({ data: [], isError: false, isPending: false });

    expect(html).toContain("No active Work to consider.");
  });

  test("reports a failed manual reorder without implying it was saved", () => {
    mocks.mutationError = true;
    const html = renderBacklog({
      data: [
        {
          id: "work-1",
          key: "CANT-1",
          number: 1,
          plannedStartDate: null,
          status: "Not Started",
          targetDate: null,
          title: "First Work",
        },
      ],
      isError: false,
      isPending: false,
    });

    expect(html).toContain("Backlog order could not be saved. Try again.");
    expect(html).toContain('role="alert"');
  });
});
