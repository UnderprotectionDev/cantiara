// @vitest-environment happy-dom
import type { FeedbackRecord } from "@cantiara/api/feedback";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  convertFeedbackToWork: vi.fn(),
  previewFeedbackWork: vi.fn(),
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: rpc,
  };
});
vi.mock("../../views/feedback-view", async () => {
  const { ConvertToWorkDialog } = await import("../convert-to-work-dialog");
  const record = {
    id: "feedback-1",
    title: "Improve checkout",
  } as FeedbackRecord;
  const close = () => undefined;
  return {
    FeedbackView: (
      props: Pick<
        React.ComponentProps<
          typeof import("../../views/feedback-view").FeedbackView
        >,
        "onConfirmConvert" | "onPreviewConvert"
      >,
    ) => (
      <ConvertToWorkDialog
        onClose={close}
        onConfirm={props.onConfirmConvert(record)}
        onPreview={props.onPreviewConvert(record)}
        record={record}
      />
    ),
  };
});

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
    rpc.convertFeedbackToWork
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce({});
    rpc.previewFeedbackWork.mockResolvedValue({
      targetProject: { id: "project-1", name: "Project" },
      work: {
        type: "Task",
        title: "Improve checkout",
        description: "Remove a step",
      },
    });
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
    function button(label: string) {
      return [...document.body.querySelectorAll("button")].find(
        (entry) => entry.textContent === label,
      );
    }
    await act(async () => button("Preview")?.click());
    await vi.waitFor(() => expect(button("Confirm")?.disabled).toBe(false));
    await act(async () => button("Confirm")?.click());
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        "The Work could not be created.",
      ),
    );
    await act(async () => button("Confirm")?.click());
    await vi.waitFor(() =>
      expect(rpc.convertFeedbackToWork).toHaveBeenCalledTimes(2),
    );
    expect(rpc.convertFeedbackToWork.mock.calls[1]).toEqual(
      rpc.convertFeedbackToWork.mock.calls[0],
    );
    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(orpc.smartCollectionViews.key());
  });
});
