// @vitest-environment happy-dom

import type {
  FocusPeriodRecord,
  FocusPeriodSnapshotWork,
} from "@cantiara/api/focus-period";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { PeriodLeftoverDecisions } from "../focus-period-leftover-form";

const rpc = vi.hoisted(() => ({
  closeWork: vi.fn(),
  fetchCurrentWork: vi.fn(),
  workClosePreview: vi.fn(),
}));

vi.mock("@/lib/fetch-current-work", () => ({
  fetchCurrentWork: rpc.fetchCurrentWork,
}));

vi.mock("@/utils/orpc", async (importActual) => ({
  ...(await importActual<typeof import("@/utils/orpc")>()),
  client: { closeWork: rpc.closeWork, workClosePreview: rpc.workClosePreview },
}));

const snapshot: FocusPeriodSnapshotWork[] = ["first", "second", "third"].map(
  (id) => ({
    closureResult: null,
    id,
    key: `WORK-${id}`,
    projectId: "project",
    projectName: "Project",
    status: "In Progress",
    title: id,
  }),
);

const period: FocusPeriodRecord = {
  available: [],
  closeComparison: null,
  closedAt: "2026-09-08T12:00:00Z",
  closeSnapshot: snapshot,
  dependencies: { cycles: [], edges: [], nodes: [] },
  endDate: "2026-09-08",
  evaluation: null,
  followUpWorks: [],
  id: "period",
  leftoverDecisions: [],
  members: [],
  purpose: "Finish the current work",
  startDate: "2026-09-01",
  startSnapshot: snapshot,
  status: "Closed",
};

test.each(["Backlog", "Abandon"] as const)(
  "%s sends only selected available Work and keeps the failed selection for retry",
  async (destination) => {
    const closedWorkIds = new Set<string>();
    rpc.closeWork.mockReset();
    rpc.closeWork.mockImplementation(({ workId }: { workId: string }) => {
      closedWorkIds.add(workId);
      return Promise.resolve();
    });
    rpc.fetchCurrentWork.mockImplementation((_, workId: string) =>
      Promise.resolve(
        closedWorkIds.has(workId)
          ? { closureResult: "Abandoned", status: "Closed" }
          : { revision: 1, status: "In Progress" },
      ),
    );
    rpc.workClosePreview.mockResolvedValue({
      closureCheck: { activeBlockers: [], incompleteChecklistItems: [] },
    });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const client = new QueryClient();
    const decide = {
      mutateAsync: vi
        .fn<
          Parameters<typeof PeriodLeftoverDecisions>[0]["decide"]["mutateAsync"]
        >()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Try again"))
        .mockResolvedValueOnce(undefined),
    };
    const performAction = (action: () => Promise<unknown>) =>
      action().then(() => undefined);
    function render(undecided: FocusPeriodSnapshotWork[]) {
      act(() => {
        root.render(
          <QueryClientProvider client={client}>
            <PeriodLeftoverDecisions
              act={performAction}
              decide={decide}
              period={period}
              targets={[]}
              undecided={undecided}
            />
          </QueryClientProvider>,
        );
      });
    }
    const checkbox = (id: string) =>
      container.querySelector<HTMLInputElement>(`#focus-period-leftover-${id}`);
    async function send() {
      await act(() => {
        container
          .querySelector("form")
          ?.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true }),
          );
      });
    }

    try {
      render(snapshot);
      for (const work of snapshot) {
        act(() => checkbox(work.id)?.click());
      }

      render([snapshot[1], snapshot[2]]);
      if (destination === "Abandon") {
        const select = container.querySelector<HTMLSelectElement>(
          "#focus-period-leftover-destination",
        );
        if (!select) {
          throw new Error("Missing Destination control");
        }
        act(() => {
          select.value = destination;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        });
        act(() => {
          container
            .querySelector<HTMLElement>("#focus-period-confirm-abandon-period")
            ?.click();
        });
      }
      await send();

      expect(
        decide.mutateAsync.mock.calls.map(([input]) => input.workIds),
      ).toEqual([["second"], ["third"]]);
      expect(checkbox("second")?.checked).toBe(false);
      expect(checkbox("third")?.checked).toBe(true);

      await send();
      expect(decide.mutateAsync).toHaveBeenCalledTimes(3);
      expect(decide.mutateAsync).toHaveBeenLastCalledWith({
        destination,
        periodId: "period",
        workIds: ["third"],
      });
      expect(checkbox("third")?.checked).toBe(false);
      expect(rpc.closeWork.mock.calls.map(([input]) => input.workId)).toEqual(
        destination === "Abandon" ? ["second", "third"] : [],
      );

      render(snapshot);
      expect(checkbox("first")?.checked).toBe(false);
    } finally {
      act(() => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
    }
  },
);
