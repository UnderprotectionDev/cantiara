import { projectRelease } from "@cantiara/db/schema/project-release";
import {
  projectReleaseAudience,
  projectReleaseLink,
  projectReleaseScope,
} from "@cantiara/db/schema/project-release-planning";
import { describe, expect, test } from "vitest";
import {
  groupProjectReleasesByStatus,
  projectReleaseScopeCounts,
  projectReleaseScopeGroup,
  setProjectReleaseAudienceInputSchema,
  setProjectReleaseLinkInputSchema,
  setProjectReleaseScopeInputSchema,
} from "./project-release-planning";
import {
  createProjectSourceRecordInputSchema,
  PROJECT_RELEASE_HYPOTHESIS_FIELDS,
  projectReleaseRecordSchema,
  transitionProjectSourceRecordInputSchema,
  updateProjectSourceRecordInputSchema,
} from "./project-source-records";

const DATE_COLUMN = /publish|target_?date|planned/i;

// Drizzle tables expose their columns as own enumerable properties.
function getTableColumns<T extends object>(table: T) {
  return Object.fromEntries(
    Object.entries(table).filter(
      ([, value]) => typeof value === "object" && value && "notNull" in value,
    ),
  ) as { [K in keyof T]: T[K] };
}

const release = {
  createdAt: "2026-10-20T10:00:00.000Z",
  description: null,
  id: "release-1",
  name: "tidekit 1.1",
  projectId: "project-1",
  revision: 1,
  sourceType: "Project Release" as const,
  status: "Draft" as const,
  updatedAt: "2026-10-20T10:00:00.000Z",
  versionLabel: "v1.1.0",
};
const envelope = { baseRevision: 0, clientIdempotencyKey: "command-1" };
const releaseUpdate = {
  ...envelope,
  baseRevision: 1,
  description: null,
  name: release.name,
  projectId: release.projectId,
  sourceId: release.id,
  sourceType: "Project Release" as const,
  versionLabel: release.versionLabel,
};

describe("Project Release Planning seam: create and type", () => {
  test("creates a Project Release owned by exactly one Project, starting without a hypothesis", () => {
    const input = createProjectSourceRecordInputSchema.parse({
      ...envelope,
      description: null,
      id: release.id,
      name: release.name,
      projectId: release.projectId,
      sourceType: "Project Release",
      versionLabel: release.versionLabel,
    });
    expect(input).toMatchObject({
      projectId: "project-1",
      sourceType: "Project Release",
    });
    expect(
      createProjectSourceRecordInputSchema.safeParse({
        ...input,
        projectIds: ["project-1", "project-2"],
      }).success,
    ).toBe(false);
    expect(
      createProjectSourceRecordInputSchema.safeParse({
        ...input,
        workspaceId: "workspace-1",
      }).success,
    ).toBe(false);
    const record = projectReleaseRecordSchema.parse(release);
    for (const { name } of PROJECT_RELEASE_HYPOTHESIS_FIELDS) {
      expect(record[name]).toBeNull();
    }
  });

  test("is neither a Milestone nor a Focus Period record", () => {
    expect(
      projectReleaseRecordSchema.safeParse({
        ...release,
        sourceType: "Milestone",
      }).success,
    ).toBe(false);
    expect(
      projectReleaseRecordSchema.safeParse({
        ...release,
        sourceType: "Focus Period",
      }).success,
    ).toBe(false);
    // A Milestone command cannot carry a Project Release status or fields.
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        ...envelope,
        projectId: release.projectId,
        sourceId: release.id,
        sourceType: "Milestone",
        status: "Published",
      }).success,
    ).toBe(false);
    expect(
      createProjectSourceRecordInputSchema.safeParse({
        ...envelope,
        description: null,
        id: "milestone-1",
        name: release.name,
        projectId: release.projectId,
        sourceType: "Milestone",
        targetDate: null,
        title: release.name,
        versionLabel: release.versionLabel,
      }).success,
    ).toBe(false);
  });

  test("has no built-in planned or actual publish date column or input", () => {
    // Only bookkeeping timestamps exist; no planned or actual publish date.
    expect(Object.keys(getTableColumns(projectRelease)).sort()).toEqual([
      "accessEvidence",
      "audience",
      "createdAt",
      "description",
      "id",
      "intendedOutcome",
      "name",
      "outcomeEvidence",
      "primaryAccessPath",
      "projectId",
      "revision",
      "status",
      "updatedAt",
      "versionLabel",
    ]);
    for (const field of [
      "publishedAt",
      "plannedPublishDate",
      "targetDate",
      "releaseDate",
    ]) {
      expect(
        projectReleaseRecordSchema.safeParse({
          ...release,
          [field]: "2026-11-01",
        }).success,
      ).toBe(false);
      expect(
        updateProjectSourceRecordInputSchema.safeParse({
          ...releaseUpdate,
          [field]: "2026-11-01",
        }).success,
      ).toBe(false);
    }
  });
});

