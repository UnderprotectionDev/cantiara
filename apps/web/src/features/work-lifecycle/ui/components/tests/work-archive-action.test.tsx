// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { WorkArchiveAction } from "../project-work-list";

const rpc = vi.hoisted(() => ({ archiveWork: vi.fn() }));
vi.mock("@/features/web-macos-client/hooks/use-client-shell", () => ({
  useClientShellConnection: () => "online",
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", () => {
  const options = (name: string) => ({
    queryKey: ({ input }: { input?: unknown } = {}) => [name, input],
    queryOptions: ({ input }: { input?: unknown } = {}) => ({
      queryKey: [name, input],
    }),
  });
  return {
    client: rpc,
    orpc: {
      projectWorks: options("projectWorks"),
      scopeTree: options("scopeTree"),
      work: options("work"),
    },
    projectWorksQueryPrefix: ["projectWorksPrefix"],
    invalidateSmartCollectionMembership: (queries: QueryClient) =>
      [["smartCollectionViews"]].map((queryKey) =>
        queries.invalidateQueries({ queryKey }),
      ),
  };
});

test("archiving a Work refreshes Smart Collection membership", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const cache = new QueryClient();
  const invalidate = vi.spyOn(cache, "invalidateQueries");
  const work = {
    archivedAt: null,
    id: "w1",
    projectId: "p1",
    revision: 1,
  } as WorkProfile;
  rpc.archiveWork.mockResolvedValue({
    ...work,
    archivedAt: "2026-11-20T00:00:00Z",
  });
  await act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <WorkArchiveAction work={work} />
      </QueryClientProvider>,
    ),
  );
  await act(async () => container.querySelector("button")?.click());
  expect(rpc.archiveWork).toHaveBeenCalled();
  expect(invalidate.mock.calls.map(([f]) => f?.queryKey)).toContainEqual([
    "smartCollectionViews",
  ]);
  root.unmount();
});
