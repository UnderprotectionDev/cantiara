// @vitest-environment happy-dom

import { buildWorkspaceOverview } from "@cantiara/api/workspace-overview";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, test, vi } from "vitest";

import ProjectsView from "../projects-view";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const { loadOverview, saveOverview } = vi.hoisted(() => ({
  loadOverview: vi.fn(),
  saveOverview: vi.fn(),
}));

vi.mock("@/utils/orpc", () => ({
  accountPreferencesQueryOptions: () => ({
    queryKey: ["preferences"],
    queryFn: () => Promise.resolve(null),
  }),
  orpc: {
    saveWorkspaceOverviewPresentation: {
      mutationOptions: (options: object) => ({
        ...options,
        mutationFn: saveOverview,
      }),
    },
  },
  projectsQueryOptions: () => ({
    queryKey: ["projects"],
    queryFn: () => Promise.resolve([]),
  }),
  workspaceOverviewQueryOptions: (accountId: string) => ({
    queryKey: ["overview", accountId],
    queryFn: loadOverview,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/projects">{children}</a>
  ),
}));
vi.mock("@/components/app-link", () => ({
  AppLink: ({ children }: { children: React.ReactNode }) => (
    <a href="/projects">{children}</a>
  ),
}));

const original = buildWorkspaceOverview({ projects: [] });
const changed = buildWorkspaceOverview({
  layout: { hidden: ["active-projects"], order: original.layout.order },
  projects: [],
});
const client = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});
const host = document.createElement("div");
let root: ReturnType<typeof createRoot> | undefined;

afterEach(() => {
  act(() => root?.unmount());
  host.remove();
  client.clear();
});

function button(label: string) {
  return host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

test("rolls a rejected layout back and keeps the accepted retry in the account's overview", async () => {
  loadOverview.mockResolvedValue(original);
  let rejectSave: (reason: Error) => void = () => undefined;
  saveOverview.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        rejectSave = reject;
      }),
  );
  saveOverview.mockImplementationOnce(() => {
    loadOverview.mockResolvedValue(changed);
    return Promise.resolve(changed);
  });
  client.setQueryData(["overview", "other-account"], original);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  document.body.append(host);
  root = createRoot(host);
  await act(() => {
    root?.render(
      <QueryClientProvider client={client}>
        <ProjectsView accountId="owner" />
      </QueryClientProvider>,
    );
  });
  await vi.waitFor(() => expect(button("Hide Active Projects")).not.toBeNull());

  await act(async () => button("Hide Active Projects")?.click());
  await vi.waitFor(() => expect(button("Show Active Projects")).not.toBeNull());
  expect(button("Show Active Projects")?.closest("fieldset")?.disabled).toBe(
    true,
  );

  await act(async () => rejectSave(new Error("unavailable")));
  await vi.waitFor(() => expect(button("Hide Active Projects")).not.toBeNull());
  expect(host.textContent).toContain(
    "Workspace overview settings could not be saved.",
  );

  await act(async () => button("Hide Active Projects")?.click());
  await vi.waitFor(() =>
    expect(button("Show Active Projects")?.closest("fieldset")?.disabled).toBe(
      false,
    ),
  );
  expect(saveOverview.mock.calls[1]?.[0]).toEqual(
    saveOverview.mock.calls[0]?.[0],
  );
  expect(client.getQueryData(["overview", "other-account"])).toEqual(original);
  expect(invalidate).toHaveBeenCalledWith({
    exact: true,
    queryKey: ["overview", "owner"],
  });
});
