// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import {
  type CreatePlannedTestCaseInput,
  PLANNED_TEST_RELATION_TARGET_TYPES,
} from "@cantiara/api/planned-tests";
import {
  plannedTestCase,
  plannedTestCaseRelation,
  plannedTestCaseVersion,
} from "@cantiara/db/schema/planned-test";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  PlannedTestCaseNotFoundError,
  PlannedTestNoChangeError,
  PlannedTestProjectNotFoundError,
  PlannedTestProjectReadOnlyError,
  PlannedTestRelationTargetError,
  PlannedTestVersionConflictError,
  PlannedTestVersionNotFoundError,
} from "./planned-tests";
import {
  accountId,
  archivedProjectId,
  type CatalogEntry,
  createMemoryHarness,
  projectId,
} from "./planned-tests-memory-store";

const content = {
  expectedBehavior: "The order is confirmed and a receipt is shown.",
  notes: "Retry once on a slow network.",
  preconditions: "A signed-in customer with one item in the cart.",
  purpose: "Confirm checkout completes.",
  scope: "Card payment only; no coupons.",
  title: "Checkout with a saved card",
};

function newCase(
  overrides: Partial<CreatePlannedTestCaseInput> = {},
): CreatePlannedTestCaseInput {
  return { ...content, projectId, ...overrides };
}

const catalog: CatalogEntry[] = [
  { label: "Build checkout", projectId, targetId: "w1", targetType: "Work" },
  {
    label: "Saved cards",
    projectId,
    targetId: "f1",
    targetType: "Feature",
  },
  {
    documentRevision: 4,
    label: "Checkout spec",
    projectId,
    sections: [{ id: "payment", label: "Payment" }],
    targetId: "d1",
    targetType: "Document",
  },
  { label: "Use Stripe", projectId, targetId: "dec1", targetType: "Decision" },
  { label: "Double charge", projectId, targetId: "r1", targetType: "Risk" },
  {
    label: "Launch checkout",
    projectId,
    targetId: "g1",
    targetType: "Project Goal",
  },
  { label: "Beta", projectId, targetId: "m1", targetType: "Milestone" },
  { label: "Stripe docs", projectId, targetId: "s1", targetType: "Source" },
  { label: "Checkout", projectId, targetId: "sc1", targetType: "Screen" },
  {
    label: "Other Project work",
    projectId: "project-2",
    targetId: "w-other",
    targetType: "Work",
  },
];

