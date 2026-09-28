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
