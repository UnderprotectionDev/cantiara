import { useQuery } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import ProjectBacklog from "./project-backlog";

const mocks = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({ useQuery: mocks.useQuery }));
vi.mock("@/utils/orpc", () => ({
  orpc: {
    projectBacklog: {
      queryOptions: () => ({}),
    },
  },
}));

function renderBacklog(queryResult: unknown) {
  vi.mocked(useQuery).mockReturnValue(queryResult as never);
  return renderToStaticMarkup(<ProjectBacklog projectId="project-1" />);
}

describe("Project Backlog", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
  });

  test("shows the loading copy while its prepared collection loads", () => {
    const html = renderBacklog({ isPending: true });

    expect(html).toContain("Loading Backlog…");
    expect(html).toContain('role="status"');
  });

  test("shows a retry instruction when the prepared collection fails", () => {
    const html = renderBacklog({ isError: true });

    expect(html).toContain(
      "Backlog is unavailable. Try loading this page again.",
    );
    expect(html).toContain('role="alert"');
  });

  test("explains an empty prepared collection", () => {
    const html = renderBacklog({ data: [], isError: false, isPending: false });

    expect(html).toContain("No active Work to consider.");
  });
});
