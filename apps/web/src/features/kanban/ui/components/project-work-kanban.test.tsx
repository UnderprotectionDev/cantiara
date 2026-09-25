import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import ProjectWorkKanban from "./project-work-kanban";

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

function renderView(view: "Board" | "List", works: readonly WorkProfile[]) {
  const queryClient = new QueryClient();
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
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
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
        sort={{ direction: "ascending", field: "number" }}
        view={view}
        workStatusLabels={[
          { label: "Not Started", semantic: "Not Started" },
          { label: "In Progress", semantic: "In Progress" },
          { label: "Blocked", semantic: "Blocked" },
          { label: "Closed", semantic: "Closed" },
        ]}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.useRealTimers());

describe("Kanban default Work scan", () => {
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
