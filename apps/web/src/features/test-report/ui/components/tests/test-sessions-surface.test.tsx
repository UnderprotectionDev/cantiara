// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  acceptTestReport: vi.fn(),
  captured: {} as {
    onImport?: (file: { content: string; format: string }) => Promise<unknown>;
  },
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return { ...actual, client: { acceptTestReport: hoisted.acceptTestReport } };
});
vi.mock("../../views/test-sessions-view", () => ({
  TestSessionsView: (props: { onImport: never }) => {
    hoisted.captured.onImport = props.onImport;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import TestSessionsSurface from "../test-sessions-surface";

test("accepting a Test Report refreshes Test Review and the Test Summary that read the new Test Session", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.acceptTestReport.mockResolvedValue({ outcome: "accepted" });
  // Refetches of the mounted queries fail fast: there is no server here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const input = { projectId: "project-1" };
  queryClient.setQueryData(
    orpc.projectTestSessions.queryOptions({ input }).queryKey,
    { readOnly: false, sessions: [] },
  );
  const reviewKey = orpc.projectTestReview.queryOptions({ input }).queryKey;
  const summaryKey = orpc.projectTestSummary.key();
  queryClient.setQueryData(reviewKey, {} as never);
  queryClient.setQueryData(summaryKey, {});
  const root = createRoot(document.createElement("div"));
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <TestSessionsSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });

  await act(async () => {
    await hoisted.captured.onImport?.({ content: "{}", format: "json" });
  });

  expect(hoisted.acceptTestReport).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(reviewKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
  await act(async () => root.unmount());
});
