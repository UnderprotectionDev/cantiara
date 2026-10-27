import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProjectUpdate } from "@cantiara/api/project-updates";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { ProjectUpdateList } from "../project-update-list";

const CONTROL_ELEMENT = /<button|<input|<textarea/;
const REWRITE_COPY = /\b(Edit|Delete|Remove)\b/;
const HEALTH_JUDGMENT =
  /project is (healthy|on track|at risk)|health score|mission control|current health|ai draft/i;

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

function update(
  id: string,
  mark: ProjectUpdate["mark"],
  savedAt: string,
  overrides: Partial<ProjectUpdate> = {},
): ProjectUpdate {
  return {
    id,
    links: [],
    mark,
    narrative: `Narrative ${id}`,
    projectId: "project-1",
    savedAt,
    snapshot: {
      blocks: [
        {
          name: "Risks",
          records: [
            {
              id: "r1",
              status: "Open",
              targetDate: null,
              title: "Frozen risk",
            },
          ],
        },
      ],
      lifecycle: "Active",
      purpose: null,
      targetDate: null,
    },
    ...overrides,
  };
}

function render(updates: ProjectUpdate[]) {
  return renderToStaticMarkup(
    <ProjectUpdateList
      formatting={DEFAULT_ACCOUNT_PREFERENCES}
      projectId="project-1"
      updates={updates}
    />,
  );
}

describe("Project Update list", () => {
  test("lists every entry in the order given with its mark and narrative", () => {
    const html = render([
      update("new", "Off Track", "2026-10-02T10:00:00.000Z"),
      update("old", "On Track", "2026-10-01T10:00:00.000Z"),
    ]);
    expect(html.indexOf("Narrative new")).toBeLessThan(
      html.indexOf("Narrative old"),
    );
    expect(html).toContain("Off Track");
    expect(html).toContain("On Track");
  });

  test("shows the frozen summary of each entry and no edit or delete control", () => {
    const html = render([update("a", "At Risk", "2026-10-01T10:00:00.000Z")]);
    expect(html).toContain("Frozen risk");
    expect(html).not.toMatch(CONTROL_ELEMENT);
    expect(html).not.toMatch(REWRITE_COPY);
  });

  test("opens a live linked record with Open source record, unavailable ones without content", () => {
    const html = render([
      update("a", "At Risk", "2026-10-01T10:00:00.000Z", {
        links: [
          {
            label: "Provider delay",
            status: "Open",
            targetId: "r1",
            targetType: "Risk",
            unavailable: false,
          },
          {
            label: null,
            status: null,
            targetId: "w9",
            targetType: "Work",
            unavailable: true,
          },
        ],
      }),
    ]);
    expect(html).toContain("Provider delay");
    expect(html).toContain("Open source record");
    expect(html).toContain('href="/projects/project-1#source-risk-r1"');
    expect(html).toContain("Work (unavailable)");
    expect(html.match(/Open source record/g)).toHaveLength(1);
  });

  test("states no health judgment of the Project", () => {
    expect(
      render([update("a", "On Track", "2026-10-01T10:00:00.000Z")]),
    ).not.toMatch(HEALTH_JUDGMENT);
    expect(render([])).not.toMatch(HEALTH_JUDGMENT);
  });
});
