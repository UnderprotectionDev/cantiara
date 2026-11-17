// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  captured: {} as {
    actions?: { onCreateFollowUp: (signal: { id: string }) => void };
  },
  createNotificationFollowUp: vi.fn(),
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: {
      createNotificationFollowUp: hoisted.createNotificationFollowUp,
      refreshPublicRoadmapReviewSignals: () => Promise.resolve({ emitted: 0 }),
    },
  };
});
vi.mock("../notification-center-list", () => ({
  default: (props: { actions: never }) => {
    hoisted.captured.actions = props.actions;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import NotificationCenterSurface from "../notification-center-surface";

async function createFollowUp(created: boolean) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.createNotificationFollowUp.mockResolvedValue({ created });
  // Refetches of the mounted queries fail fast: there is no server here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(orpc.notificationCenter.queryOptions().queryKey, {
    sections: [],
  });
  const worksKey = orpc.projectWorks.queryOptions({
    input: { projectId: "project-1" },
  }).queryKey;
  const membershipKey = orpc.smartCollectionViews.key();
  queryClient.setQueryData(worksKey, []);
  queryClient.setQueryData(membershipKey, []);
  const root = createRoot(document.createElement("div"));
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <NotificationCenterSurface />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    hoisted.captured.actions?.onCreateFollowUp({ id: "signal-1" });
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await act(async () => root.unmount());
  return {
    membership: queryClient.getQueryState(membershipKey)?.isInvalidated,
    works: queryClient.getQueryState(worksKey)?.isInvalidated,
  };
}

test("creating follow-up Work refreshes Work lists and Smart Collection membership", async () => {
  const state = await createFollowUp(true);

  expect(hoisted.createNotificationFollowUp).toHaveBeenCalledTimes(1);
  expect(state).toEqual({ membership: true, works: true });
});

test("a replayed follow-up attempt created no Work, so Work lists stay as they are", async () => {
  const state = await createFollowUp(false);

  expect(state).toEqual({ membership: false, works: false });
});