describe("Planned Tests and Handoff seam: Planned Test Case versions", () => {
  test("creates a Planned Test Case with the PRD fields as version 1", async () => {
    const { plannedTests } = createMemoryHarness();

    const record = await plannedTests.create(
      accountId,
      newCase({ title: "  Checkout with a saved card  " }),
    );

    expect(record.current).toMatchObject({
      ...content,
      changeKind: "Initial version",
      relations: [],
      version: 1,
    });
    expect(record.projectId).toBe(projectId);
    expect(record.versions).toHaveLength(1);
  });

  test("notes are optional and an empty note is stored as no note", async () => {
    const { plannedTests } = createMemoryHarness();

    const absent = await plannedTests.create(
      accountId,
      newCase({ notes: undefined }),
    );
    const blank = await plannedTests.create(
      accountId,
      newCase({ notes: "   " }),
    );

    expect(absent.current.notes).toBeNull();
    expect(blank.current.notes).toBeNull();
  });

  test.each([
    "title",
    "purpose",
    "scope",
    "preconditions",
    "expectedBehavior",
  ] as const)("requires %s and never accepts a title alone", async (field) => {
    const { plannedTests } = createMemoryHarness();

    await expect(
      plannedTests.create(accountId, newCase({ [field]: "   " })),
    ).rejects.toThrow("is required.");
    await expect(
      plannedTests.create(accountId, {
        projectId,
        title: "Only a title",
      } as never),
    ).rejects.toThrow();
  });

  test("a meaningful change opens version 2 and leaves version 1 exactly as it was", async () => {
    const { plannedTests } = createMemoryHarness();
    const created = await plannedTests.create(accountId, newCase());

    const changed = await plannedTests.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedBehavior: "The order is confirmed and an email receipt is sent.",
      expectedVersion: 1,
      projectId,
      scope: "Card and wallet payment.",
    });

    expect(changed.current).toMatchObject({
      changeKind: "Meaningful change",
      expectedBehavior: "The order is confirmed and an email receipt is sent.",
      scope: "Card and wallet payment.",
      version: 2,
    });
    expect(changed.versions.map(({ version }) => version)).toEqual([1, 2]);
    const first = await plannedTests.version(accountId, {
      caseId: created.id,
      projectId,
      version: 1,
    });
    expect(first).toMatchObject({
      ...content,
      changeKind: "Initial version",
      version: 1,
    });
    expect(first.id).toBe(created.current.id);
  });

  test("an editorial change also opens a version and records that it is editorial", async () => {
    const { plannedTests } = createMemoryHarness();
    const created = await plannedTests.create(accountId, newCase());

    const edited = await plannedTests.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Editorial change",
      expectedVersion: 1,
      projectId,
      title: "Checkout with a saved card.",
    });

    expect(edited.current).toMatchObject({
      changeKind: "Editorial change",
      title: "Checkout with a saved card.",
      version: 2,
    });
    expect(edited.versions[0]?.title).toBe(content.title);
  });

  test("a save that changes nothing is refused instead of adding an empty version", async () => {
    const { plannedTests } = createMemoryHarness();
    const created = await plannedTests.create(accountId, newCase());

    await expect(
      plannedTests.createVersion(accountId, {
        ...content,
        caseId: created.id,
        changeKind: "Editorial change",
        expectedVersion: 1,
        projectId,
      }),
    ).rejects.toBeInstanceOf(PlannedTestNoChangeError);
    expect(
      (await plannedTests.list(accountId, projectId)).cases[0]?.versions,
    ).toHaveLength(1);
  });

  test("an edit made from an outdated version is refused, not overwritten", async () => {
    const { plannedTests } = createMemoryHarness();
    const created = await plannedTests.create(accountId, newCase());
    await plannedTests.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      purpose: "Confirm checkout completes quickly.",
    });

    await expect(
      plannedTests.createVersion(accountId, {
        ...content,
        caseId: created.id,
        changeKind: "Meaningful change",
        expectedVersion: 1,
        projectId,
        purpose: "A competing edit.",
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionConflictError);
  });

  test("reads exactly the requested version and has no latest lookup", async () => {
    const { plannedTests } = createMemoryHarness();
    const created = await plannedTests.create(accountId, newCase());

    await expect(
      plannedTests.version(accountId, {
        caseId: created.id,
        projectId,
        version: 2,
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionNotFoundError);
    await expect(
      plannedTests.version(accountId, {
        caseId: created.id,
        projectId,
      } as never),
    ).rejects.toThrow();
    await expect(
      plannedTests.version(accountId, {
        caseId: created.id,
        projectId,
        version: "latest",
      } as never),
    ).rejects.toThrow();
    await expect(
      plannedTests.version(accountId, {
        caseId: "missing",
        projectId,
        version: 1,
      }),
    ).rejects.toBeInstanceOf(PlannedTestCaseNotFoundError);
  });

  test("a relation change alone is a new version", async () => {
    const { plannedTests } = createMemoryHarness(catalog);
    const created = await plannedTests.create(accountId, newCase());

    const related = await plannedTests.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      relations: [{ targetId: "w1", targetType: "Work" }],
    });

    expect(related.current.version).toBe(2);
    expect(related.versions[0]?.relations).toEqual([]);
    expect(related.current.relations).toMatchObject([
      { label: "Build checkout", state: "resolved", targetType: "Work" },
    ]);
  });
});

