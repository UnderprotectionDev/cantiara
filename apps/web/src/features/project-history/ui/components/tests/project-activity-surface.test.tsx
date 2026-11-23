// @vitest-environment happy-dom

import {
  deriveProjectActivity,
  type ProjectActivity,
  type ProjectActivityInput,
  projectActivityInputSchema,
} from "@cantiara/api/project-activity";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import type { ProjectActivityFilters } from "../../../lib/project-activity-filters";
import ProjectActivitySurface from "../project-activity-surface";

const boundary = vi.hoisted(() => ({
  activity: vi.fn<(input: ProjectActivityInput) => Promise<ProjectActivity>>(),
  filters: undefined as ProjectActivityFilters | undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: ({
    select,
  }: {
    select: (search: { activity?: ProjectActivityFilters }) => unknown;
  }) => select({ activity: boundary.filters }),
}));

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string }) => (
    <a {...props} href={href} />
  ),
}));

vi.mock("@/utils/orpc", () => ({
  orpc: {
    projectActivity: {
      infiniteOptions: (options: {
        getNextPageParam: (page: ProjectActivity) => string | undefined;
        initialPageParam: string | undefined;
        input: (cursor: string | undefined) => ProjectActivityInput;
      }) => ({
        getNextPageParam: options.getNextPageParam,
        initialPageParam: options.initialPageParam,
        queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
          boundary.activity(options.input(pageParam)),
        queryKey: ["projectActivity", options.input(undefined)],
      }),
    },
  },
}));

function page(
  label: string,
  occurredAt: string,
  nextCursor: string | null,
): ProjectActivity {
  const result = deriveProjectActivity(
    "project",
    {
      history: [
        {
          actor: { actorId: "user", type: "User" },
          id: label,
          nextValue: { work: { title: label } },
          occurredAt,
          origin: { clientIdempotencyKey: label, kind: "human" },
          previousValue: null,
          relation: false,
          revision: 1,
          source: { label, recordId: label, recordType: "Work" },
        },
      ],
      unattributed: [],
      windowReached: false,
    },
    projectActivityInputSchema.parse({ projectId: "project" }),
  );
  return { ...result, nextCursor };
}

test("loads the server cursor and starts at the first page when filters change", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  boundary.activity
    .mockResolvedValueOnce(
      page("Newest Work", "2026-05-01T12:00:00.000Z", "newest|change"),
    )
    .mockResolvedValueOnce(page("Older Work", "2026-05-01T10:00:00.000Z", null))
    .mockResolvedValueOnce(
      page("Filtered Work", "2026-05-01T11:00:00.000Z", null),
    );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = () => {
    act(() =>
      root.render(
        <QueryClientProvider client={client}>
          <ProjectActivitySurface projectId="project" />
        </QueryClientProvider>,
      ),
    );
  };
  const labels = () =>
    Array.from(
      host.querySelectorAll('ol[aria-label="Project Activity"] a'),
      (link) => link.getAttribute("aria-label"),
    );
  const showOlder = () =>
    Array.from(host.querySelectorAll("button")).find(
      (button) => button.textContent === "Show older changes",
    );
  const expectLabels = (expected: string[]) =>
    vi.waitFor(async () => {
      await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
      expect(labels()).toEqual(expected);
    });
  try {
    render();
    await expectLabels(["Open source record: Newest Work"]);
    act(() => showOlder()?.click());
    await expectLabels([
      "Open source record: Newest Work",
      "Open source record: Older Work",
    ]);
    expect(boundary.activity).toHaveBeenNthCalledWith(2, {
      cursor: "newest|change",
      eventTypes: [],
      projectId: "project",
      sourceTypes: [],
    });
    expect(showOlder()).toBeUndefined();

    boundary.filters = { eventTypes: [], sourceTypes: ["Work"] };
    render();
    await expectLabels(["Open source record: Filtered Work"]);
    expect(boundary.activity).toHaveBeenNthCalledWith(3, {
      eventTypes: [],
      projectId: "project",
      sourceTypes: ["Work"],
    });
  } finally {
    act(() => root.unmount());
    client.clear();
    host.remove();
    boundary.filters = undefined;
    vi.unstubAllGlobals();
  }
});
