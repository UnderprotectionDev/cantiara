// @vitest-environment happy-dom
import type { PersonalMoodboardView } from "@cantiara/api/moodboard-viewport";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

const saveMoodboardPersonalView = vi.hoisted(() => vi.fn());

vi.mock("@/utils/orpc", () => ({
  client: { saveMoodboardPersonalView },
  orpc: {
    moodboardPersonalView: {
      queryOptions: () => ({
        queryFn: () => ({ collapsed: [], viewport: null }),
        queryKey: ["moodboardPersonalView", "m1"],
      }),
    },
  },
}));

import { usePersonalMoodboardView } from "../use-personal-moodboard-view";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.useRealTimers();
  saveMoodboardPersonalView.mockReset();
});

test("the last personal view is saved once after the delay and flushed on leaving", async () => {
  vi.useFakeTimers();
  saveMoodboardPersonalView.mockResolvedValue({});
  let schedule: ((view: PersonalMoodboardView) => void) | undefined;
  function Probe() {
    ({ schedule } = usePersonalMoodboardView("m1"));
    return null;
  }
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    await Promise.resolve();
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  const first: PersonalMoodboardView = {
    collapsed: [],
    viewport: { centerX: 1, centerY: 1, zoom: 1 },
  };
  const last: PersonalMoodboardView = {
    collapsed: [],
    viewport: { centerX: 2, centerY: 2, zoom: 2 },
  };

  act(() => {
    schedule?.(first);
    schedule?.(last);
  });
  expect(saveMoodboardPersonalView).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(700);
  });
  expect(saveMoodboardPersonalView).toHaveBeenCalledTimes(1);
  expect(saveMoodboardPersonalView.mock.calls[0]?.[0]).toMatchObject({
    moodboardId: "m1",
    view: last,
  });

  act(() => schedule?.(first));
  act(() => root.unmount());
  await vi.advanceTimersByTimeAsync(0);
  expect(saveMoodboardPersonalView).toHaveBeenCalledTimes(2);
  expect(saveMoodboardPersonalView.mock.calls[1]?.[0]).toMatchObject({
    view: first,
  });
});