describe("Planned Tests and Handoff seam: not a runner, session or package", () => {
  test("the public interface has no run, result, handoff or package operation; the only Session Test operations are record, link and list", () => {
    const { plannedTests } = createMemoryHarness();

    expect(Object.keys(plannedTests).sort()).toEqual([
      "create",
      "createVersion",
      "linkSessionTest",
      "list",
      "recordSessionTest",
      "relationTargets",
      "sessionTests",
      "version",
    ]);
  });

  test("a case record carries no result, status, step, runner, session or package field", async () => {
    const { plannedTests } = createMemoryHarness();

    const record = await plannedTests.create(accountId, newCase());

    expect(Object.keys(record).sort()).toEqual([
      "createdAt",
      "current",
      "id",
      "projectId",
      "updatedAt",
      "versions",
    ]);
    expect(Object.keys(record.current).sort()).toEqual([
      "caseId",
      "changeKind",
      "createdAt",
      "expectedBehavior",
      "id",
      "notes",
      "preconditions",
      "purpose",
      "relations",
      "scope",
      "title",
      "version",
    ]);
  });

  test.each([
    "result",
    "results",
    "status",
    "validated",
    "steps",
    "run",
    "checklist",
    "sessionId",
    "handoff_id",
    "schema_version",
    "handoff_package_version",
    "executor",
  ])("rejects a %s field on create and on a new version", async (field) => {
    const { plannedTests } = createMemoryHarness();
    const created = await plannedTests.create(accountId, newCase());

    await expect(
      plannedTests.create(accountId, newCase({ [field]: "x" } as never)),
    ).rejects.toThrow();
    await expect(
      plannedTests.createVersion(accountId, {
        ...content,
        [field]: "x",
        caseId: created.id,
        changeKind: "Meaningful change",
        expectedVersion: 1,
        projectId,
      } as never),
    ).rejects.toThrow();
  });

  test("the stored shape has no result, status, runner, session or package column", () => {
    const columns = [
      ...Object.keys(getTableColumns(plannedTestCase)),
      ...Object.keys(getTableColumns(plannedTestCaseVersion)),
      ...Object.keys(getTableColumns(plannedTestCaseRelation)),
    ];

    expect(columns.sort()).toEqual(
      [
        "caseId",
        "changeKind",
        "createdAt",
        "createdAt",
        "createdAt",
        "currentVersion",
        "documentRevision",
        "expectedBehavior",
        "id",
        "id",
        "id",
        "notes",
        "position",
        "preconditions",
        "projectId",
        "purpose",
        "scope",
        "sectionId",
        "targetId",
        "targetType",
        "title",
        "updatedAt",
        "version",
        "versionId",
      ].sort(),
    );
  });
});

describe("Planned Tests and Handoff seam: ownership and authorization", () => {
  test("another account or an unknown Project cannot list, create, version or read", async () => {
    const { plannedTests } = createMemoryHarness();
    const created = await plannedTests.create(accountId, newCase());

    for (const run of [
      () => plannedTests.list("stranger", projectId),
      () => plannedTests.list(accountId, "elsewhere"),
      () => plannedTests.create("stranger", newCase()),
      () => plannedTests.create(accountId, newCase({ projectId: "elsewhere" })),
      () =>
        plannedTests.createVersion("stranger", {
          ...content,
          caseId: created.id,
          changeKind: "Meaningful change",
          expectedVersion: 1,
          projectId,
          purpose: "Hijack",
        }),
      () =>
        plannedTests.version("stranger", {
          caseId: created.id,
          projectId,
          version: 1,
        }),
      () =>
        plannedTests.relationTargets("stranger", {
          projectId,
          targetType: "Work",
        }),
    ]) {
      await expect(run()).rejects.toBeInstanceOf(
        PlannedTestProjectNotFoundError,
      );
    }
  });

  test("a case id from another Project is not found through this Project", async () => {
    const { plannedTests } = createMemoryHarness();
    const created = await plannedTests.create(accountId, newCase());

    await expect(
      plannedTests.version(accountId, {
        caseId: created.id,
        projectId: archivedProjectId,
        version: 1,
      }),
    ).rejects.toBeInstanceOf(PlannedTestCaseNotFoundError);
  });

  test("an archived Project stays readable and refuses writes", async () => {
    const { plannedTests } = createMemoryHarness();

    expect(await plannedTests.list(accountId, archivedProjectId)).toEqual({
      cases: [],
      readOnly: true,
    });
    await expect(
      plannedTests.create(accountId, newCase({ projectId: archivedProjectId })),
    ).rejects.toBeInstanceOf(PlannedTestProjectReadOnlyError);
  });
});

