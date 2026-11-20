// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({ bindFileAttachmentLocation: vi.fn() }));

vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { bindFileAttachmentLocation: rpc.bindFileAttachmentLocation },
  };
});

import { orpc } from "@/utils/orpc";
import { useBindFileAttachmentLocation } from "../use-bind-file-attachment-location";

test("binding a location refreshes Work lists, Work reads and Smart Collection membership", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  rpc.bindFileAttachmentLocation.mockResolvedValue({
    work: { id: "work-1", projectId: "project-1" },
  });
  const queryClient = new QueryClient();
  const worksKey = orpc.projectWorks.queryOptions({
    input: { projectId: "project-1" },
  }).queryKey;
  const workKey = orpc.work.queryOptions({
    input: { workId: "work-1" },
  }).queryKey;
  const unrelatedWorksKey = orpc.projectWorks.queryOptions({
    input: { projectId: "project-2" },
  }).queryKey;
  const unrelatedWorkKey = orpc.work.queryOptions({
    input: { workId: "work-2" },
  }).queryKey;
  const membershipKey = orpc.smartCollectionViews.key();
  for (const key of [
    worksKey,
    workKey,
    membershipKey,
    unrelatedWorksKey,
    unrelatedWorkKey,
  ]) {
    queryClient.setQueryData(key, []);
  }
  let bind: (() => Promise<unknown>) | undefined;
  function Probe() {
    const mutation = useBindFileAttachmentLocation();
    bind = () => mutation.mutateAsync({} as never);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });

  await act(async () => {
    await bind?.();
  });

  expect(queryClient.getQueryState(worksKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(workKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(membershipKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(unrelatedWorksKey)?.isInvalidated).toBe(
    false,
  );
  expect(queryClient.getQueryState(unrelatedWorkKey)?.isInvalidated).toBe(
    false,
  );
  await act(async () => root.unmount());
});
