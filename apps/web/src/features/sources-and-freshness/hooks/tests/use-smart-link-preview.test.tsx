// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({ smartLinkPreview: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
  orpc: {
    smartLinkPreview: {
      queryOptions: ({ input }: { input: { url: string } }) => ({
        queryFn: () => rpc.smartLinkPreview(input),
        queryKey: ["smartLinkPreview", input],
      }),
    },
  },
}));

import { useSmartLinkPreview } from "../use-smart-link-preview";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

test("Smart link preview reads through TanStack Query and never reuses an earlier preview", async () => {
  rpc.smartLinkPreview.mockResolvedValue({ kind: "preview" });
  const cache = new QueryClient();
  const fetchQuery = vi.spyOn(cache, "fetchQuery");
  let read: ((url: string) => Promise<unknown>) | undefined;
  function Probe() {
    read = useSmartLinkPreview();
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  await read?.("https://example.org/a");
  await read?.("https://example.org/a");
  expect(fetchQuery).toHaveBeenCalledTimes(2);
  expect(rpc.smartLinkPreview).toHaveBeenCalledTimes(2);
  expect(rpc.smartLinkPreview).toHaveBeenCalledWith({
    url: "https://example.org/a",
  });
  act(() => root.unmount());
});