describe("Planned Tests and Handoff seam: relation targets", () => {
  const resolvable = [
    { targetId: "w1", targetType: "Work" },
    { targetId: "f1", targetType: "Feature" },
    {
      documentRevision: 4,
      sectionId: "payment",
      targetId: "d1",
      targetType: "Document",
    },
    { targetId: "dec1", targetType: "Decision" },
    { targetId: "r1", targetType: "Risk" },
    { targetId: "g1", targetType: "Project Goal" },
    { targetId: "m1", targetType: "Milestone" },
    { targetId: "s1", targetType: "Source" },
    { targetId: "sc1", targetType: "Screen" },
  ] as const;

  test("lists the Project's targets and resolves one relation for every owned family", async () => {
    const { plannedTests } = createMemoryHarness(catalog);

    expect(resolvable.map(({ targetType }) => targetType).sort()).toEqual(
      [...PLANNED_TEST_RELATION_TARGET_TYPES].sort(),
    );
    for (const relation of resolvable) {
      const listed = await plannedTests.relationTargets(accountId, {
        projectId,
        targetType: relation.targetType,
      });
      expect(listed.map(({ targetId }) => targetId)).toEqual([
        relation.targetId,
      ]);
    }
    const record = await plannedTests.create(
      accountId,
      newCase({ relations: [...resolvable] }),
    );
    expect(record.current.relations).toHaveLength(resolvable.length);
    expect(
      record.current.relations.every(({ state }) => state === "resolved"),
    ).toBe(true);
    expect(
      record.current.relations.find(
        ({ targetType }) => targetType === "Document",
      ),
    ).toMatchObject({
      documentRevision: 4,
      label: "Checkout spec",
      sectionId: "payment",
      sectionLabel: "Payment",
    });
  });

  test("offers a Document with its current revision and stable sections", async () => {
    const { plannedTests } = createMemoryHarness(catalog);

    const [document] = await plannedTests.relationTargets(accountId, {
      projectId,
      targetType: "Document",
    });

    expect(document).toMatchObject({
      documentRevision: 4,
      sections: [{ id: "payment", label: "Payment" }],
    });
  });

  test("rejects a target without an owner record, another Project's record or a title-only relation", async () => {
    const { plannedTests } = createMemoryHarness(catalog);

    for (const relation of [
      { targetId: "does-not-exist", targetType: "Work" },
      { targetId: "w-other", targetType: "Work" },
      { targetId: "w1", targetType: "Risk" },
      {
        documentRevision: 4,
        sectionId: "no-such-section",
        targetId: "d1",
        targetType: "Document",
      },
    ] as const) {
      await expect(
        plannedTests.create(accountId, newCase({ relations: [relation] })),
      ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    }
    await expect(
      plannedTests.create(
        accountId,
        newCase({
          relations: [{ targetType: "Work", title: "Build checkout" } as never],
        }),
      ),
    ).rejects.toThrow();
    expect((await plannedTests.list(accountId, projectId)).cases).toEqual([]);
  });

  test("rejects Project Release and GitHub records, which have no resolver yet", async () => {
    const { plannedTests } = createMemoryHarness(catalog);

    for (const targetType of [
      "Project Release",
      "GitHub PR",
      "GitHub external",
      "Repository",
      "Branch",
      "Commit",
    ]) {
      await expect(
        plannedTests.create(
          accountId,
          newCase({ relations: [{ targetId: "x", targetType } as never] }),
        ),
      ).rejects.toThrow();
    }
  });

  test("a Document relation names the exact current revision, not a stale or invented one", async () => {
    const { plannedTests } = createMemoryHarness(catalog);

    await expect(
      plannedTests.create(
        accountId,
        newCase({
          relations: [
            { documentRevision: 3, targetId: "d1", targetType: "Document" },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    await expect(
      plannedTests.create(
        accountId,
        newCase({
          relations: [{ targetId: "d1", targetType: "Document" } as never],
        }),
      ),
    ).rejects.toThrow();
    await expect(
      plannedTests.create(
        accountId,
        newCase({
          relations: [
            {
              documentRevision: 1,
              targetId: "w1",
              targetType: "Work",
            } as never,
          ],
        }),
      ),
    ).rejects.toThrow();
  });

  test("refuses archived and trashed targets for a new relation and a repeated relation", async () => {
    const harness = createMemoryHarness(catalog);
    harness.setState("Risk", "r1", "trashed");
    harness.setState("Source", "s1", "archived");

    for (const relation of [
      { targetId: "r1", targetType: "Risk" },
      { targetId: "s1", targetType: "Source" },
    ] as const) {
      await expect(
        harness.plannedTests.create(
          accountId,
          newCase({ relations: [relation] }),
        ),
      ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    }
    await expect(
      harness.plannedTests.create(
        accountId,
        newCase({
          relations: [
            { targetId: "w1", targetType: "Work" },
            { targetId: "w1", targetType: "Work" },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
  });

  test("a relation whose target later goes away reads as broken and never as another record", async () => {
    const harness = createMemoryHarness(catalog);
    const created = await harness.plannedTests.create(
      accountId,
      newCase({
        relations: [
          { targetId: "r1", targetType: "Risk" },
          { targetId: "dec1", targetType: "Decision" },
          { targetId: "m1", targetType: "Milestone" },
        ],
      }),
    );
    harness.setState("Risk", "r1", "trashed");
    harness.setState("Decision", "dec1", "archived");
    harness.setState("Milestone", "m1", "gone");

    const {
      cases: [listed],
    } = await harness.plannedTests.list(accountId, projectId);

    expect(
      listed?.current.relations.map(
        ({ brokenReason, label, state, targetId }) => ({
          brokenReason,
          label,
          state,
          targetId,
        }),
      ),
    ).toEqual([
      {
        brokenReason: "In Trash",
        label: null,
        state: "broken",
        targetId: "r1",
      },
      {
        brokenReason: "Archived",
        label: null,
        state: "broken",
        targetId: "dec1",
      },
      {
        brokenReason: "Permanently deleted",
        label: null,
        state: "broken",
        targetId: "m1",
      },
    ]);
    expect(listed?.id).toBe(created.id);
  });

  test("a broken relation already on the case does not block editing the rest", async () => {
    const harness = createMemoryHarness(catalog);
    const created = await harness.plannedTests.create(
      accountId,
      newCase({ relations: [{ targetId: "r1", targetType: "Risk" }] }),
    );
    harness.setState("Risk", "r1", "trashed");

    const edited = await harness.plannedTests.createVersion(accountId, {
      ...content,
      caseId: created.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      purpose: "Confirm checkout completes quickly.",
      relations: [{ targetId: "r1", targetType: "Risk" }],
    });

    expect(edited.current.version).toBe(2);
    expect(edited.current.relations[0]).toMatchObject({
      brokenReason: "In Trash",
      state: "broken",
    });
  });
});
