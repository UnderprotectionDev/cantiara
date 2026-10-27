import {
  type ClosureSummaryCandidate,
  renderClosureSummaryMarkdown,
} from "@cantiara/api/project-closure-summary";
import { describe, expect, test } from "vitest";

import {
  createProjectClosureSummary,
  ProjectClosureSummaryProjectNotClosedError,
  ProjectClosureSummaryProjectNotFoundError,
  ProjectClosureSummarySourceNotFoundError,
} from "../project-closure-summary";
import { createMemoryProjectClosureSummary } from "../project-closure-summary-memory-store";

const ACCOUNT = "account-1";
const NARRATIVE = /success|conclusion|result|rationale|summary/i;

const candidates: ClosureSummaryCandidate[] = [
  { label: "Use Postgres", recordId: "d1", recordType: "Decision" },
  { label: "Vendor lock-in", recordId: "r1", recordType: "Risk" },
  { label: "P-1 Ship", recordId: "w1", recordType: "Work" },
];

function setup(status = "Completed") {
  return createProjectClosureSummary(
    createMemoryProjectClosureSummary({
      accountId: ACCOUNT,
      projects: new Map([["p1", { candidates, status }]]),
    }),
  );
}

describe("Project Closure Summary behavior", () => {
  test.each(["Completed", "Abandoned"])(
    "offers the live sources of a %s Project grouped by heading",
    async (status) => {
      const result = await setup(status).sources(ACCOUNT, { projectId: "p1" });
      expect(result.eligible).toBe(true);
      expect(
        result.groups
          .filter((group) => group.candidates.length > 0)
          .map((group) => group.heading),
      ).toEqual(["Decisions", "Risks", "Completed Work"]);
    },
  );

  test.each(["Active", "Pending"])(
    "offers nothing on a %s Project and refuses a draft",
    async (status) => {
      const access = setup(status);
      await expect(
        access.sources(ACCOUNT, { projectId: "p1" }),
      ).resolves.toMatchObject({ eligible: false, groups: [] });
      await expect(
        access.draft(ACCOUNT, { projectId: "p1", sources: [] }),
      ).rejects.toBeInstanceOf(ProjectClosureSummaryProjectNotClosedError);
    },
  );

  test("hides another account's or unknown Project", async () => {
    await expect(
      setup().sources("other", { projectId: "p1" }),
    ).rejects.toBeInstanceOf(ProjectClosureSummaryProjectNotFoundError);
    await expect(
      setup().sources(ACCOUNT, { projectId: "nope" }),
    ).rejects.toBeInstanceOf(ProjectClosureSummaryProjectNotFoundError);
  });

  test("maps the selected sources to headings and refuses an unlisted one", async () => {
    const access = setup();
    const draft = await access.draft(ACCOUNT, {
      projectId: "p1",
      sources: [
        { recordId: "w1", recordType: "Work" },
        { recordId: "d1", recordType: "Decision" },
      ],
    });
    expect(draft.sections.map((section) => section.heading)).toEqual([
      "Decisions",
      "Completed Work",
    ]);
    await expect(
      access.draft(ACCOUNT, {
        projectId: "p1",
        sources: [{ recordId: "foreign", recordType: "Decision" }],
      }),
    ).rejects.toBeInstanceOf(ProjectClosureSummarySourceNotFoundError);
    // The right id under the wrong type is not a candidate either.
    await expect(
      access.draft(ACCOUNT, {
        projectId: "p1",
        sources: [{ recordId: "d1", recordType: "Risk" }],
      }),
    ).rejects.toBeInstanceOf(ProjectClosureSummarySourceNotFoundError);
  });

  test("the generated draft holds headings and links only, and nothing is persisted", async () => {
    const access = setup();
    expect(Object.keys(access).sort()).toEqual(["draft", "sources"]);
    const draft = await access.draft(ACCOUNT, {
      projectId: "p1",
      sources: [{ recordId: "r1", recordType: "Risk" }],
    });
    const markdown = renderClosureSummaryMarkdown(
      draft.sections,
      (source) => `/projects/p1#${source.recordId}`,
    );
    expect(markdown).toBe("## Risks\n\n- [Vendor lock-in](/projects/p1#r1)");
    expect(JSON.stringify(draft)).not.toMatch(NARRATIVE);
  });
});
