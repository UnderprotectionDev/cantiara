// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  captured: {} as {
    signals?: {
      actions: { commitFollowUp: (...args: unknown[]) => Promise<unknown> };
    };
    view?: { actions: { previewClose: (id: string) => Promise<unknown> } };
  },
  commitReviewFollowUp: vi.fn(),
  previewReviewClose: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => undefined,
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { commitReviewFollowUp: hoisted.commitReviewFollowUp },
    orpc: new Proxy(actual.orpc, {
      get: (target, key) =>
        key === "previewReviewClose"
          ? {
              queryOptions: ({ input }: { input: unknown }) => ({
                queryFn: () => hoisted.previewReviewClose(input),
                queryKey: ["previewReviewClose", input],
              }),
            }
          : Reflect.get(target, key),
    }),
  };
});
vi.mock("../../views/test-review-view", () => ({
  TestReviewView: (props: { actions: never; signals: never }) => {
    hoisted.captured.signals = props.signals;
    hoisted.captured.view = { actions: props.actions };
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import TestReviewSurface from "../test-review-surface";

test("committing a review follow-up refreshes Work lists and Smart Collection membership because it creates Work", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.commitReviewFollowUp
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce({});
  // Refetches of the mounted queries fail fast: there is no server here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const input = { projectId: "project-1" };
  queryClient.setQueryData(
    orpc.projectTestReview.queryOptions({ input }).queryKey,
    { events: [], readOnly: false, resultEvents: [], sessions: [] } as never,
  );
  const worksKey = orpc.projectWorks.queryOptions({ input }).queryKey;
  const membershipKey = orpc.smartCollectionViews.key();
  const otherInput = { projectId: "project-2" };
  const otherWorksKey = orpc.projectWorks.queryOptions({
    input: otherInput,
  }).queryKey;
  const summaryKey = orpc.projectTestSummary.key({ input });
  const otherSummaryKey = orpc.projectTestSummary.key({ input: otherInput });
  queryClient.setQueryData(summaryKey, {});
  queryClient.setQueryData(otherSummaryKey, {});
  queryClient.setQueryData(worksKey, []);
  queryClient.setQueryData(otherWorksKey, []);
  queryClient.setQueryData(membershipKey, []);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <TestReviewSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });

  await act(async () => {
    await expect(
      hoisted.captured.signals?.actions.commitFollowUp(
        ["session-test-1"],
        { mode: "new", workType: "Task" },
        { fingerprint: "fingerprint-1" },
      ),
    ).rejects.toThrow("Connection interrupted");
  });
  const [failed] = queryClient.getMutationCache().getAll();
  if (!failed) {
    throw new Error("Expected a recorded follow-up mutation");
  }
  await act(async () => {
    await failed.execute(failed.state.variables);
  });

  expect(hoisted.commitReviewFollowUp).toHaveBeenCalledTimes(2);
  expect(hoisted.commitReviewFollowUp.mock.calls[1]).toEqual(
    hoisted.commitReviewFollowUp.mock.calls[0],
  );
  expect(queryClient.getQueryState(worksKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(membershipKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(otherWorksKey)?.isInvalidated).toBe(false);
  expect(queryClient.getQueryState(otherSummaryKey)?.isInvalidated).toBe(false);
  await act(async () => root.unmount());
});

test("the close preview is read through TanStack Query", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.previewReviewClose.mockResolvedValue({
    remaining: [],
    sessionState: "Open",
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    orpc.projectTestReview.queryOptions({ input: { projectId: "project-1" } })
      .queryKey,
    { events: [], readOnly: false, resultEvents: [], sessions: [] } as never,
  );
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <TestReviewSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });
  const addedKeys: unknown[] = [];
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "added") {
      addedKeys.push(event.query.queryKey);
    }
  });
  let preview: unknown;
  await act(async () => {
    preview = await hoisted.captured.view?.actions.previewClose("session-1");
  });
  expect(preview).toEqual({ remaining: [], sessionState: "Open" });
  expect(hoisted.previewReviewClose).toHaveBeenCalledWith({
    projectId: "project-1",
    sessionId: "session-1",
  });
  expect(addedKeys).toContainEqual([
    "previewReviewClose",
    { projectId: "project-1", sessionId: "session-1" },
  ]);
  await act(async () => root.unmount());
});
