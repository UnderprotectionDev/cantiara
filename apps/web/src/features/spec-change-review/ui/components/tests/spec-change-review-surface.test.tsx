// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  captured: {} as {
    onConfirmFollowUp?: (...args: unknown[]) => Promise<unknown>;
    onSelect?: (id: string) => void;
  },
  createSpecChangeReviewFollowUp: vi.fn(),
}));

vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: {
      createSpecChangeReviewFollowUp: hoisted.createSpecChangeReviewFollowUp,
    },
  };
});
vi.mock("../../views/spec-change-review-view", () => ({
  SpecChangeReviewView: (props: {
    onConfirmFollowUp: never;
    onSelect: never;
  }) => {
    hoisted.captured.onConfirmFollowUp = props.onConfirmFollowUp;
    hoisted.captured.onSelect = props.onSelect;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import SpecChangeReviewSurface from "../spec-change-review-surface";

test("confirming a follow-up refreshes Work lists and Smart Collection membership because it creates Work", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.createSpecChangeReviewFollowUp.mockResolvedValue({});
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
    },
  });
  // There is no server here: mark queries invalidated without refetching the
  // mounted ones through the real oRPC client.
  const invalidate = queryClient.invalidateQueries.bind(queryClient);
  vi.spyOn(queryClient, "invalidateQueries").mockImplementation(
    (filters, options) =>
      invalidate({ ...filters, refetchType: "none" }, options),
  );
  queryClient.setQueryData(
    orpc.projectSpecChangeReviews.queryOptions({
      input: { projectId: "project-1" },
    }).queryKey,
    [],
  );
  queryClient.setQueryData(
    orpc.specChangeReview.queryOptions({ input: { reviewId: "review-1" } })
      .queryKey,
    { review: { id: "review-1" } } as never,
  );
  const worksKey = orpc.projectWorks.queryOptions({
    input: { projectId: "project-1" },
  }).queryKey;
  const membershipKey = orpc.smartCollectionViews.key();
  queryClient.setQueryData(worksKey, []);
  queryClient.setQueryData(membershipKey, []);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <SpecChangeReviewSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });
  await act(() => {
    hoisted.captured.onSelect?.("review-1");
  });

  await act(async () => {
    await hoisted.captured.onConfirmFollowUp?.(
      { identity: {} },
      {
        fingerprint: "fingerprint-1",
        plan: { reviewId: "review-1", work: { type: "Task" } },
      },
      { key: "key-1", workId: "work-1" },
    );
  });

  expect(hoisted.createSpecChangeReviewFollowUp).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(worksKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(membershipKey)?.isInvalidated).toBe(true);
  await act(async () => root.unmount());
});
