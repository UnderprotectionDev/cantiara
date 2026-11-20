// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));

import { orpc } from "@/utils/orpc";
import { useProjectReleaseCommand } from "../use-project-release-command";

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

describe("useProjectReleaseCommand", () => {
  test("a saved Project Release refreshes membership even when post-save navigation rejects", async () => {
    const queryClient = new QueryClient();
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    let run: ReturnType<typeof useProjectReleaseCommand> | null = null;
    function Probe() {
      run = useProjectReleaseCommand("project-1");
      return null;
    }
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await expect(
        run?.(
          { id: "x" },
          () => Promise.resolve("ok"),
          () => Promise.reject(new Error("Route failed")),
        ),
      ).resolves.toBe("ok");
    });
    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(orpc.smartCollectionViews.key());
  });
});
