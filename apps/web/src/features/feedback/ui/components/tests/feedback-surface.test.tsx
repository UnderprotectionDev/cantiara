// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  convertFeedbackToWork: vi.fn(),
  view: {
    props: null as null | {
      onConfirmConvert: (record: unknown) => (...args: unknown[]) => unknown;
    },
  },
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { convertFeedbackToWork: rpc.convertFeedbackToWork },
  };
});
vi.mock("../../views/feedback-view", () => ({
  FeedbackView: (props: {
    onConfirmConvert: (record: unknown) => (...args: unknown[]) => unknown;
  }) => {
    rpc.view.props = props;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import FeedbackSurface from "../feedback-surface";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("Feedback surface", () => {
  test("converting Feedback to Work refreshes Smart Collection membership", async () => {
    rpc.convertFeedbackToWork.mockResolvedValue({});
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.projectFeedback.queryOptions({ input: { projectId: "project-1" } })
        .queryKey,
      { readOnly: false, records: [] },
    );
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <QueryClientProvider client={queryClient}>
          <FeedbackSurface projectId="project-1" />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await rpc.view.props?.onConfirmConvert({ id: "feedback-1" })(
        {},
        { id: "i", key: "k", workId: "w" },
      );
    });
    expect(rpc.convertFeedbackToWork).toHaveBeenCalledTimes(1);
    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(orpc.smartCollectionViews.key());
  });
});
