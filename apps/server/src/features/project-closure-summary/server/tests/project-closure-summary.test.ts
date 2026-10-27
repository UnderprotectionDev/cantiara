import {
  type ClosureSummaryCandidate,
  type ClosureSummaryDateFacts,
  deriveClosureSummaryDateComparison,
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
const SCORE_OR_HEALTH = /score|health/i;
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
    expect(Object.keys(access).sort()).toEqual([
      "dateComparison",
      "draft",
      "saveTarget",
      "sources",
    ]);
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

describe("neutral date comparison", () => {
  const fact = (
    over: Partial<ClosureSummaryDateFacts> & { closedAt: string | null },
  ): ClosureSummaryDateFacts => ({
    currentTargetDate: "2026-10-10",
    label: "P-1 Ship",
    recordId: "w1",
    recordType: "Work",
    targetDates: ["2026-10-10"],
    ...over,
  });
  const read = (facts: ClosureSummaryDateFacts[], timeZone = "UTC") =>
    deriveClosureSummaryDateComparison("p1", facts, timeZone).rows;

  test.each([
    ["2026-10-09T12:00:00Z", "Before target"],
    ["2026-10-10T23:59:00Z", "On target"],
    ["2026-10-11T00:01:00Z", "After target"],
    [null, "Still open"],
  ] as const)("closing at %s reads %s", (closedAt, reading) => {
    expect(read([fact({ closedAt })])[0]?.reading).toBe(reading);
  });

  test("reads the closing day in the Account time zone", () => {
    // 22:30 UTC on the 10th is already the 11th in Istanbul (UTC+3).
    const closedAt = "2026-10-10T22:30:00Z";
    expect(read([fact({ closedAt })], "UTC")[0]?.reading).toBe("On target");
    expect(read([fact({ closedAt })], "Europe/Istanbul")[0]?.reading).toBe(
      "After target",
    );
  });

  test("moved means the planned date changed; a record without a planned date is omitted", () => {
    const rows = read([
      fact({
        closedAt: "2026-10-10T10:00:00Z",
        targetDates: ["2026-10-01", "2026-10-01", "2026-10-10"],
      }),
      fact({
        closedAt: null,
        currentTargetDate: null,
        recordId: "w2",
        targetDates: [],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      moved: true,
      plannedDates: ["2026-10-01", "2026-10-10"],
    });
  });

  test("the seam reads only the selected records", async () => {
    const access = createProjectClosureSummary(
      createMemoryProjectClosureSummary({
        accountId: ACCOUNT,
        projects: new Map([
          [
            "p1",
            {
              candidates,
              dateFacts: [
                fact({ closedAt: "2026-10-10T10:00:00Z" }),
                fact({ closedAt: null, label: "Other", recordId: "w9" }),
              ],
              status: "Completed",
            },
          ],
        ]),
      }),
    );
    const result = await access.dateComparison(ACCOUNT, {
      projectId: "p1",
      sources: [{ recordId: "w1", recordType: "Work" }],
    });
    expect(result.rows.map((row) => row.recordId)).toEqual(["w1"]);
    expect(JSON.stringify(result.rows)).not.toMatch(SCORE_OR_HEALTH);
  });
});
