// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  captured: {} as {
    onCreate?: (values: unknown) => Promise<unknown>;
    onCreateHandoff?: (values: unknown) => Promise<unknown>;
  },
  createPlannedTestCase: vi.fn(),
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { createPlannedTestCase: hoisted.createPlannedTestCase },
  };
});
vi.mock("../../views/planned-tests-view", () => ({
  PlannedTestsView: (props: { onCreate: never }) => {
    hoisted.captured.onCreate = props.onCreate;
    return null;
  },
}));
vi.mock("../../views/test-handoffs-view", () => ({
  TestHandoffsView: () => null,
}));
vi.mock("../../views/session-tests-view", () => ({
  SessionTestsView: () => null,
}));

import { orpc } from "@/utils/orpc";
import PlannedTestsSurface from "../planned-tests-surface";

test("creating a Planned Test Case refreshes the Test Summary that lists its scenarios", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.createPlannedTestCase.mockResolvedValue({});
  // Refetches of the mounted queries fail fast: there is no server here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const input = { projectId: "project-1" };
  queryClient.setQueryData(
    orpc.projectPlannedTestCases.queryOptions({ input }).queryKey,
    { cases: [], readOnly: false },
  );
  queryClient.setQueryData(
    orpc.projectSessionTests.queryOptions({ input }).queryKey,
    { readOnly: false, sessionTests: [] },
  );
  queryClient.setQueryData(
    orpc.projectTestHandoffs.queryOptions({ input }).queryKey,
    { handoffs: [], readOnly: false },
  );
  const summaryKey = orpc.projectTestSummary.key();
  queryClient.setQueryData(summaryKey, {});
  const root = createRoot(document.createElement("div"));
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <PlannedTestsSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });

  await act(async () => {
    await hoisted.captured.onCreate?.({ relations: [], title: "Login" });
  });

  expect(hoisted.createPlannedTestCase).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
  await act(async () => root.unmount());
});
