// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import { useProjectWallRelation } from "../use-project-wall-relation";

const write = vi.hoisted(() => vi.fn());
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return { ...actual, client: { createProjectWallPersistentRelation: write } };
});

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test("resubmitting the same reviewed Project Wall relation preserves its command and refreshes that wall", async () => {
  write
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValue({});
  const cache = new QueryClient();
  const root = createRoot(document.createElement("div"));
  const affected = orpc.projectWall.queryKey({
    input: { projectId: "p1", wallId: "w1" },
  });
  const other = orpc.projectWall.queryKey({
    input: { projectId: "p1", wallId: "w2" },
  });
  for (const queryKey of [affected, other]) {
    cache.getQueryCache().build(cache, { queryKey });
  }
  let relation: ReturnType<typeof useProjectWallRelation> | undefined;
  function Probe() {
    relation = useProjectWallRelation("p1", "w1");
    return null;
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={cache}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
    const input = {
      baseRevision: 2,
      kind: "Related" as const,
      linkId: "l1",
      previewId: "preview-1",
    };
    await act(async () => {
      await expect(relation?.mutateAsync(input)).rejects.toThrow(
        "Connection interrupted",
      );
    });
    await vi.waitFor(() => expect(relation?.isError).toBe(true));
    await act(async () => relation?.mutateAsync(input));
    expect(write.mock.calls[1]).toEqual(write.mock.calls[0]);
    expect(cache.getQueryState(affected)?.isInvalidated).toBe(true);
    expect(cache.getQueryState(other)?.isInvalidated).toBe(false);
  } finally {
    await act(async () => root.unmount());
    cache.clear();
  }
});
