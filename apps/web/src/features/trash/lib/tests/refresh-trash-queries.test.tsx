// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { orpc } from "@/utils/orpc";
import { useMoveToTrashFlow } from "../../hooks/use-move-to-trash-flow";

test("moving a Risk refreshes its Project without invalidating other record lists", async () => {
  const cache = new QueryClient();
  const risk = orpc.projectRisks.queryKey({ input: { projectId: "p1" } });
  const other = orpc.projectRisks.queryKey({ input: { projectId: "p2" } });
  const documents = orpc.documents.queryKey({ input: { projectId: "p1" } });
  const trash = orpc.trash.queryKey({ input: { projectId: "p1" } });
  for (const key of [risk, other, documents, trash]) {
    cache.setQueryData(key, []);
  }
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const root = createRoot(document.createElement("div"));
  const onMove = vi
    .fn()
    .mockRejectedValueOnce(new Error("Connection lost"))
    .mockResolvedValueOnce(undefined);
  let flow: ReturnType<typeof useMoveToTrashFlow> | undefined;
  function Probe() {
    flow = useMoveToTrashFlow({
      projectId: "p1",
      onMove,
      onPreview: () => Promise.resolve({ surfaces: [] } as never),
    });
    return null;
  }
  function current() {
    if (!flow) {
      throw new Error("Trash flow is unavailable.");
    }
    return flow;
  }
  await act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  await act(async () =>
    current().review({
      id: "risk-1",
      label: "Risk",
      revision: 1,
      kind: "Risk",
    }),
  );
  await vi.waitFor(() => expect(current().reviewing).toBeTruthy());
  await act(async () => current().confirm("revoke"));
  await vi.waitFor(() => expect(current().failed).toBe("Risk:risk-1"));
  await act(async () => current().confirm("revoke"));
  expect(onMove.mock.calls[1]).toEqual(onMove.mock.calls[0]);
  await act(async () => root.unmount());
  expect(cache.getQueryState(risk)?.isInvalidated).toBe(true);
  expect(cache.getQueryState(trash)?.isInvalidated).toBe(true);
  expect(cache.getQueryState(other)?.isInvalidated).toBe(false);
  expect(cache.getQueryState(documents)?.isInvalidated).toBe(false);
  cache.clear();
});
