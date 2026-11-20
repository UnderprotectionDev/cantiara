// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({ saveProjectClosureSummary: vi.fn() }));

vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: {
      ...actual.client,
      saveProjectClosureSummary: rpc.saveProjectClosureSummary,
    },
  };
});

import { orpc } from "@/utils/orpc";
import { useSaveClosureSummary } from "../use-save-closure-summary";

test("saving the Closure Summary as a Document refreshes the Documents lists", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  rpc.saveProjectClosureSummary.mockResolvedValue({ id: "doc-1" });
  const queryClient = new QueryClient();
  const documentsKey = orpc.documents.queryOptions({
    input: { projectId: "project-1" },
  }).queryKey;
  queryClient.setQueryData(documentsKey, []);
  const unrelated = orpc.documents.queryKey({
    input: { projectId: "project-2" },
  });
  queryClient.setQueryData(unrelated, []);
  const save = vi.fn();
  function Probe() {
    const mutation = useSaveClosureSummary();
    save.mockImplementation(() =>
      mutation.mutateAsync({
        baseRevision: 0,
        body: "# Closure",
        clientIdempotencyKey: "key-1",
        projectId: "project-1",
        title: "Closure Summary",
      }),
    );
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });

  await act(async () => {
    await save();
  });

  expect(queryClient.getQueryState(documentsKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(unrelated)?.isInvalidated).toBe(false);
  await act(async () => root.unmount());
});
