import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ExportHandoff } from "@/features/data-export/lib/export-handoff";

import ProjectBacklog from "../project-backlog";

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn(),
  describeExport: vi.fn<() => ExportHandoff>(),
  mutationError: false,
  search: {},
}));

vi.mock("@tanstack/react-query", async (importActual) => ({
  ...(await importActual<typeof import("@tanstack/react-query")>()),
  useMutation: () => ({ isError: mocks.mutationError, isPending: false }),
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => mocks.search,
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
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    orpc: new Proxy(actual.orpc, {
      get(target, property, receiver) {
        const overrides = {
          accountPreferences: { queryOptions: () => ({}) },
          projectBacklog: {
            queryOptions: () => ({}),
          },
          projectWorks: {
            queryOptions: () => ({}),
          },
          projectBacklogOrder: {
            queryOptions: () => ({}),
          },
          projectBacklogPresentation: {
            queryOptions: () => ({}),
          },
        };
        return (
          Reflect.get(overrides, property) ??
          Reflect.get(target, property, receiver)
        );
      },
    }),
  };
});

vi.mock("@/components/export-list-action", () => ({
  ExportListAction: ({
    describe: describeExport,
  }: {
    describe: () => ExportHandoff;
  }) => {
    mocks.describeExport.mockImplementation(describeExport);
    return null;
  },
}));

function renderBacklog(queryResult: unknown, workIds: string[] = []) {
  vi.mocked(useQuery)
    .mockReturnValueOnce(queryResult as never)
    .mockReturnValueOnce({
      data: workIds.map((id) => ({ id, type: "Task" })),
      isError: false,
      isPending: false,
    } as never)
    .mockReturnValueOnce({
      data: { revision: 0, workIds: [] },
      isPending: false,
    } as never)
    .mockReturnValueOnce({
      data: { revision: 0, saved: null },
      isPending: false,
    } as never)
    .mockReturnValueOnce({
      data: { timeZone: "UTC" },
      isPending: false,
    } as never);
  return renderToStaticMarkup(<ProjectBacklog projectId="project-1" />);
}

describe("Project Backlog", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
    mocks.mutationError = false;
    mocks.search = {};
  });

  test("shows the loading copy while its prepared collection loads", () => {
    const html = renderBacklog({ isPending: true, status: "pending" });

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
          reappearDate: null,
          revision: 0,
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

  test("reports a failed Reappear date edit", () => {
    mocks.mutationError = true;
    const html = renderBacklog({
      data: [
        {
          id: "work-1",
          key: "CANT-1",
          number: 1,
          plannedStartDate: null,
          reappearDate: null,
          revision: 0,
          status: "Not Started",
          targetDate: null,
          title: "First Work",
        },
      ],
      isError: false,
      isPending: false,
    });
    expect(html).toContain("Reappear date could not be saved. Try again.");
    expect(html).toContain('role="alert"');
  });

  test("exports the displayed Field order, including ties in manual order", () => {
    mocks.search = { backlogSort: "Field", backlogField: "Title" };
    const data = ["Work 2", "Work 10", "Work 2"].map((title, index) => ({
      id: `work-${index + 1}`,
      key: `CANT-${index + 1}`,
      number: index + 1,
      plannedStartDate: null,
      reappearDate: null,
      revision: 0,
      status: "Not Started",
      targetDate: null,
      title,
    }));
    const html = renderBacklog(
      { data, isError: false, isPending: false },
      data.map(({ id }) => id),
    );

    expect(html.match(/CANT-[123]/g)).toEqual(["CANT-2", "CANT-1", "CANT-3"]);
    expect(mocks.describeExport()).toMatchObject({
      listedIds: ["work-2", "work-1", "work-3"],
      view: { order: "listed" },
    });
    expect(mocks.describeExport().view).not.toHaveProperty("sort");
  });

  test("shows future Work in Deferred while keeping its status and manual rank available", () => {
    const html = renderBacklog(
      {
        data: [
          {
            id: "two",
            key: "CANT-2",
            number: 2,
            plannedStartDate: null,
            reappearDate: "2099-01-01",
            revision: 0,
            status: "Blocked",
            targetDate: null,
            title: "Later Work",
          },
          {
            id: "one",
            key: "CANT-1",
            number: 1,
            plannedStartDate: null,
            reappearDate: null,
            revision: 0,
            status: "Not Started",
            targetDate: null,
            title: "First Work",
          },
        ],
        isError: false,
        isPending: false,
      },
      ["one", "two"],
    );
    expect(mocks.describeExport().listedIds).toEqual(["one", "two"]);
    expect(html).toContain('aria-label="Deferred"');
    expect(html.indexOf("First Work")).toBeLessThan(html.indexOf("Deferred"));
    expect(html.indexOf("Deferred")).toBeLessThan(html.indexOf("Later Work"));
    expect(html).toContain("Reappear date");
  });
});