describe("Project Release Planning seam: hypothesis", () => {
  test("keeps the five access and outcome fields separate and optional", () => {
    expect(PROJECT_RELEASE_HYPOTHESIS_FIELDS.map(({ label }) => label)).toEqual(
      [
        "Audience",
        "Primary access path",
        "Access evidence",
        "Intended outcome",
        "Outcome evidence",
      ],
    );
    const accessOnly = updateProjectSourceRecordInputSchema.parse({
      ...releaseUpdate,
      primaryAccessPath: "Hacker News launch post",
    });
    expect(accessOnly).toMatchObject({
      primaryAccessPath: "Hacker News launch post",
    });
    expect(accessOnly).not.toHaveProperty("intendedOutcome");
    expect(
      updateProjectSourceRecordInputSchema.safeParse({
        ...releaseUpdate,
        hypothesis: "Founders adopt it",
      }).success,
    ).toBe(false);
  });

  test("is not a publish gate: an empty hypothesis still allows every explicit status", () => {
    for (const status of ["Preparing", "Published", "Cancelled"] as const) {
      expect(
        transitionProjectSourceRecordInputSchema.parse({
          ...envelope,
          projectId: release.projectId,
          sourceId: release.id,
          sourceType: "Project Release",
          status,
        }),
      ).toMatchObject({ status });
    }
    expect(
      transitionProjectSourceRecordInputSchema.safeParse({
        ...envelope,
        intendedOutcome: "Founders adopt it",
        projectId: release.projectId,
        sourceId: release.id,
        sourceType: "Project Release",
        status: "Published",
      }).success,
    ).toBe(false);
  });
});

describe("Project Release Planning seam: scope and links", () => {
  test("adds one explicit Work at a time; no automatic scope fill", () => {
    const input = {
      ...envelope,
      attached: true,
      projectId: "project-1",
      releaseId: "release-1",
      workId: "work-1",
    };
    expect(setProjectReleaseScopeInputSchema.parse(input)).toEqual(input);
    for (const extra of [
      { workIds: ["work-1", "work-2"] },
      { fillFrom: "Focus Period" },
      { status: "Published" },
    ]) {
      expect(
        setProjectReleaseScopeInputSchema.safeParse({ ...input, ...extra })
          .success,
      ).toBe(false);
    }
  });

  test("references tags and GitHub Releases of a Project repository, and environments by URL", () => {
    const tag = {
      ...envelope,
      attached: true,
      id: "link-1",
      kind: "Tag" as const,
      label: "v1.1.0",
      projectId: "project-1",
      releaseId: "release-1",
      repositoryLinkId: "repository-1",
      url: null,
    };
    expect(setProjectReleaseLinkInputSchema.parse(tag)).toEqual(tag);
    expect(
      setProjectReleaseLinkInputSchema.safeParse({
        ...tag,
        repositoryLinkId: null,
      }).success,
    ).toBe(false);
    expect(
      setProjectReleaseLinkInputSchema.safeParse({
        ...tag,
        kind: "Environment link",
        repositoryLinkId: null,
      }).success,
    ).toBe(false);
    expect(
      setProjectReleaseLinkInputSchema.parse({
        ...tag,
        kind: "Environment link",
        label: "Production",
        repositoryLinkId: null,
        url: "https://tidekit.example",
      }),
    ).toMatchObject({ kind: "Environment link" });
    expect(
      setProjectReleaseLinkInputSchema.safeParse({
        ...tag,
        url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    // A reference never carries a status or a GitHub release time.
    for (const extra of [
      { status: "Published" },
      { publishedAt: "2026-11-01T10:00:00.000Z" },
    ]) {
      expect(
        setProjectReleaseLinkInputSchema.safeParse({ ...tag, ...extra })
          .success,
      ).toBe(false);
    }
  });

  test("names audience Persona, Contact or Company links only", () => {
    const input = {
      ...envelope,
      attached: true,
      projectId: "project-1",
      releaseId: "release-1",
      targetId: "contact-1",
      targetType: "Contact" as const,
    };
    expect(setProjectReleaseAudienceInputSchema.parse(input)).toEqual(input);
    expect(
      setProjectReleaseAudienceInputSchema.safeParse({
        ...input,
        targetType: "Work",
      }).success,
    ).toBe(false);
  });

  test("stores scope, links and audience in Project-owned tables without dates", () => {
    for (const table of [
      projectReleaseScope,
      projectReleaseLink,
      projectReleaseAudience,
    ]) {
      const columns = getTableColumns(table);
      expect(columns.projectId.notNull).toBe(true);
      expect(columns.releaseId.notNull).toBe(true);
      expect(
        Object.keys(columns).filter((column) => DATE_COLUMN.test(column)),
      ).toEqual([]);
    }
  });
});

describe("Project Release Planning seam: overview derivation", () => {
  const work = (status: string, closureResult: string | null = null) => ({
    closureResult,
    id: crypto.randomUUID(),
    key: "TK-1",
    status,
    title: "Work",
    type: "Task",
    unavailable: false,
  });

  test("counts completed and open scope from the Work's own status", () => {
    expect(projectReleaseScopeGroup(work("In Progress"))).toBe("Open");
    expect(projectReleaseScopeGroup(work("Closed", "Completed"))).toBe(
      "Completed",
    );
    expect(projectReleaseScopeGroup(work("Closed", "Abandoned"))).toBe(
      "Closed",
    );
    expect(
      projectReleaseScopeCounts([
        { attached: true, work: work("Not Started") },
        { attached: true, work: work("Blocked") },
        { attached: true, work: work("Closed", "Completed") },
        { attached: true, work: work("Closed", "Abandoned") },
        { attached: false, work: work("In Progress") },
        { attached: true, work: { ...work("Not Started"), unavailable: true } },
      ]),
    ).toEqual({ completed: 1, open: 2 });
  });

  test("groups releases by status in catalog order and drops empty groups", () => {
    const summary = (status: "Draft" | "Preparing" | "Published") => ({
      release: { status },
    });
    expect(
      groupProjectReleasesByStatus([
        summary("Published"),
        summary("Draft"),
        summary("Draft"),
      ]).map(({ status, releases }) => [status, releases.length]),
    ).toEqual([
      ["Draft", 2],
      ["Published", 1],
    ]);
  });
});
