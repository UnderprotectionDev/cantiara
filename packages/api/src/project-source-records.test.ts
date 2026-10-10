import { describe, expect, test } from "vitest";
import {
  createProjectSourceRecordInputSchema,
  projectSourceRecordSchema,
  transitionProjectSourceRecordInputSchema,
} from "./project-source-records";

describe("Project source record contracts", () => {
  test("accepts a create contract for each of the four source record types", () => {
    const inputs = [
      {
        baseRevision: 0,
        clientIdempotencyKey: "decision-create",
        decision: "Keep account access personal.",
        id: "decision-1",
        projectId: "project-1",
        rationale: "The workspace has one founder.",
        sourceType: "Decision",
        title: "Personal account access",
      },
      {
        baseRevision: 0,
        clientIdempotencyKey: "milestone-create",
        description: null,
        id: "milestone-1",
        projectId: "project-1",
        sourceType: "Milestone",
        targetDate: null,
        title: "Private beta",
      },
      {
        baseRevision: 0,
        clientIdempotencyKey: "release-create",
        description: null,
        id: "release-1",
        name: "First release",
        projectId: "project-1",
        sourceType: "Project Release",
        versionLabel: "1.0.0",
      },
      {
        baseRevision: 0,
        clientIdempotencyKey: "incident-create",
        detectedHow: null,
        id: "incident-1",
        impact: null,
        learning: null,
        occurredAt: "2026-09-27T10:00:00.000Z",
        projectId: "project-1",
        resolution: null,
        rootCause: null,
        sourceType: "Production Incident",
        title: "Queue delay",
      },
    ];

    expect(
      inputs.map(
        (input) => createProjectSourceRecordInputSchema.parse(input).sourceType,
      ),
    ).toEqual([
      "Decision",
      "Milestone",
      "Project Release",
      "Production Incident",
    ]);
  });

  test("allows only explicit source lifecycle transitions and rejects release date fields", () => {
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        baseRevision: 1,
        clientIdempotencyKey: "release-publish",
        projectId: "project-1",
        sourceId: "release-1",
        sourceType: "Project Release",
        status: "Published",
      }).success,
    ).toBe(true);
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        baseRevision: 1,
        clientIdempotencyKey: "milestone-publish",
        projectId: "project-1",
        sourceId: "milestone-1",
        sourceType: "Milestone",
        status: "Published",
      }).success,
    ).toBe(false);
    expect(
      createProjectSourceRecordInputSchema.safeParse({
        baseRevision: 0,
        clientIdempotencyKey: "release-date",
        id: "release-date",
        name: "No date field",
        projectId: "project-1",
        publishedAt: "2026-09-27T10:00:00.000Z",
        sourceType: "Project Release",
        versionLabel: null,
      }).success,
    ).toBe(false);
  });

  test("keeps source records as typed, revisioned records", () => {
    expect(
      projectSourceRecordSchema.parse({
        createdAt: "2026-09-27T10:00:00.000Z",
        decision: "Use one workspace per founder.",
        id: "decision-1",
        life: "Valid",
        projectId: "project-1",
        rationale: null,
        revision: 1,
        sourceType: "Decision",
        title: "Workspace ownership",
        updatedAt: "2026-09-27T10:00:00.000Z",
      }),
    ).toMatchObject({
      id: "decision-1",
      life: "Valid",
      sourceType: "Decision",
    });
  });
});

describe("Decisions lifecycle", () => {
  test("reads a Decision with missing life as Valid", () => {
    expect(
      projectSourceRecordSchema.parse({
        createdAt: "2026-10-07T10:00:00.000Z",
        decision: "Keep the first release focused.",
        id: "decision-import",
        projectId: "project-1",
        rationale: null,
        revision: 1,
        sourceType: "Decision",
        title: "Release scope",
        updatedAt: "2026-10-07T10:00:00.000Z",
      }),
    ).toMatchObject({ life: "Valid" });
  });
});

