// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import WorkMergeForm from "../work-merge-form";

const rpc = vi.hoisted(() => ({
  mergeWork: vi.fn(),
  workMergePreview: vi.fn(),
}));
vi.mock("@/features/web-macos-client/hooks/use-client-shell", () => ({
  useClientShellConnection: () => "online",
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: rpc,
    orpc: new Proxy(actual.orpc, {
      get(target, property, receiver) {
        const overrides = {
          projectWorks: {
            queryOptions: ({ input }: { input: unknown }) => ({
              queryKey: ["projectWorks", input],
            }),
          },
          smartCollectionViews: { key: () => ["smartCollectionViews"] },
          documentLiveOtherBlocks: { key: () => ["documentLiveOtherBlocks"] },
          work: {
            queryOptions: ({ input }: { input: unknown }) => ({
              queryKey: ["work", input],
            }),
          },
        };
        return (
          Reflect.get(overrides, property) ??
          Reflect.get(target, property, receiver)
        );
      },
    }),
    projectWorksQueryPrefix: ["projectWorksPrefix"],
    invalidateSmartCollectionMembership: (queries: QueryClient) =>
      [["smartCollectionViews"], ["documentLiveOtherBlocks"]].map((queryKey) =>
        queries.invalidateQueries({ queryKey }),
      ),
  };
});

const work = { id: "w1", key: "A-1", projectId: "p1" } as WorkProfile;
const survivor = { id: "w2", key: "A-2", title: "Other" } as WorkProfile;
const preview = {
  duplicateWork: { id: "w1", key: "A-1", revision: 1, title: "Dup" },
  fields: [],
  inclusions: [],
  previewId: "prev-1",
  relations: [],
  survivingWork: { id: "w2", key: "A-2", revision: 2, title: "Other" },
};

test("confirming a merge refreshes Smart Collection membership", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const cache = new QueryClient();
  const invalidate = vi.spyOn(cache, "invalidateQueries");
  rpc.workMergePreview.mockResolvedValue(preview);
  rpc.mergeWork.mockResolvedValue({});
  const click = async (label: string) => {
    const button = Array.from(container.querySelectorAll("button")).find(
      (value) => value.textContent === label,
    );
    await act(async () => button?.click());
  };
  await act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <WorkMergeForm candidates={[survivor]} work={work} />
      </QueryClientProvider>,
    ),
  );
  await click("Merge as duplicate");
  await click("Preview");
  await click("Confirm");
  expect(rpc.mergeWork).toHaveBeenCalled();
  const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  expect(keys).toContainEqual(["smartCollectionViews"]);
  root.unmount();
});
