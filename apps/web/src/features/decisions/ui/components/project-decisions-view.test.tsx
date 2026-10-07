import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { DecisionEditor, ProjectDecisionsView } from "./project-decisions-view";

vi.mock("@/features/favorites/ui/components/favorite-control", () => ({
  default: () => <button type="button">Add to Favorites</button>,
}));

const decision = {
  createdAt: "2026-10-07T10:00:00.000Z",
  updatedAt: "2026-10-07T10:00:00.000Z",
  id: "decision-1",
  projectId: "project-1",
  revision: 1,
  sourceType: "Decision",
  title: "Release scope",
  decision: "Ship the focused release.",
  rationale: "Keep scope small.",
  life: "Valid",
} satisfies Extract<ProjectSourceRecord, { sourceType: "Decision" }>;
const noop = () => undefined;
const save = async () => undefined;

test("Decisions offers creation and an explicit withdrawal only for Valid Decisions", () => {
  const html = renderToStaticMarkup(
    <ProjectDecisionsView
      decisions={[decision]}
      onSave={save}
      onWithdraw={save}
      projectId="project-1"
      selectedId="decision-1"
    />,
  );
  expect(html).toContain("Decisions");
  expect(html).toContain(">Create</button>");
  expect(html).toContain(">Withdraw</button>");
  expect(html).toContain("Keep scope small.");
  expect(html).not.toContain("<select");
  const archived = renderToStaticMarkup(
    <ProjectDecisionsView
      decisions={[decision]}
      onSave={save}
      onWithdraw={save}
      projectId="project-1"
      readOnly
      selectedId="decision-1"
    />,
  );
  expect(archived).not.toContain(">Create</button>");
  expect(archived).not.toContain(">Withdraw</button>");
});

test("Decisions keeps withdrawn rationale and its date visible separately", () => {
  const html = renderToStaticMarkup(
    <ProjectDecisionsView
      decisions={[
        {
          ...decision,
          life: "Withdrawn",
          withdrawnAt: "2026-10-07T11:00:00.000Z",
          withdrawalRationale: "Constraint removed.",
        },
      ]}
      onSave={save}
      onWithdraw={save}
      projectId="project-1"
      selectedId="decision-1"
    />,
  );
  expect(html).toContain("Keep scope small.");
  expect(html).toContain("Constraint removed.");
  expect(html).toContain('dateTime="2026-10-07T11:00:00.000Z"');
  expect(html).not.toContain(">Withdraw</button>");
});

test("Decision creation uses labelled title, decision text and optional rationale", () => {
  const html = renderToStaticMarkup(
    <DecisionEditor onCancel={noop} onSave={save} />,
  );
  expect(html).toContain('id="decision-title"');
  expect(html).toContain("Decision text");
  expect(html).toContain("Rationale");
  expect(html).toContain(">Save</button>");
  expect(html).toContain(">Cancel</button>");
  expect(html).not.toContain("Superseded");
});
