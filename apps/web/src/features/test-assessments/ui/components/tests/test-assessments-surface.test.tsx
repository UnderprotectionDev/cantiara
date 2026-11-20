// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  captured: {} as { onRecord?: (values: unknown) => Promise<unknown> },
  recordTestAssessment: vi.fn(),
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { recordTestAssessment: hoisted.recordTestAssessment },
  };
});
vi.mock("../../../lib/test-assessment-form", () => ({
  toRecordInput: () => ({ projectId: "project-1" }),
}));
vi.mock("../../views/test-assessments-view", () => ({
  TestAssessmentsView: (props: { onRecord: never }) => {
    hoisted.captured.onRecord = props.onRecord;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import TestAssessmentsSurface from "../test-assessments-surface";

test("recording a Test Assessment refreshes the Test Summary that lists Test Assessments", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.recordTestAssessment.mockResolvedValue({});
  // Refetches of the mounted queries fail fast: there is no server here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(
    orpc.projectTestAssessments.queryOptions({
      input: { projectId: "project-1" },
    }).queryKey,
    { assessments: [] },
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
        <TestAssessmentsSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });

  await act(async () => {
    await hoisted.captured.onRecord?.({});
  });

  expect(hoisted.recordTestAssessment).toHaveBeenCalledTimes(1);
  expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true);
  await act(async () => root.unmount());
});
