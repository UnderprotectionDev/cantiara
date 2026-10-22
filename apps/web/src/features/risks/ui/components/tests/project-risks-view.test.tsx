import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import type { RiskRecord } from "../../../lib/risk-form";
import { ProjectRisksView } from "../project-risks-view";

vi.mock("@/components/app-link", () => ({
  AppLink: ({ href, ...props }: { href: string } & Record<string, unknown>) => (
    <a {...props} href={href} />
  ),
}));

const record: RiskRecord = {
  id: "risk-1",
  projectId: "project-1",
  sourceType: "Risk",
  revision: 1,
  title: "Provider delay",
  description: "Approval may slip",
  impact: "Delayed release",
  probability: "Unknown",
  response: "Prepare fallback",
  rationale: "Known exposure",
  life: "Accepted",
  createdAt: "2026-10-09T10:00:00.000Z",
  updatedAt: "2026-10-09T10:00:00.000Z",
};
const save = async () => undefined;

test("Risks keeps Accepted visible with its rationale and offers explicit status changes without scores", () => {
  const html = renderToStaticMarkup(
    <ProjectRisksView
      onSave={save}
      onTransition={save}
      projectId="project-1"
      records={[record]}
      selectedId={record.id}
    />,
  );
  expect(html).toContain('aria-label="Risk"');
  expect(html).toContain("Known exposure");
  expect(html).toContain("Prepare fallback");
  expect(html).toContain(">Create</button>");
  expect(html).toContain(">Status</button>");
  expect(html).toContain("Accepted");
  expect(html).not.toContain("Score");
  const readOnly = renderToStaticMarkup(
    <ProjectRisksView
      onSave={save}
      onTransition={save}
      projectId="project-1"
      readOnly
      records={[record]}
      selectedId={record.id}
    />,
  );
  expect(readOnly).not.toContain(">Create</button>");
  expect(readOnly).not.toContain(">Edit</button>");
  expect(readOnly).not.toContain(">Status</button>");
});
