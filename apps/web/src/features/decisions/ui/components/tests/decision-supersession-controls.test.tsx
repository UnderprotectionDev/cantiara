// @vitest-environment happy-dom
import type { DecisionSupersessionGraph } from "@cantiara/api/decision-supersession";
import { ORPCError } from "@orpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import DecisionSupersessionControls from "../decision-supersession-controls";
import { DecisionSupersessionPreviewView } from "../decision-supersession-preview";

const cancel = () => undefined;
const confirm = () => Promise.resolve();
test("Decisions preview shows both rationale and evidence, changed lives and explicit confirmation", () => {
  const record = {
    id: "old",
    projectId: "project",
    sourceType: "Decision" as const,
    title: "Original scope",
    decision: "Small release",
    rationale: "Old constraints",
    life: "Valid" as const,
    createdAt: "2026-10-08T10:00:00.000Z",
    updatedAt: "2026-10-08T10:00:00.000Z",
    revision: 1,
  };
  const html = renderToStaticMarkup(
    <DecisionSupersessionPreviewView
      onCancel={cancel}
      onConfirm={confirm}
      pending={false}
      preview={{
        graph: {
          records: [
            record,
            {
              ...record,
              id: "new",
              title: "New scope",
              rationale: "New constraints",
            },
          ],
          relations: [],
          evidence: [
            {
              id: "evidence",
              revision: 1,
              decisionId: "old",
              title: "Customer evidence",
              excerpt: "Needs a smaller release",
            },
          ],
          revision: 0,
          readOnly: false,
        },
        changes: [{ id: "old", before: "Valid", after: "Superseded" }],
        command: {
          projectId: "project",
          predecessorIds: ["old"],
          successorId: "new",
          operation: "supersede",
          rationale: "Constraints changed",
          baseRevision: 0,
          previewFingerprint: "fingerprint",
        },
      }}
    />,
  );
  expect(html).toContain("Original scope");
  expect(html).toContain("New scope");
  expect(html).toContain("Old constraints");
  expect(html).toContain("New constraints");
  expect(html).toContain("Customer evidence");
  expect(html).toContain("Valid → Superseded");
  expect(html).toContain("Constraints changed");
  expect(html).toContain("Confirm supersession");
});

const rpc = vi.hoisted(() => ({
  previewDecisionSupersession: vi.fn(),
  commitDecisionSupersession: vi.fn(),
}));
vi.mock("@/utils/orpc", async (load) => ({
  ...(await load<typeof import("@/utils/orpc")>()),
  client: rpc,
}));

test("a retry that finds a stale Supersession preview updates the inline error and blocks confirmation", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const record = {
    projectId: "project",
    sourceType: "Decision",
    decision: "Release scope",
    rationale: null,
    createdAt: "2026-10-08T10:00:00.000Z",
    updatedAt: "2026-10-08T10:00:00.000Z",
    revision: 1,
  } as const;
  const graph: DecisionSupersessionGraph = {
    records: [
      { ...record, id: "old", title: "Original scope", life: "Superseded" },
      { ...record, id: "new", title: "New scope", life: "Valid" },
    ],
    evidence: [],
    revision: 1,
    readOnly: false,
    relations: [
      {
        predecessorId: "old",
        successorId: "new",
        rationale: null,
        occurredAt: record.createdAt,
        actorId: "founder",
      },
    ],
  };
  rpc.previewDecisionSupersession.mockResolvedValue({
    graph,
    changes: [{ id: "old", before: "Superseded", after: "Valid" }],
    command: {
      projectId: "project",
      predecessorIds: ["old"],
      successorId: "new",
      operation: "remove",
      rationale: null,
      baseRevision: 1,
      previewFingerprint: "fingerprint",
    },
  });
  rpc.commitDecisionSupersession
    .mockRejectedValueOnce(new Error("Unavailable"))
    .mockRejectedValueOnce(new ORPCError("CONFLICT", { defined: true }));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(
    orpc.decisionSupersessionGraph.queryKey({
      input: { projectId: "project" },
    }),
    graph,
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function button(label: string) {
    const target = [...host.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label,
    );
    if (!target) {
      throw new Error(`${label} was not rendered`);
    }
    return target;
  }
  try {
    act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <DecisionSupersessionControls
            projectId="project"
            readOnly={false}
            selectedId="new"
          />
        </QueryClientProvider>,
      ),
    );
    act(() => button("Remove supersession").click());
    await act(async () => {
      button("Preview").click();
      await Promise.resolve();
    });
    await act(async () => {
      button("Confirm removal").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Supersession could not be saved.",
    );
    const failed = queryClient
      .getMutationCache()
      .find({ mutationKey: orpc.commitDecisionSupersession.mutationKey() });
    if (!failed) {
      throw new Error("Confirmation was not registered as a mutation");
    }
    await act(async () => {
      await expect(
        failed.execute(failed.state.variables),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(rpc.commitDecisionSupersession.mock.calls[1]).toEqual(
      rpc.commitDecisionSupersession.mock.calls[0],
    );
    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      "Decisions changed. Cancel and preview again",
    );
    expect(button("Confirm removal").disabled).toBe(true);
    act(() => button("Cancel").click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    queryClient.clear();
    host.remove();
  }
});
