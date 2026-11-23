// @vitest-environment happy-dom

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProjectWorkSort } from "@cantiara/api/project-shell";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ContextRecordPreviewProvider } from "@/features/record-discovery/ui/components/context-record-preview";
import { orpc } from "@/utils/orpc";
import ProjectWorkKanban from "../project-work-kanban";

vi.mock("@/features/web-macos-client/hooks/use-client-shell", () => ({
  useClientShellConnection: () => "online",
}));

const onExplicitStatusAction = () => undefined;

const work = (
  number: number,
  overrides: Partial<WorkProfile> = {},
): WorkProfile => ({
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-20T09:00:00.000Z",
  description: null,
  effort: null,
  featureHealthHistory: [],
  id: `work-${number}`,
  key: `CAN-${number}`,
  number,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  statusChangedAt: "2026-09-20T09:00:00.000Z",
  targetDate: null,
  title: `Work ${number}`,
  type: "Task",
  updatedAt: "2026-09-20T09:00:00.000Z",
  ...overrides,
});

function kanbanElement(
  view: "Board" | "List",
  works: readonly WorkProfile[],
  sort: ProjectWorkSort = { direction: "ascending", field: "number" },
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(
    orpc.projectWorks.queryOptions({
      input: { archived: false, projectId: "project-1" },
    }).queryKey,
    [...works],
  );
  for (const item of works) {
    queryClient.setQueryData(
      orpc.workContext.queryOptions({ input: { workId: item.id } }).queryKey,
      { priorityValues: {}, relations: [] },
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <ContextRecordPreviewProvider>
        <ProjectWorkKanban
          accountFormattingPreferences={DEFAULT_ACCOUNT_PREFERENCES}
          focusThreshold={null}
          onExplicitStatusAction={onExplicitStatusAction}
          projectId="project-1"
          softWipLimits={{
            Blocked: null,
            Closed: null,
            "In Progress": null,
            "Not Started": null,
          }}
          sort={sort}
          view={view}
          workStatusLabels={[
            { label: "Not Started", semantic: "Not Started" },
            { label: "In Progress", semantic: "In Progress" },
            { label: "Blocked", semantic: "Blocked" },
            { label: "Closed", semantic: "Closed" },
          ]}
        />
      </ContextRecordPreviewProvider>
    </QueryClientProvider>
  );
}

function renderView(view: "Board" | "List", works: readonly WorkProfile[]) {
  return renderToStaticMarkup(kanbanElement(view, works));
}

afterEach(() => vi.useRealTimers());

describe("Kanban default Work scan", () => {
  test("a mounted List shows newly eligible Work when the Account day changes", () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T20:59:45.000Z"));
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      act(() =>
        root.render(
          kanbanElement("List", [
            work(1, { reappearDate: "2026-09-26", status: "Blocked" }),
          ]),
        ),
      );
      expect(host.textContent).not.toContain("CAN-1");
      act(() => vi.advanceTimersByTime(30_000));
      expect(host.textContent).toContain("CAN-1");
      expect(host.textContent).toContain("Blocked");
    } finally {
      act(() => root.unmount());
      host.remove();
      vi.unstubAllGlobals();
    }
  });

  test.each(["Board", "List"] as const)(
    "%s keeps undated Work last and breaks Reappear date ties by Work number",
    (view) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-27T12:00:00Z"));
      const works = [
        work(4),
        work(3, { reappearDate: "2026-09-25" }),
        work(2, { reappearDate: "2026-09-26" }),
        work(1, { reappearDate: "2026-09-25" }),
      ];
      const html = renderToStaticMarkup(
        kanbanElement(view, works, {
          direction: "descending",
          field: "reappearDate",
        }),
      );

      expect(html.indexOf("CAN-2")).toBeLessThan(html.indexOf("CAN-1"));
      expect(html.indexOf("CAN-1")).toBeLessThan(html.indexOf("CAN-3"));
      expect(html.indexOf("CAN-3")).toBeLessThan(html.indexOf("CAN-4"));
      expect(html).toContain("CAN-4");
    },
  );

  test.each(["Board", "List"] as const)(
    "%s follows saved sort over source order and backgrounds future or archived Work",
    (view) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-24T22:00:00.000Z"));
      const works = [
        work(3),
        work(1),
        work(4, { reappearDate: "2026-09-26", status: "Blocked" }),
        work(2),
        work(5, { archivedAt: "2026-09-20T09:00:00.000Z" }),
      ];

      const html = renderView(view, works);

      expect(html.indexOf("CAN-1")).toBeLessThan(html.indexOf("CAN-2"));
      expect(html.indexOf("CAN-2")).toBeLessThan(html.indexOf("CAN-3"));
      expect(html).not.toContain("CAN-4");
      expect(html).not.toContain("CAN-5");
      expect(works[2]?.status).toBe("Blocked");

      vi.setSystemTime(new Date("2026-09-25T21:00:00.000Z"));
      expect(renderView(view, works)).toContain("CAN-4");
    },
  );
});
