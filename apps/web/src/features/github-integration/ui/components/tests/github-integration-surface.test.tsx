// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  captured: {} as {
    actions?: {
      onCreateWork: (values: unknown) => unknown;
      onPreviewCreateWork: (recordId: string) => Promise<unknown>;
    };
  },
  createGitHubWorkAndLink: vi.fn(),
  previewGitHubCreateWork: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouteContext: () => ({ session: { data: { user: { id: "account-1" } } } }),
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { createGitHubWorkAndLink: hoisted.createGitHubWorkAndLink },
    orpc: new Proxy(actual.orpc, {
      get: (target, key) =>
        key === "previewGitHubCreateWork"
          ? {
              queryOptions: ({ input }: { input: unknown }) => ({
                queryFn: () => hoisted.previewGitHubCreateWork(input),
                queryKey: ["previewGitHubCreateWork", input],
              }),
            }
          : Reflect.get(target, key),
    }),
  };
});
vi.mock("../../views/github-integration-view", () => ({
  GitHubIntegrationView: () => null,
}));
vi.mock("../github-pr-context-card", () => ({
  GitHubPrContextCards: () => null,
}));
vi.mock("../github-checks-panel", () => ({ GitHubChecksPanel: () => null }));
vi.mock("../github-work-links-panel", () => ({
  GitHubWorkLinksPanel: (props: { actions: never }) => {
    hoisted.captured.actions = props.actions;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import GitHubIntegrationSurface from "../github-integration-surface";

test("creating a Work from a GitHub Issue refreshes Work lists and Smart Collection membership", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.createGitHubWorkAndLink.mockResolvedValue({ link: {}, work: {} });
  // Refetches of the mounted queries fail fast: there is no server here.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const input = { projectId: "project-1" };
  queryClient.setQueryData(
    orpc.projectGitHubOverview.queryOptions({ input }).queryKey,
    { links: [{ id: "link-1", name: "web", owner: "acme" }] } as never,
  );
  queryClient.setQueryData(
    orpc.projectGitHubWorkLinks.queryOptions({ input }).queryKey,
    { links: [] } as never,
  );
  const worksKey = orpc.projectWorks.queryOptions({ input }).queryKey;
  const membershipKey = orpc.smartCollectionViews.key();
  queryClient.setQueryData(worksKey, []);
  queryClient.setQueryData(membershipKey, []);
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <GitHubIntegrationSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });
  expect(hoisted.captured.actions).toBeDefined();

  await act(async () => {
    await hoisted.captured.actions?.onCreateWork({
      description: "",
      recordId: "record-1",
      title: "Fix it",
      type: "Task",
    });
  });

  expect(queryClient.getQueryState(worksKey)?.isInvalidated).toBe(true);
  expect(queryClient.getQueryState(membershipKey)?.isInvalidated).toBe(true);
  await act(async () => root.unmount());
});

test("the Work draft preview is read through TanStack Query", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  hoisted.previewGitHubCreateWork.mockResolvedValue({ recordId: "record-1" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const input = { projectId: "project-1" };
  queryClient.setQueryData(
    orpc.projectGitHubOverview.queryOptions({ input }).queryKey,
    { links: [{ id: "link-1", name: "web", owner: "acme" }] } as never,
  );
  queryClient.setQueryData(
    orpc.projectGitHubWorkLinks.queryOptions({ input }).queryKey,
    { links: [] } as never,
  );
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <GitHubIntegrationSurface projectId="project-1" />
      </QueryClientProvider>,
    );
  });
  const addedKeys: unknown[] = [];
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === "added") {
      addedKeys.push(event.query.queryKey);
    }
  });
  let draft: unknown;
  await act(async () => {
    draft = await hoisted.captured.actions?.onPreviewCreateWork("record-1");
  });
  expect(draft).toEqual({ recordId: "record-1" });
  expect(hoisted.previewGitHubCreateWork).toHaveBeenCalledWith({
    projectId: "project-1",
    recordId: "record-1",
  });
  expect(addedKeys).toContainEqual([
    "previewGitHubCreateWork",
    { projectId: "project-1", recordId: "record-1" },
  ]);
  await act(async () => root.unmount());
});