test("withdraws explicitly with optional rationale and rejects unlinked Superseded", () => {
  const input = {
    baseRevision: 1,
    clientIdempotencyKey: "withdraw-decision",
    life: "Withdrawn",
    projectId: "project-1",
    sourceId: "decision-1",
    sourceType: "Decision",
    rationale: "The original constraint no longer applies.",
  };
  expect(transitionProjectSourceRecordInputSchema.parse(input)).toMatchObject({
    life: "Withdrawn",
    rationale: "The original constraint no longer applies.",
  });
  expect(
    transitionProjectSourceRecordInputSchema.safeParse({
      ...input,
      life: "Superseded",
    }).success,
  ).toBe(false);
  expect(
    createProjectSourceRecordInputSchema.safeParse({
      baseRevision: 0,
      clientIdempotencyKey: "superseded-create",
      id: "decision-1",
      projectId: "project-1",
      sourceType: "Decision",
      title: "Release scope",
      decision: "Ship the first release.",
      rationale: null,
      life: "Superseded",
    }).success,
  ).toBe(false);
});

describe("Uncertainty Records — Open Question lifecycle", () => {
  test("answers explicitly with optional rationale while keeping Assumption a distinct type", () => {
    const input = {
      baseRevision: 1,
      clientIdempotencyKey: "answer-question",
      projectId: "project-1",
      sourceId: "question-1",
      sourceType: "Open Question",
      life: "Answered",
      answer: "Founders prefer a weekly review.",
      rationale: "Three interviews agreed.",
    };
    expect(transitionProjectSourceRecordInputSchema.parse(input)).toMatchObject(
      {
        life: "Answered",
        answer: "Founders prefer a weekly review.",
        rationale: "Three interviews agreed.",
      },
    );
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        ...input,
        life: "Confirmed",
      }).success,
    ).toBe(false);
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        ...input,
        sourceType: "Assumption",
      }).success,
    ).toBe(false);
  });
});

test("Uncertainty Records closes an unanswered Open Question without new evidence and requires a nonempty Answer", () => {
  const command = {
    baseRevision: 1,
    clientIdempotencyKey: "close-question",
    projectId: "project-1",
    sourceId: "question-1",
    sourceType: "Open Question",
    life: "No longer applicable",
  };
  expect(transitionProjectSourceRecordInputSchema.parse(command)).toMatchObject(
    { life: "No longer applicable" },
  );
  expect(
    transitionProjectSourceRecordInputSchema.safeParse({
      ...command,
      answer: "Replaced answer",
    }).success,
  ).toBe(false);
  expect(
    transitionProjectSourceRecordInputSchema.safeParse({
      ...command,
      life: "Answered",
      answer: " ",
    }).success,
  ).toBe(false);
});
describe("Risks contracts", () => {
  const command = {
    baseRevision: 1,
    clientIdempotencyKey: "risk-status",
    projectId: "project-1",
    sourceId: "risk-1",
    sourceType: "Risk",
  };
  test("allows all five explicit Risk statuses and requires a rationale for Accepted", () => {
    for (const life of [
      "Open",
      "Mitigating",
      "Occurred",
      "Resolved",
      "Accepted",
    ]) {
      expect(
        transitionProjectSourceRecordInputSchema.parse({
          ...command,
          life,
          rationale:
            life === "Accepted" ? "Known exposure is tolerable." : null,
        }),
      ).toMatchObject({ sourceType: "Risk", life });
    }
    for (const rationale of [undefined, null, "", "   "]) {
      expect(
        transitionProjectSourceRecordInputSchema.safeParse({
          ...command,
          life: "Accepted",
          rationale,
        }).success,
      ).toBe(false);
    }
  });
  test("keeps Risk fields as founder text and rejects scores, implicit status and type conversion", () => {
    const input = {
      baseRevision: 0,
      clientIdempotencyKey: "risk-create",
      id: "risk-1",
      projectId: "project-1",
      sourceType: "Risk",
      title: "Provider delay",
      description: "Approval may slip",
      impact: "Delayed release",
      probability: "Unknown",
      response: "Prepare a fallback",
    };
    expect(createProjectSourceRecordInputSchema.parse(input)).toMatchObject(
      input,
    );
    for (const extra of [
      { priorityScore: 9 },
      { life: "Accepted" },
      { type: "Bug" },
    ]) {
      expect(
        createProjectSourceRecordInputSchema.safeParse({ ...input, ...extra })
          .success,
      ).toBe(false);
    }
    for (const life of ["Bug", "Test Gap", "Production Incident"]) {
      expect(
        transitionProjectSourceRecordInputSchema.safeParse({ ...command, life })
          .success,
      ).toBe(false);
    }
  });
});
