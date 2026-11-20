// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  captured: {} as { onCreate?: (values: unknown) => Promise<unknown> },
  createTestGap: vi.fn(),
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return { ...actual, client: { createTestGap: hoisted.createTestGap } };
});
vi.mock("../../views/test-gaps-view", () => ({
  TestGapsView: (props: { onCreate: never }) => {
    hoisted.captured.onCreate = props.onCreate;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import TestGapsSurface from "../test-gaps-surface";

test("filing a Test Gap refreshes the Test Summary that lists Test Gaps", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.createTestGap.mockResolvedValue({});
  // Refetches of the mounted queries fail fast: there is no server here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const input = { projectId: "project-1" };
  queryClient.setQueryData(
    orpc.projectTestGaps.queryOptions({ input }).queryKey,
    { gaps: [], readOnly: false },
  );
  queryClient.setQueryData(
    orpc.projectPlannedTestCases.queryOptions({ input }).queryKey,
    { cases: [], readOnly: false },
  );
  queryClient.setQueryData(
    orpc.projectTestHandoffs.queryOptions({ input }).queryKey,
    { handoffs: [], readOnly: false },
  );
  queryClient.setQueryData(
    orpc.projectSessionTests.queryOptions({ input }).queryKey,
    { readOnly: false, sessionTests: [] },
  );
  const summaryKey = orpc.projectTestSummary.queryKey({
    input: { projectId: "project-1", scope: { kind: "Project" } },
  });
  queryClient.setQueryData(summaryKey, {
    attention: [],
    sections: [],
    scope: { kind: "Project", id: "project-1", label: "Project" },
  });
  const root = createRoot(document.createElement("div"));
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <TestGapsSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });

  await act(async () => {
    await hoisted.captured.onCreate?.({
      rationale: "No test",
      relations: [],
      title: "Gap",
    });
  });

  expect(hoisted.createTestGap).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
  await act(async () => root.unmount());
});
