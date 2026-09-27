import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import ProjectMilestones from "./project-milestones";

const mocks = vi.hoisted(() => ({ useQuery: vi.fn() }));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isError: false, isPending: false, mutate: vi.fn() }),
  useQuery: mocks.useQuery,
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="#work">{children}</a>
  ),
}));
vi.mock("@/features/project-shell/lib/project-shell-navigation", () => ({
  workRecordHash: (id: string) => `work-${id}`,
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
  client: {
    createMilestone: vi.fn(),
    createRelation: vi.fn(),
    relationPreview: vi.fn(),
    updateMilestone: vi.fn(),
    updateMilestoneStatus: vi.fn(),
  },
  orpc: {
    projectMilestones: { queryOptions: () => ({ queryKey: ["milestones"] }) },
    relations: { queryOptions: () => ({ queryKey: ["relations"] }) },
  },
  projectWorksQueryPrefix: ["project-works"],
}));

const work = {
  id: "work-1",
  key: "CAT-1",
  title: "Core flow",
} as WorkProfile;

function renderMilestones(status: "Planned" | "Reached" | "Abandoned") {
  vi.mocked(useQuery)
    .mockReturnValueOnce({
      data: [
        {
          description: "Early users can complete the core flow.",
          id: "milestone-1",
          projectId: "project-1",
          revision: 1,
          status,
          targetDate: "2026-11-15",
          title: "Private beta",
        },
      ],
      isError: false,
      isPending: false,
    } as never)
    .mockReturnValueOnce({
      data: [
        {
          id: "relation-1",
          kind: "Contributes to Milestone",
          label: "In Milestone",
          source: {
            recordId: work.id,
            recordType: "Work",
            title: work.title,
          },
        },
      ],
      isError: false,
      isPending: false,
    } as never);
  return renderToStaticMarkup(
    <ProjectMilestones projectId="project-1" works={[work]} />,
  );
}

describe("Project Milestones", () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockReset();
  });

  test("shows Milestone fields and requires a preview before relation confirmation", () => {
    const html = renderMilestones("Planned");

    expect(html).toContain("Milestones");
    expect(html).toContain("Create Milestone");
    expect(html).toContain("Title");
    expect(html).toContain("Description");
    expect(html).toContain("Target date");
    expect(html).toContain("Private beta");
    expect(html).toContain("In Milestone");
    expect(html).toContain("Core flow · In Milestone");
    expect(html).toContain("Preview relation");
    expect(html).not.toContain("Confirm relation");
    expect(html).toContain("Reach");
    expect(html).toContain("Abandon");
  });

  test.each(["Reached", "Abandoned"] as const)(
    "%s Milestones do not offer another status transition",
    (status) => {
      const html = renderMilestones(status);

      expect(html).toContain(status);
      expect(html).not.toContain(">Reach</button>");
      expect(html).not.toContain(">Abandon</button>");
    },
  );
});
