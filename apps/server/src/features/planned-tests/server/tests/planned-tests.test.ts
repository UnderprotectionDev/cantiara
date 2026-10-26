// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
// biome-ignore-all lint/performance/noAwaitInLoops: Each state is driven in sequence against one Handoff.
import {
  externalExecutionHandoffInputSchema,
  renderExternalExecutionHandoffPackage,
} from "@cantiara/api/external-handoffs";
import {
  type CreatePlannedTestCaseInput,
  PLANNED_TEST_RELATION_TARGET_TYPES,
  TEST_HANDOFF_STATES,
  TEST_HANDOFF_TRANSITIONS,
  type TestHandoffState,
} from "@cantiara/api/planned-tests";
import {
  plannedTestCase,
  plannedTestCaseRelation,
  plannedTestCaseVersion,
  testHandoff,
  testHandoffScenario,
  testHandoffSessionTest,
} from "@cantiara/db/schema/planned-test";
import { workExternalExecutionHandoff } from "@cantiara/db/schema/work-external-handoff";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import {
  PlannedTestCaseNotFoundError,
  PlannedTestNoChangeError,
  PlannedTestProjectNotFoundError,
  PlannedTestProjectReadOnlyError,
  PlannedTestRelationTargetError,
  PlannedTestVersionConflictError,
  PlannedTestVersionNotFoundError,
  SessionTestAlreadyBoundError,
  SessionTestAlreadyInHandoffError,
  SessionTestNotFoundError,
  TestHandoffLockedError,
  TestHandoffNotFoundError,
  TestHandoffPackageBlockedError,
  TestHandoffPackageStaleError,
  TestHandoffPackageStateError,
  TestHandoffScopeMismatchError,
  TestHandoffStateConflictError,
  TestHandoffTransitionError,
} from "../planned-tests";
import {
  accountId,
  archivedProjectId,
  type CatalogEntry,
  createMemoryHarness,
  projectId,
  projectName,
} from "../planned-tests-memory-store";

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
  test("the public interface has no run, start or result operation; the only Test Handoff operations are open, edit, move, link, list and preview, produce and read the package", () => {
    const { plannedTests } = createMemoryHarness();

    expect(Object.keys(plannedTests).sort()).toEqual([
      "contextTargets",
      "create",
      "createHandoff",
      "createVersion",
      "handoffs",
      "linkHandoffSessionTest",
      "linkSessionTest",
      "list",
      "packages",
      "previewPackage",
      "producePackage",
      "recordSessionTest",
      "relationTargets",
      "sessionTests",
      "transitionHandoff",
      "updateHandoff",
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

const definition = {
  expectedBehavior: "The order is confirmed and a receipt is shown.",
  preconditions: "A signed-in customer with one item in the cart.",
  purpose: "Confirm checkout completes.",
  scope: "Card payment only; no coupons.",
  title: "Checkout with a saved card",
};

async function setup() {
  const harness = createMemoryHarness();
  const created = await harness.plannedTests.create(accountId, {
    ...definition,
    projectId,
  });
  return { ...harness, caseId: created.id };
}

type Harness = Awaited<ReturnType<typeof setup>>;

function editVersion(
  harness: Harness,
  expectedVersion: number,
  changeKind: "Editorial change" | "Meaningful change",
  overrides: Partial<typeof definition> = {},
) {
  return harness.plannedTests.createVersion(accountId, {
    ...definition,
    ...overrides,
    caseId: harness.caseId,
    changeKind,
    expectedVersion,
    projectId,
  });
}

describe("Session Test pins the exact Planned Test Case version", () => {
  test("a v1 bind stays on v1 and a v1 result never validates v2 or v3", async () => {
    const harness = await setup();
    const recorded = await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 1 },
      projectId,
      title: "Pay with the saved card",
    });
    expect(recorded.bind).toMatchObject({
      currentVersion: 1,
      executedVersion: 1,
      origin: "Bound when recorded",
      pinnedVersion: 1,
      summary: "Bound to v1, current",
      validatesCurrentVersion: true,
    });

    await editVersion(harness, 1, "Meaningful change", {
      expectedBehavior: "The order is confirmed and an email is sent.",
    });
    await editVersion(harness, 2, "Meaningful change", {
      title: "Checkout with a saved card or wallet",
    });

    const { sessionTests } = await harness.plannedTests.sessionTests(
      accountId,
      projectId,
    );
    expect(sessionTests).toHaveLength(1);
    expect(sessionTests[0]?.bind).toMatchObject({
      caseId: harness.caseId,
      changesSinceBound: [
        { changeKind: "Meaningful change", version: 2 },
        { changeKind: "Meaningful change", version: 3 },
      ],
      currentVersion: 3,
      executedVersion: 1,
      pinnedTitle: "Checkout with a saved card",
      pinnedVersion: 1,
      summary: "Bound to v1, current v3",
      validatesCurrentVersion: false,
    });
  });

  test("an editorial change does not move the bind and keeps the difference visible", async () => {
    const harness = await setup();
    await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 1 },
      projectId,
      title: "Pay with the saved card",
    });

    await editVersion(harness, 1, "Editorial change", {
      scope: "Card payment only; coupons are out of scope.",
    });

    const { sessionTests } = await harness.plannedTests.sessionTests(
      accountId,
      projectId,
    );
    expect(sessionTests[0]?.bind).toMatchObject({
      changesSinceBound: [{ changeKind: "Editorial change", version: 2 }],
      pinnedVersion: 1,
      summary: "Bound to v1, current v2",
      validatesCurrentVersion: false,
    });
  });

  test("a bound test is not given a copy of the definition that could drift", async () => {
    const harness = await setup();
    const recorded = await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 1 },
      projectId,
      title: "Pay with the saved card",
    });

    expect(recorded).toMatchObject({ expectedBehavior: null, purpose: null });
    await expect(
      harness.plannedTests.recordSessionTest(accountId, {
        binding: { caseId: harness.caseId, version: 1 },
        projectId,
        purpose: "Copy",
        title: "x",
      }),
    ).rejects.toThrow();
  });

  test("a bind names an existing exact version of a Planned Test Case of this Project", async () => {
    const harness = await setup();
    const own = harness.cases.get(harness.caseId);
    if (!own) {
      throw new Error("Expected the case.");
    }
    harness.cases.set("foreign-case", {
      ...own,
      id: "foreign-case",
      projectId: archivedProjectId,
    });
    const foreign = { id: "foreign-case" };

    await expect(
      harness.plannedTests.recordSessionTest(accountId, {
        binding: { caseId: harness.caseId, version: 2 },
        projectId,
        title: "x",
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionNotFoundError);
    await expect(
      harness.plannedTests.recordSessionTest(accountId, {
        binding: { caseId: foreign.id, version: 1 },
        projectId,
        title: "x",
      }),
    ).rejects.toBeInstanceOf(PlannedTestCaseNotFoundError);
    await expect(
      harness.plannedTests.recordSessionTest(accountId, {
        binding: { caseId: harness.caseId, version: 1 },
        projectId: "elsewhere",
        title: "x",
      }),
    ).rejects.toBeInstanceOf(PlannedTestProjectNotFoundError);
    await expect(
      harness.plannedTests.recordSessionTest(accountId, {
        // @ts-expect-error a bind has no "latest" form
        binding: { caseId: harness.caseId, version: "latest" },
        projectId,
        title: "x",
      }),
    ).rejects.toThrow();
    expect(harness.sessionTests.size).toBe(0);
  });
});

describe("ad hoc Session Test", () => {
  const adHoc = {
    expectedBehavior: "The order total shows tax.",
    projectId,
    purpose: "Check tax display while the case does not exist yet.",
    title: "Tax line on checkout",
  };

  test("is allowed without a case and stores the then-current content", async () => {
    const { plannedTests } = await setup();
    const recorded = await plannedTests.recordSessionTest(accountId, adHoc);

    expect(recorded).toMatchObject({
      bind: null,
      expectedBehavior: adHoc.expectedBehavior,
      purpose: adHoc.purpose,
      title: adHoc.title,
    });
  });

  test("requires its own purpose and expected behavior", async () => {
    const { plannedTests } = await setup();

    await expect(
      plannedTests.recordSessionTest(accountId, {
        projectId,
        title: "No content",
      }),
    ).rejects.toThrow();
    await expect(
      plannedTests.recordSessionTest(accountId, {
        projectId,
        purpose: "Only a purpose",
        title: "Half content",
      }),
    ).rejects.toThrow();
  });

  test("a late bind keeps the recorded content and does not count the version as executed", async () => {
    const harness = await setup();
    const recorded = await harness.plannedTests.recordSessionTest(
      accountId,
      adHoc,
    );
    await editVersion(harness, 1, "Meaningful change", {
      expectedBehavior: "The order total shows tax and shipping.",
    });

    const linked = await harness.plannedTests.linkSessionTest(accountId, {
      caseId: harness.caseId,
      projectId,
      sessionTestId: recorded.id,
      version: 2,
    });

    expect(linked).toMatchObject({
      expectedBehavior: adHoc.expectedBehavior,
      id: recorded.id,
      purpose: adHoc.purpose,
      title: adHoc.title,
    });
    expect(linked.bind).toMatchObject({
      executedVersion: null,
      origin: "Linked later",
      pinnedVersion: 2,
      summary: "Linked later to v2, not executed against it, current",
      validatesCurrentVersion: false,
    });
    expect(linked.bind?.linkedAt).toEqual(expect.any(String));
    expect(harness.sessionTests.get(recorded.id)).toMatchObject({
      createdAt: recorded.createdAt,
      expectedBehavior: adHoc.expectedBehavior,
      purpose: adHoc.purpose,
    });

    await editVersion(harness, 2, "Editorial change", {
      scope: "Card payment only.",
    });
    const { sessionTests } = await harness.plannedTests.sessionTests(
      accountId,
      projectId,
    );
    expect(sessionTests[0]?.bind).toMatchObject({
      executedVersion: null,
      pinnedVersion: 2,
      summary: "Linked later to v2, not executed against it, current v3",
      validatesCurrentVersion: false,
    });
    expect(sessionTests[0]?.purpose).toBe(adHoc.purpose);
  });

  test("a late bind is exact and final, never a move", async () => {
    const harness = await setup();
    await editVersion(harness, 1, "Meaningful change", {
      scope: "Card and wallet payment.",
    });
    const adHocTest = await harness.plannedTests.recordSessionTest(
      accountId,
      adHoc,
    );
    const bound = await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 1 },
      projectId,
      title: "Bound at record time",
    });
    const link = (sessionTestId: string, version: number) =>
      harness.plannedTests.linkSessionTest(accountId, {
        caseId: harness.caseId,
        projectId,
        sessionTestId,
        version,
      });

    await link(adHocTest.id, 1);
    await expect(link(adHocTest.id, 2)).rejects.toBeInstanceOf(
      SessionTestAlreadyBoundError,
    );
    await expect(link(bound.id, 2)).rejects.toBeInstanceOf(
      SessionTestAlreadyBoundError,
    );
    await expect(link("missing", 1)).rejects.toBeInstanceOf(
      SessionTestNotFoundError,
    );
    expect(harness.sessionTests.get(adHocTest.id)?.scenarioVersion).toBe(1);
    expect(harness.sessionTests.get(bound.id)?.scenarioVersion).toBe(1);
  });

  test("refuses a late bind to a version that does not exist", async () => {
    const harness = await setup();
    const recorded = await harness.plannedTests.recordSessionTest(
      accountId,
      adHoc,
    );

    await expect(
      harness.plannedTests.linkSessionTest(accountId, {
        caseId: harness.caseId,
        projectId,
        sessionTestId: recorded.id,
        version: 5,
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionNotFoundError);
    expect(harness.sessionTests.get(recorded.id)?.scenarioId).toBeNull();
  });

  test("an archived Project takes no new Session Test but stays readable", async () => {
    const { plannedTests } = await setup();

    await expect(
      plannedTests.recordSessionTest(accountId, {
        ...adHoc,
        projectId: archivedProjectId,
      }),
    ).rejects.toBeInstanceOf(PlannedTestProjectReadOnlyError);
    expect(
      await plannedTests.sessionTests(accountId, archivedProjectId),
    ).toEqual({ readOnly: true, sessionTests: [] });
  });
});

describe("a Planned Test Case never reflects a bind", () => {
  test("binding a Session Test leaves the case record without execution or result fields", async () => {
    const harness = await setup();
    const before = await harness.plannedTests.list(accountId, projectId);
    await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 1 },
      projectId,
      title: "Pay with the saved card",
    });

    expect(await harness.plannedTests.list(accountId, projectId)).toEqual(
      before,
    );
  });
});

// The expected key sets below are written from the PRD table "Test Handoff
// paketi sozlesmesi" (docs/prd/10-testing-and-validation.md), not produced by
// the code under test.
const PRD_PACKAGE_KEYS = [
  "ad_hoc_scope",
  "created_at",
  "design_references",
  "document_context",
  "environment_preconditions",
  "handoff_id",
  "handoff_package_version",
  "product_build_context",
  "project",
  "purpose",
  "return_instructions",
  "scenarios",
  "schema_version",
  "title",
  "work_context",
] as const;
const PRD_SCENARIO_KEYS = [
  "expected_behavior",
  "notes",
  "preconditions",
  "purpose",
  "scenario_id",
  "scenario_version",
  "scope",
  "title",
] as const;
// Required by the PRD return_instructions row.
const PRD_REQUIRED_RETURN_FIELDS = [
  "schema_version",
  "project_id",
  "external_session_id",
  "executor",
  "reported_at",
  "handoff_id",
];
const PRD_OPTIONAL_RETURN_FIELDS = [
  "context",
  "summary",
  "raw_report",
  "notes",
  "evidence",
  "relations",
];

const RFC_3339_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const LATEST_MARKER = /latest|en g.ncel/i;
const RUNNER_NAME =
  /start|run|poll|schedul|execut|dispatch|trigger|cancel|deliver|authori[sz]e|grant|write.?back/i;
const SCENARIO_ID_LINE = /Scenario id: `([^`]+)`/g;
const SCENARIO_VERSION_LINE = /Scenario version: (\d+)/g;

const SECRET_WORD = /secret/i;
const RAW_SECRET = /ghp_|sk-|AKIA|BEGIN .*PRIVATE KEY/;
const ATTACHMENT_KEY = /"(attachments?|evidence|files?)"\s*:/;
const TEST_SCOPE_KEY = /scenario|return_instructions|test/i;
const TOOL_GRANT_KEY =
  /"(command|schedule|webhook|callback_url|token|api_key|write_back|permission|grant)"/i;

const GITHUB_TOKEN = `ghp_${"a1B2c3D4e5F6g7H8i9J0".repeat(2)}`;

const definitionTestHandoffPackage = {
  expectedBehavior: "The order is confirmed and a receipt is shown.",
  notes: "Use the sandbox gateway only.",
  preconditions: "A signed-in customer with one item in the cart.",
  purpose: "Confirm checkout completes.",
  scope: "Card payment only; no coupons.",
  title: "Checkout with a saved card",
};

function catalogTestHandoffPackage() {
  return [
    {
      label: "Checkout rewrite",
      projectId,
      targetId: "work-1",
      targetType: "Work" as const,
    },
    {
      label: "Not selected work",
      projectId,
      targetId: "work-2",
      targetType: "Work" as const,
    },
    {
      label: "Saved cards",
      projectId,
      targetId: "feature-1",
      targetType: "Feature" as const,
    },
    {
      documentRevision: 3,
      label: "Checkout spec",
      projectId,
      sections: [{ id: "payment", label: "Payment" }],
      targetId: "doc-1",
      targetType: "Document" as const,
    },
    {
      label: "Checkout screen",
      projectId,
      targetId: "screen-1",
      targetType: "Screen" as const,
      wireframeVersions: [1, 2],
    },
    {
      label: "Other project work",
      projectId: "project-other",
      targetId: "work-x",
      targetType: "Work" as const,
    },
  ];
}

async function setupTestHandoffPackage() {
  const harness = createMemoryHarness(catalogTestHandoffPackage());
  const created = await harness.plannedTests.create(accountId, {
    ...definitionTestHandoffPackage,
    projectId,
  });
  const unselected = await harness.plannedTests.create(accountId, {
    ...definitionTestHandoffPackage,
    projectId,
    title: "Unselected wallet case",
  });
  return { ...harness, caseId: created.id, unselectedId: unselected.id };
}

type HarnessTestHandoffPackage = Awaited<
  ReturnType<typeof setupTestHandoffPackage>
>;

function openHandoff(
  harness: HarnessTestHandoffPackage,
  overrides: object = {},
) {
  return harness.plannedTests.createHandoff(accountId, {
    adHocScope: [
      {
        expectedBehavior: "Tax is shown before payment.",
        intent: "Check the tax line.",
      },
    ],
    buildContext: {
      branch: "main",
      commit: "abc1234def",
      repository: "https://github.com/acme/shop",
      targetEnvironment: "staging",
    },
    contextRefs: [
      { kind: "Work", targetId: "work-1" },
      { kind: "Feature", targetId: "feature-1" },
      {
        documentRevision: 3,
        kind: "Document",
        sectionId: "payment",
        targetId: "doc-1",
      },
      { kind: "Wireframe", targetId: "screen-1", wireframeVersion: 2 },
    ],
    environmentPreconditions: "Use the staging tenant; ask me for the login.",
    projectId,
    purpose: "Check the checkout flow on the staging build.",
    scenarios: [{ caseId: harness.caseId, version: 1 }],
    targetExecutor: "Codex",
    title: "Checkout regression, round 1",
    ...overrides,
  });
}

const PATH: Record<TestHandoffState, TestHandoffState[]> = {
  Canceled: ["Canceled"],
  Closed: ["Ready to share", "Shared", "Closed"],
  Draft: [],
  "Ready to share": ["Ready to share"],
  "Result received": ["Ready to share", "Shared", "Result received"],
  Shared: ["Ready to share", "Shared"],
};

async function reach(
  harness: HarnessTestHandoffPackage,
  target: TestHandoffState,
  overrides: object = {},
) {
  let handoff = await openHandoff(harness, overrides);
  for (const to of PATH[target]) {
    handoff = await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: handoff.state,
      handoffId: handoff.id,
      projectId,
      to,
    });
  }
  return handoff;
}

async function produce(harness: HarnessTestHandoffPackage, handoffId: string) {
  const preview = await harness.plannedTests.previewPackage(accountId, {
    handoffId,
    projectId,
  });
  if (!preview.fingerprint) {
    throw new Error("Preview was blocked.");
  }
  return await harness.plannedTests.producePackage(accountId, {
    expectedPackageVersion: preview.nextPackageVersion,
    handoffId,
    previewFingerprint: preview.fingerprint,
    projectId,
  });
}

describe("Test Handoff package contract", () => {
  test("carries exactly the closed PRD key set, with values from the Handoff", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");

    const produced = await produce(harness, handoff.id);
    const json = produced.package as unknown as Record<string, unknown>;

    expect(Object.keys(json).sort()).toEqual([...PRD_PACKAGE_KEYS]);
    expect(json.schema_version).toBe("test-handoff-package/1");
    expect(json.handoff_id).toBe(handoff.id);
    expect(json.handoff_package_version).toBe(1);
    expect(json.project).toEqual({ id: projectId, name: projectName });
    expect(json.title).toBe("Checkout regression, round 1");
    expect(json.purpose).toBe("Check the checkout flow on the staging build.");
    expect(String(json.created_at)).toMatch(RFC_3339_WITH_OFFSET);
    expect(json.product_build_context).toEqual({
      branch: "main",
      commit: "abc1234def",
      repository: "https://github.com/acme/shop",
      target_environment: "staging",
    });
    expect(json.environment_preconditions).toBe(
      "Use the staging tenant; ask me for the login.",
    );
    expect(json.work_context).toEqual([
      { id: "work-1", title: "Checkout rewrite" },
      { id: "feature-1", title: "Saved cards" },
    ]);
    expect(json.document_context).toEqual([
      {
        document_id: "doc-1",
        revision: 3,
        section_id: "payment",
        title: "Checkout spec",
      },
    ]);
    expect(json.design_references).toEqual([
      {
        kind: "Wireframe",
        screen_id: "screen-1",
        title: "Checkout screen",
        version: 2,
      },
    ]);
    expect(json.ad_hoc_scope).toEqual([
      {
        expected_behavior: "Tax is shown before payment.",
        intent: "Check the tax line.",
      },
    ]);
  });

  test("copies every scenario field of the exact version, never the title only", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");

    const { package: json } = await produce(harness, handoff.id);

    expect(json.scenarios).toHaveLength(1);
    const [scenario] = json.scenarios;
    expect(Object.keys(scenario ?? {}).sort()).toEqual([...PRD_SCENARIO_KEYS]);
    expect(scenario).toEqual({
      expected_behavior: definitionTestHandoffPackage.expectedBehavior,
      notes: definitionTestHandoffPackage.notes,
      preconditions: definitionTestHandoffPackage.preconditions,
      purpose: definitionTestHandoffPackage.purpose,
      scenario_id: harness.caseId,
      scenario_version: 1,
      scope: definitionTestHandoffPackage.scope,
      title: definitionTestHandoffPackage.title,
    });
  });

  test("return instructions follow the PRD row and name test-report/1 as the only structured return", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");

    const { package: json } = await produce(harness, handoff.id);
    const instructions = json.return_instructions;

    expect(instructions.accepted_return).toBe("test-report/1");
    for (const field of PRD_REQUIRED_RETURN_FIELDS) {
      expect(instructions.required_fields).toContain(field);
    }
    expect(instructions.required_result_fields).toEqual(["external_test_id"]);
    expect(instructions.conditional_result_fields).toEqual([
      "scenario_id",
      "scenario_version",
    ]);
    expect(instructions.optional_fields).toEqual(PRD_OPTIONAL_RETURN_FIELDS);
    expect(instructions.expected_values).toEqual({
      handoff_id: handoff.id,
      handoff_package_version: 1,
      project_id: projectId,
      schema_version: "test-report/1",
    });
  });

  test("Markdown and JSON carry the same scenarios and references; neither holds an unselected record", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");

    const produced = await produce(harness, handoff.id);
    const { markdown, json, package: pkg } = produced;

    expect(JSON.parse(json)).toEqual(pkg);
    expect(
      [...markdown.matchAll(SCENARIO_ID_LINE)].map((match) => match[1]),
    ).toEqual(pkg.scenarios.map((scenario) => scenario.scenario_id));
    expect(
      [...markdown.matchAll(SCENARIO_VERSION_LINE)].map((match) =>
        Number(match[1]),
      ),
    ).toEqual(pkg.scenarios.map((scenario) => scenario.scenario_version));
    expect(markdown).toContain("Package version: 1");
    expect(markdown).toContain(handoff.id);
    for (const ref of [
      "work-1",
      "feature-1",
      "doc-1",
      "payment",
      "screen-1",
      "Checkout rewrite",
      "Saved cards",
      "Checkout spec",
      "Checkout screen",
    ]) {
      expect(markdown).toContain(ref);
      expect(json).toContain(ref);
    }
    for (const unselected of [
      harness.unselectedId,
      "Unselected wallet case",
      "work-2",
      "Not selected work",
      "work-x",
    ]) {
      expect(markdown).not.toContain(unselected);
      expect(json).not.toContain(unselected);
    }
  });

  test("never marks a version as the latest", async () => {
    const harness = await setupTestHandoffPackage();
    await harness.plannedTests.createVersion(accountId, {
      ...definitionTestHandoffPackage,
      caseId: harness.caseId,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Card and wallet payment.",
    });
    const handoff = await reach(harness, "Ready to share");

    const produced = await produce(harness, handoff.id);

    expect(produced.json).not.toMatch(LATEST_MARKER);
    expect(produced.markdown).not.toMatch(LATEST_MARKER);
    expect(produced.package.scenarios[0]).toMatchObject({
      scenario_version: 1,
      scope: definitionTestHandoffPackage.scope,
    });
  });

  test("a fresh Handoff with nothing optional still yields the full key set with empty sections", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share", {
      adHocScope: [],
      buildContext: {},
      contextRefs: [],
      environmentPreconditions: null,
      scenarios: [],
    });

    const { package: json } = await produce(harness, handoff.id);

    expect(Object.keys(json).sort()).toEqual([...PRD_PACKAGE_KEYS]);
    expect(json.product_build_context).toEqual({});
    expect(json.scenarios).toEqual([]);
    expect(json.environment_preconditions).toBeNull();
  });
});

describe("Test Handoff package is a snapshot with an incrementing version", () => {
  test("a produced package ignores later case, work and Handoff edits; a new version reflects them", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");
    const first = await produce(harness, handoff.id);

    await harness.plannedTests.createVersion(accountId, {
      ...definitionTestHandoffPackage,
      caseId: harness.caseId,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Rewritten scope.",
    });
    const entry = harness.catalog.get("Work:work-1");
    if (entry) {
      entry.label = "Renamed work";
    }
    await harness.plannedTests.updateHandoff(accountId, {
      buildContext: { branch: "release" },
      contextRefs: [{ kind: "Work", targetId: "work-1" }],
      handoffId: handoff.id,
      projectId,
      purpose: "Edited purpose.",
      scenarios: [{ caseId: harness.caseId, version: 2 }],
      title: "Edited title",
    });

    const stored = await harness.plannedTests.packages(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    expect(stored.packages).toHaveLength(1);
    expect(stored.packages[0]?.json).toBe(first.json);
    expect(stored.packages[0]?.markdown).toBe(first.markdown);
    expect(stored.packages[0]?.package.scenarios[0]).toMatchObject({
      scenario_version: 1,
      scope: definitionTestHandoffPackage.scope,
    });
    expect(stored.packages[0]?.package.work_context[0]?.title).toBe(
      "Checkout rewrite",
    );

    const second = await produce(harness, handoff.id);
    expect(second.packageVersion).toBe(2);
    expect(second.package).toMatchObject({
      handoff_package_version: 2,
      purpose: "Edited purpose.",
      title: "Edited title",
    });
    expect(second.package.scenarios[0]).toMatchObject({
      scenario_version: 2,
      scope: "Rewritten scope.",
    });
    expect(second.package.work_context[0]?.title).toBe("Renamed work");
    const listed = await harness.plannedTests.packages(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    expect(listed.packages.map((item) => item.packageVersion)).toEqual([2, 1]);
    expect(listed.packages[1]?.json).toBe(first.json);
  });

  test("the version counter increments once per produced package in the same unit as the stored package", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Shared");
    expect(handoff.packageVersion).toBe(0);

    for (const expected of [1, 2, 3]) {
      const produced = await produce(harness, handoff.id);
      expect(produced.packageVersion).toBe(expected);
      expect(harness.handoffs.get(handoff.id)?.packageVersion).toBe(expected);
    }
    expect(harness.packages.get(handoff.id)).toHaveLength(3);
  });

  test("a preview writes nothing", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");

    const preview = await harness.plannedTests.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });

    expect(preview).toMatchObject({
      blockers: [],
      canProduce: true,
      nextPackageVersion: 1,
    });
    expect(preview.json).toContain("test-handoff-package/1");
    expect(preview.markdown).toContain("Package version: 1");
    expect(harness.handoffs.get(handoff.id)?.packageVersion).toBe(0);
    expect(harness.packages.get(handoff.id)).toBeUndefined();
  });

  test("the preview lists what is included and what a package never holds", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");

    const preview = await harness.plannedTests.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });

    expect(preview.included).toEqual([
      { count: 1, section: "scenarios" },
      { count: 1, section: "ad_hoc_scope" },
      { count: 2, section: "work_context" },
      { count: 1, section: "document_context" },
      { count: 1, section: "design_references" },
    ]);
    expect(preview.excluded).toEqual(
      expect.arrayContaining([
        "Records you did not select",
        "Secrets, tokens and credentials",
      ]),
    );
  });

  test("confirm is refused when the previewed version or content is stale", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");
    const preview = await harness.plannedTests.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    const fingerprint = preview.fingerprint ?? "";

    await expect(
      harness.plannedTests.producePackage(accountId, {
        expectedPackageVersion: 2,
        handoffId: handoff.id,
        previewFingerprint: fingerprint,
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestHandoffPackageStaleError);
    await expect(
      harness.plannedTests.producePackage(accountId, {
        expectedPackageVersion: 1,
        handoffId: handoff.id,
        previewFingerprint: "0".repeat(64),
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestHandoffPackageStaleError);

    await harness.plannedTests.updateHandoff(accountId, {
      handoffId: handoff.id,
      projectId,
      purpose: "Changed after the preview.",
      title: "Checkout regression, round 1",
    });
    await expect(
      harness.plannedTests.producePackage(accountId, {
        expectedPackageVersion: 1,
        handoffId: handoff.id,
        previewFingerprint: fingerprint,
        projectId,
      }),
    ).rejects.toBeInstanceOf(TestHandoffPackageStaleError);
    expect(harness.packages.get(handoff.id)).toBeUndefined();
    expect(harness.handoffs.get(handoff.id)?.packageVersion).toBe(0);
  });

  test("a repeated confirm cannot claim the same version twice", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");
    const preview = await harness.plannedTests.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });
    const confirm = {
      expectedPackageVersion: 1,
      handoffId: handoff.id,
      previewFingerprint: preview.fingerprint ?? "",
      projectId,
    };

    await harness.plannedTests.producePackage(accountId, confirm);
    await expect(
      harness.plannedTests.producePackage(accountId, confirm),
    ).rejects.toBeInstanceOf(TestHandoffPackageStaleError);
    expect(harness.packages.get(handoff.id)).toHaveLength(1);
  });
});

describe("Which Handoff states may produce a package", () => {
  const allowed: TestHandoffState[] = ["Ready to share", "Shared"];

  for (const state of TEST_HANDOFF_STATES) {
    const may = allowed.includes(state);
    test(`${state} ${may ? "produces" : "refuses"} a package and keeps its state`, async () => {
      const harness = await setupTestHandoffPackage();
      const handoff = await reach(harness, state);
      expect(handoff.state).toBe(state);

      const preview = await harness.plannedTests.previewPackage(accountId, {
        handoffId: handoff.id,
        projectId,
      });
      expect(preview.canProduce).toBe(may);
      if (may) {
        const produced = await produce(harness, handoff.id);
        expect(produced.packageVersion).toBe(1);
      } else {
        expect(preview.blockers).toMatchObject([{ kind: "state" }]);
        expect(preview.json).toBeNull();
        expect(preview.markdown).toBeNull();
        await expect(
          harness.plannedTests.producePackage(accountId, {
            expectedPackageVersion: 1,
            handoffId: handoff.id,
            previewFingerprint: "a".repeat(64),
            projectId,
          }),
        ).rejects.toBeInstanceOf(TestHandoffPackageStateError);
        expect(harness.packages.get(handoff.id)).toBeUndefined();
      }
      // Producing never moves the process state; only the founder does.
      const after = await harness.plannedTests.handoffs(accountId, projectId);
      expect(after.handoffs[0]?.state).toBe(state);
      expect(after.handoffs[0]?.packageVersion).toBe(may ? 1 : 0);
    });
  }

  test("a package can be produced again in Ready to share after the content changed, and a Shared Handoff stays locked", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");
    await produce(harness, handoff.id);
    await harness.plannedTests.updateHandoff(accountId, {
      handoffId: handoff.id,
      projectId,
      purpose: "Narrowed before sharing.",
      title: "Checkout regression, round 1",
    });
    const second = await produce(harness, handoff.id);
    await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Ready to share",
      handoffId: handoff.id,
      projectId,
      to: "Shared",
    });

    expect(second.package.purpose).toBe("Narrowed before sharing.");
    await expect(
      harness.plannedTests.updateHandoff(accountId, {
        handoffId: handoff.id,
        projectId,
        purpose: "Rewrite history.",
        title: "Checkout regression, round 1",
      }),
    ).rejects.toMatchObject({ code: "TEST_HANDOFF_LOCKED" });
    const third = await produce(harness, handoff.id);
    expect(third.packageVersion).toBe(3);
    expect(third.package.purpose).toBe("Narrowed before sharing.");
  });

  test("an archived Project can read its packages but not produce one", async () => {
    const harness = await setupTestHandoffPackage();

    await expect(
      harness.plannedTests.producePackage(accountId, {
        expectedPackageVersion: 1,
        handoffId: "missing",
        previewFingerprint: "d".repeat(64),
        projectId: archivedProjectId,
      }),
    ).rejects.toBeInstanceOf(PlannedTestProjectReadOnlyError);
  });
});

describe("Closed-world package: nothing unselected, unavailable or secret enters", () => {
  test("a context record from another Project or an unknown one cannot be selected", async () => {
    const harness = await setupTestHandoffPackage();

    await expect(
      openHandoff(harness, {
        contextRefs: [{ kind: "Work", targetId: "work-x" }],
      }),
    ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    await expect(
      openHandoff(harness, {
        contextRefs: [{ kind: "Work", targetId: "feature-1" }],
      }),
    ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    await expect(
      openHandoff(harness, {
        contextRefs: [
          {
            documentRevision: 2,
            kind: "Document",
            sectionId: null,
            targetId: "doc-1",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
    await expect(
      openHandoff(harness, {
        contextRefs: [
          { kind: "Wireframe", targetId: "screen-1", wireframeVersion: 9 },
        ],
      }),
    ).rejects.toBeInstanceOf(PlannedTestRelationTargetError);
  });

  for (const state of ["trashed", "archived", "gone"] as const) {
    test(`a selected record that is ${state} blocks the package instead of entering it`, async () => {
      const harness = await setupTestHandoffPackage();
      const handoff = await reach(harness, "Ready to share");
      harness.setState("Work", "work-1", state);

      const preview = await harness.plannedTests.previewPackage(accountId, {
        handoffId: handoff.id,
        projectId,
      });

      expect(preview.canProduce).toBe(false);
      expect(preview.blockers).toMatchObject([
        { kind: "unavailable", path: "work_context" },
      ]);
      expect(preview.json).toBeNull();
      await expect(
        harness.plannedTests.producePackage(accountId, {
          expectedPackageVersion: 1,
          handoffId: handoff.id,
          previewFingerprint: "b".repeat(64),
          projectId,
        }),
      ).rejects.toBeInstanceOf(TestHandoffPackageBlockedError);
      expect(harness.handoffs.get(handoff.id)?.packageVersion).toBe(0);
    });
  }

  const SECRET_TEXTS: [string, string][] = [
    ["GitHub token", GITHUB_TOKEN],
    ["private key", "-----BEGIN RSA PRIVATE KEY-----\nMIIE"],
    ["API key", "sk-live-abcdefghijklmnop1234"],
    ["AWS access key", "AKIAABCDEFGHIJKLMNOP"],
    ["Slack token", "xoxb-1234567890-abcdefghij"],
    [
      "JSON Web Token",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk",
    ],
    ["bearer token", "Authorization: Bearer abcdef0123456789abcdef"],
    ["URL with credentials", "https://admin:hunter22@staging.example.com/app"],
    ["credential assignment", "password = hunter2!x9"],
  ];

  for (const [kind, text] of SECRET_TEXTS) {
    test(`founder text with a ${kind} is rejected on save without echoing it`, async () => {
      const harness = await setupTestHandoffPackage();

      for (const field of [
        { environmentPreconditions: `Login: ${text}` },
        { purpose: `Check this. ${text}` },
        {
          adHocScope: [{ expectedBehavior: "Works.", intent: `Try ${text}` }],
        },
      ]) {
        const attempt = openHandoff(harness, field);
        await expect(attempt).rejects.toThrow(SECRET_WORD);
        await expect(attempt).rejects.toThrow(kind);
        await attempt.catch((error: Error) => {
          expect(error.message).not.toContain(text.split(" ").at(-1) ?? text);
        });
      }
      expect(harness.handoffs.size).toBe(0);
    });
  }

  test("plain prose about credentials is still writable", async () => {
    const harness = await setupTestHandoffPackage();

    const handoff = await openHandoff(harness, {
      environmentPreconditions:
        "The password: incorrect case must show an error. The token expires.",
    });

    expect(handoff.environmentPreconditions).toContain("password: incorrect");
  });

  test("a secret that sits in a copied case version blocks the package and never reaches a rendering", async () => {
    const harness = await setupTestHandoffPackage();
    const leaky = await harness.plannedTests.create(accountId, {
      ...definitionTestHandoffPackage,
      projectId,
      scope: `Use ${GITHUB_TOKEN} to sign in.`,
      title: "Leaky case",
    });
    const handoff = await reach(harness, "Ready to share", {
      scenarios: [
        { caseId: harness.caseId, version: 1 },
        { caseId: leaky.id, version: 1 },
      ],
    });

    const preview = await harness.plannedTests.previewPackage(accountId, {
      handoffId: handoff.id,
      projectId,
    });

    expect(preview.canProduce).toBe(false);
    expect(preview.blockers).toEqual([
      expect.objectContaining({ kind: "secret", path: "scenarios[1].scope" }),
    ]);
    expect(preview.json).toBeNull();
    expect(preview.markdown).toBeNull();
    expect(JSON.stringify(preview)).not.toContain(GITHUB_TOKEN);
    const attempt = harness.plannedTests.producePackage(accountId, {
      expectedPackageVersion: 1,
      handoffId: handoff.id,
      previewFingerprint: "c".repeat(64),
      projectId,
    });
    await expect(attempt).rejects.toBeInstanceOf(
      TestHandoffPackageBlockedError,
    );
    await attempt.catch((error: Error) => {
      expect(error.message).not.toContain(GITHUB_TOKEN);
    });
    expect(harness.packages.get(handoff.id)).toBeUndefined();
    expect(harness.handoffs.get(handoff.id)?.packageVersion).toBe(0);
  });

  test("a clean package holds no recognisable secret and no file attachment", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");

    const produced = await produce(harness, handoff.id);

    expect(produced.json).not.toMatch(RAW_SECRET);
    expect(Object.keys(produced.package)).not.toContain("attachments");
    expect(produced.json).not.toMatch(ATTACHMENT_KEY);
  });
});

describe("Producing a package starts nothing", () => {
  test("the access has no start, run, poll, schedule, cancel, deliver or grant operation", async () => {
    const { plannedTests } = await setupTestHandoffPackage();

    const names = Object.keys(plannedTests).filter((name) =>
      RUNNER_NAME.test(name),
    );

    // `producePackage` is a document export, not a tool run.
    expect(names).toEqual([]);
    expect(Object.keys(plannedTests).sort()).toEqual(
      expect.arrayContaining(["previewPackage", "producePackage", "packages"]),
    );
  });

  test("the package names no tool, command, credential or write-back grant", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");

    const { json } = await produce(harness, handoff.id);

    expect(json).not.toMatch(TOOL_GRANT_KEY);
  });
});

describe("The package is a different contract from Work's external execution handoff", () => {
  test("key sets differ and coding context never defines test scope", async () => {
    const harness = await setupTestHandoffPackage();
    const handoff = await reach(harness, "Ready to share");
    const { json, markdown, package: pkg } = await produce(harness, handoff.id);

    const externalKeys = Object.keys(
      externalExecutionHandoffInputSchema.shape,
    ).sort();
    expect(externalKeys).not.toEqual(Object.keys(pkg).sort());
    expect(externalKeys).toEqual([
      "constraints",
      "executor",
      "expectedOutput",
      "githubContext",
      "includeWork",
      "purpose",
      "workId",
    ]);
    // The coding handoff input cannot carry scenario versions or a report path.
    for (const key of externalKeys) {
      expect(key).not.toMatch(TEST_SCOPE_KEY);
    }
    expect(pkg).not.toHaveProperty("work_id");
    expect(pkg).not.toHaveProperty("expected_output");
    expect(pkg).not.toHaveProperty("github_context");

    const coding = renderExternalExecutionHandoffPackage({
      handoffId: "handoff-1",
      input: externalExecutionHandoffInputSchema.parse({
        constraints: "",
        executor: "Codex",
        expectedOutput: "A fixed checkout.",
        githubContext: [],
        includeWork: true,
        purpose: "Fix checkout.",
        workId: "work-1",
      }),
      producedAt: "2026-10-20T10:00:00+00:00",
      work: {
        description: null,
        id: "work-1",
        key: "CAN-1",
        revision: 1,
        status: "In Progress",
        targetDate: null,
        title: "Checkout rewrite",
        type: "Task",
      },
    });
    expect(coding).not.toContain("test-handoff-package/1");
    expect(coding).not.toContain("test-report/1");
    expect(coding).not.toContain("Scenario version");
    expect(markdown).not.toContain("External Execution Handoff");
    expect(markdown).not.toContain("Source of truth is in the app");
    expect(json).not.toContain("External Execution Handoff");
  });
});

const RESULT_WORDS =
  /\b(pass(ed)?|fail(ed)?|valid(ated)?|green|red|success)\b/i;
const RUNNER_VERBS =
  /start|run|poll|schedul|execut|dispatch|trigger|cancel|deliver|send|retry/i;
const HANDOFF_WORD = /handoff/i;
const WORK_HANDOFF_COLUMN = /work|return|reconcil|result|outcome|run|status/;
const HANDOFF_TABLE_PREFIX = /^project_test_handoff_/;

function openHandoffTestHandoffs(harness: Harness, overrides: object = {}) {
  return harness.plannedTests.createHandoff(accountId, {
    projectId,
    purpose: "Check the checkout flow on the staging build.",
    scenarios: [{ caseId: harness.caseId, version: 1 }],
    title: "Checkout regression, round 1",
    ...overrides,
  });
}

async function reachTestHandoffs(harness: Harness, target: TestHandoffState) {
  let handoff = await openHandoffTestHandoffs(harness);
  for (const to of PATH[target]) {
    handoff = await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: handoff.state,
      handoffId: handoff.id,
      projectId,
      to,
    });
  }
  if (handoff.state !== target) {
    throw new Error(`Expected ${target}, got ${handoff.state}.`);
  }
  return handoff;
}

function arrive(harness: Harness, bound = true) {
  return harness.plannedTests.recordSessionTest(
    accountId,
    bound
      ? {
          binding: { caseId: harness.caseId, version: 1 },
          projectId,
          title: "Pay with the saved card",
        }
      : {
          expectedBehavior: "Tax is shown.",
          projectId,
          purpose: "Check tax display.",
          title: "Tax line",
        },
  );
}

describe("Test Handoff carries the requested external test work", () => {
  test("opens as a Draft with the exact selected versions and founder-typed context", async () => {
    const harness = await setup();
    const handoff = await openHandoffTestHandoffs(harness, {
      buildContext: {
        branch: "main",
        commit: "abc1234",
        repository: "https://github.com/acme/shop",
        targetEnvironment: "staging",
      },
      dueDate: "2026-11-02",
      targetExecutor: "Playwright cloud runner",
    });

    expect(handoff).toMatchObject({
      allowedTransitions: ["Ready to share", "Canceled"],
      buildContext: {
        branch: "main",
        build: null,
        commit: "abc1234",
        repository: "https://github.com/acme/shop",
        targetEnvironment: "staging",
      },
      dueDate: "2026-11-02",
      editable: true,
      packageVersion: 0,
      purpose: "Check the checkout flow on the staging build.",
      scenarios: [
        {
          caseId: harness.caseId,
          summary: "Pinned to v1, current",
          title: "Checkout with a saved card",
          version: 1,
        },
      ],
      sessionTests: [],
      state: "Draft",
      suggestion: null,
      targetExecutor: "Playwright cloud runner",
      title: "Checkout regression, round 1",
    });
    expect(
      (await harness.plannedTests.handoffs(accountId, projectId)).handoffs,
    ).toHaveLength(1);
  });

  test("a Document section deleted after the selection reads as gone while the reference stays exact", async () => {
    const harness = await setup();
    harness.catalog.set("Document:doc-1", {
      documentRevision: 2,
      label: "Checkout spec",
      projectId,
      sections: [{ id: "s1", label: "Payment" }],
      targetId: "doc-1",
      targetType: "Document",
    });
    await openHandoffTestHandoffs(harness, {
      contextRefs: [
        {
          documentRevision: 2,
          kind: "Document",
          sectionId: "s1",
          targetId: "doc-1",
        },
      ],
    });

    const [pinned] = (await harness.plannedTests.handoffs(accountId, projectId))
      .handoffs;
    expect(pinned?.contextRefs[0]).toEqual({
      documentRevision: 2,
      kind: "Document",
      sectionId: "s1",
      targetId: "doc-1",
      brokenReason: null,
      label: "Checkout spec",
      sectionLabel: "Payment",
    });

    // The founder deletes the section, not the document.
    const entry = harness.catalog.get("Document:doc-1");
    if (entry) {
      entry.sections = [];
    }
    const [stillThere] = (
      await harness.plannedTests.handoffs(accountId, projectId)
    ).handoffs;
    expect(stillThere?.contextRefs[0]).toEqual({
      documentRevision: 2,
      kind: "Document",
      sectionId: "s1",
      targetId: "doc-1",
      brokenReason: null,
      label: "Checkout spec",
      sectionLabel: null,
    });
  });

  test("target executor is free text and optional, due date is optional", async () => {
    const harness = await setup();
    for (const executor of ["Me", "Codex", "Claude Code", "Conductor"]) {
      const handoff = await openHandoffTestHandoffs(harness, {
        targetExecutor: executor,
      });
      expect(handoff.targetExecutor).toBe(executor);
    }
    const bare = await openHandoffTestHandoffs(harness, { scenarios: [] });
    expect(bare).toMatchObject({
      dueDate: null,
      scenarios: [],
      targetExecutor: null,
    });
  });

  test("a version difference stays visible when the case moves on", async () => {
    const harness = await setup();
    const handoff = await openHandoffTestHandoffs(harness);
    await harness.plannedTests.createVersion(accountId, {
      ...definition,
      caseId: harness.caseId,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Card and wallet payment.",
    });

    const [listed] = (await harness.plannedTests.handoffs(accountId, projectId))
      .handoffs;
    expect(listed?.id).toBe(handoff.id);
    expect(listed?.scenarios[0]).toMatchObject({
      currentVersion: 2,
      summary: "Pinned to v1, current v2",
      version: 1,
    });
  });

  test("selects only exact existing versions of this Project, never latest", async () => {
    const harness = await setup();
    await expect(
      openHandoffTestHandoffs(harness, {
        scenarios: [{ caseId: harness.caseId, version: 9 }],
      }),
    ).rejects.toBeInstanceOf(PlannedTestVersionNotFoundError);
    await expect(
      openHandoffTestHandoffs(harness, {
        scenarios: [{ caseId: "unknown", version: 1 }],
      }),
    ).rejects.toBeInstanceOf(PlannedTestCaseNotFoundError);
    // A version-less selection has no "latest" meaning.
    await expect(
      openHandoffTestHandoffs(harness, {
        scenarios: [{ caseId: harness.caseId }],
      }),
    ).rejects.toThrow();
    await expect(
      openHandoffTestHandoffs(harness, {
        scenarios: [
          { caseId: harness.caseId, version: 1 },
          { caseId: harness.caseId, version: 1 },
        ],
      }),
    ).rejects.toThrow();
    expect(
      (await harness.plannedTests.handoffs(accountId, projectId)).handoffs,
    ).toHaveLength(0);
  });

  test("refuses a case version that belongs to another Project", async () => {
    const harness = await setup();
    const other = harness.cases.get(harness.caseId);
    if (!other) {
      throw new Error("missing case");
    }
    harness.cases.set(harness.caseId, { ...other, projectId: "elsewhere" });
    await expect(openHandoffTestHandoffs(harness)).rejects.toBeInstanceOf(
      PlannedTestCaseNotFoundError,
    );
  });

  test("refuses unsafe build context and invalid dates", async () => {
    const harness = await setup();
    for (const buildContext of [
      { repository: "https://token@github.com/acme/shop" },
      { targetEnvironment: "https://staging.example.com/?token=abc" },
      { build: "ftp://example.com/build" },
    ]) {
      await expect(
        openHandoffTestHandoffs(harness, { buildContext }),
      ).rejects.toThrow();
    }
    await expect(
      openHandoffTestHandoffs(harness, { dueDate: "2026-02-31" }),
    ).rejects.toThrow();
    await expect(
      openHandoffTestHandoffs(harness, { buildContext: { runner: "ci" } }),
    ).rejects.toThrow();
  });

  test("keeps Projects separate and read-only for an archived Project", async () => {
    const harness = await setup();
    await expect(
      harness.plannedTests.handoffs(accountId, "elsewhere"),
    ).rejects.toBeInstanceOf(PlannedTestProjectNotFoundError);
    await expect(
      harness.plannedTests.createHandoff(accountId, {
        projectId: archivedProjectId,
        purpose: "p",
        title: "t",
      }),
    ).rejects.toBeInstanceOf(PlannedTestProjectReadOnlyError);
    expect(
      (await harness.plannedTests.handoffs(accountId, archivedProjectId))
        .readOnly,
    ).toBe(true);
  });

  test("the same cases go to different executors as separate Handoffs", async () => {
    const harness = await setup();
    const first = await openHandoffTestHandoffs(harness, {
      targetExecutor: "Codex",
    });
    const second = await openHandoffTestHandoffs(harness, {
      targetExecutor: "Conductor",
    });
    await arrive(harness).then((sessionTest) =>
      harness.plannedTests.linkHandoffSessionTest(accountId, {
        handoffId: first.id,
        projectId,
        sessionTestId: sessionTest.id,
      }),
    );

    const listed = (await harness.plannedTests.handoffs(accountId, projectId))
      .handoffs;
    expect(listed.find(({ id }) => id === first.id)?.sessionTests).toHaveLength(
      1,
    );
    expect(
      listed.find(({ id }) => id === second.id)?.sessionTests,
    ).toHaveLength(0);
    expect(first.id).not.toBe(second.id);
  });
});

describe("Test Handoff states describe the process, not a test result", () => {
  test("the six process states are exactly the spec labels", () => {
    expect([...TEST_HANDOFF_STATES]).toEqual([
      "Draft",
      "Ready to share",
      "Shared",
      "Result received",
      "Closed",
      "Canceled",
    ]);
    expect(TEST_HANDOFF_STATES.some((state) => RESULT_WORDS.test(state))).toBe(
      false,
    );
  });

  test("every allowed move is accepted and every other move is refused", async () => {
    const harness = await setup();
    for (const from of TEST_HANDOFF_STATES) {
      for (const to of TEST_HANDOFF_STATES) {
        const handoff = await reachTestHandoffs(harness, from);
        const attempt = harness.plannedTests.transitionHandoff(accountId, {
          expectedState: from,
          handoffId: handoff.id,
          projectId,
          to,
        });
        if (TEST_HANDOFF_TRANSITIONS[from].includes(to)) {
          await expect(attempt).resolves.toMatchObject({ state: to });
        } else {
          await expect(attempt).rejects.toBeInstanceOf(
            TestHandoffTransitionError,
          );
          expect(
            (
              await harness.plannedTests.handoffs(accountId, projectId)
            ).handoffs.find(({ id }) => id === handoff.id)?.state,
          ).toBe(from);
        }
      }
    }
  });

  test("the transition table matches the process", () => {
    expect(TEST_HANDOFF_TRANSITIONS).toEqual({
      Canceled: [],
      Closed: [],
      Draft: ["Ready to share", "Canceled"],
      "Ready to share": ["Draft", "Shared", "Canceled"],
      "Result received": ["Shared", "Closed"],
      Shared: ["Result received", "Closed", "Canceled"],
    });
  });

  test("Closed and Canceled are final", async () => {
    const harness = await setup();
    for (const final of ["Closed", "Canceled"] as const) {
      const handoff = await reachTestHandoffs(harness, final);
      expect(handoff.allowedTransitions).toEqual([]);
      await expect(
        harness.plannedTests.transitionHandoff(accountId, {
          expectedState: final,
          handoffId: handoff.id,
          projectId,
          to: "Draft",
        }),
      ).rejects.toBeInstanceOf(TestHandoffTransitionError);
    }
  });

  test("a stale click is refused instead of overwriting a newer state", async () => {
    const harness = await setup();
    const handoff = await openHandoffTestHandoffs(harness);
    await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });
    await expect(
      harness.plannedTests.transitionHandoff(accountId, {
        expectedState: "Draft",
        handoffId: handoff.id,
        projectId,
        to: "Canceled",
      }),
    ).rejects.toBeInstanceOf(TestHandoffStateConflictError);
  });

  test("an unknown Handoff or a state outside the six is refused", async () => {
    const harness = await setup();
    await expect(
      harness.plannedTests.transitionHandoff(accountId, {
        expectedState: "Draft",
        handoffId: "missing",
        projectId,
        to: "Ready to share",
      }),
    ).rejects.toBeInstanceOf(TestHandoffNotFoundError);
    const handoff = await openHandoffTestHandoffs(harness);
    await expect(
      harness.plannedTests.transitionHandoff(accountId, {
        expectedState: "Draft",
        handoffId: handoff.id,
        projectId,
        to: "Passed" as TestHandoffState,
      }),
    ).rejects.toThrow();
  });

  test("content is editable until shared, then it is history", async () => {
    const harness = await setup();
    const handoff = await openHandoffTestHandoffs(harness);
    const edited = await harness.plannedTests.updateHandoff(accountId, {
      buildContext: { branch: "release/2" },
      dueDate: "2026-12-01",
      handoffId: handoff.id,
      projectId,
      purpose: "Narrowed scope.",
      scenarios: [],
      targetExecutor: "Codex",
      title: "Checkout regression, round 1",
    });
    expect(edited).toMatchObject({
      buildContext: { branch: "release/2", commit: null },
      dueDate: "2026-12-01",
      purpose: "Narrowed scope.",
      scenarios: [],
      state: "Draft",
      targetExecutor: "Codex",
    });

    await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });
    await expect(
      harness.plannedTests.updateHandoff(accountId, {
        handoffId: handoff.id,
        projectId,
        purpose: "Still editable.",
        title: "Round 1",
      }),
    ).resolves.toMatchObject({ purpose: "Still editable." });

    await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Ready to share",
      handoffId: handoff.id,
      projectId,
      to: "Shared",
    });
    await expect(
      harness.plannedTests.updateHandoff(accountId, {
        handoffId: handoff.id,
        projectId,
        purpose: "Rewritten after sharing.",
        title: "Round 1",
      }),
    ).rejects.toBeInstanceOf(TestHandoffLockedError);
  });

  test("editing never moves the package version counter", async () => {
    const harness = await setup();
    const handoff = await openHandoffTestHandoffs(harness);
    await harness.plannedTests.updateHandoff(accountId, {
      handoffId: handoff.id,
      projectId,
      purpose: "Edited.",
      title: "Edited",
    });
    expect(
      (await harness.plannedTests.handoffs(accountId, projectId)).handoffs[0]
        ?.packageVersion,
    ).toBe(0);
  });
});

describe("a linked Session Test only suggests Result received", () => {
  test("a report on a Shared Handoff suggests Result received and changes nothing", async () => {
    const harness = await setup();
    const handoff = await reachTestHandoffs(harness, "Shared");
    const sessionTest = await arrive(harness);

    const linked = await harness.plannedTests.linkHandoffSessionTest(
      accountId,
      { handoffId: handoff.id, projectId, sessionTestId: sessionTest.id },
    );

    expect(linked.state).toBe("Shared");
    expect(linked.stateChangedAt).toBe(handoff.stateChangedAt);
    expect(linked.sessionTests).toHaveLength(1);
    expect(linked.suggestion).toMatchObject({ state: "Result received" });
    expect(linked.suggestion?.reason).toContain("stays open");
  });

  test("no suggestion before sharing or without a linked report", async () => {
    const harness = await setup();
    const shared = await reachTestHandoffs(harness, "Shared");
    expect(shared.suggestion).toBeNull();
    const draft = await openHandoffTestHandoffs(harness);
    const sessionTest = await arrive(harness);
    const linked = await harness.plannedTests.linkHandoffSessionTest(
      accountId,
      { handoffId: draft.id, projectId, sessionTestId: sessionTest.id },
    );
    expect(linked.state).toBe("Draft");
    expect(linked.suggestion).toBeNull();
  });

  test("never auto-closes or auto-advances at any state, however many reports arrive", async () => {
    const harness = await setup();
    for (const target of TEST_HANDOFF_STATES) {
      const handoff = await reachTestHandoffs(harness, target);
      for (const bound of [true, false, true]) {
        const sessionTest = await arrive(harness, bound);
        const linked = await harness.plannedTests.linkHandoffSessionTest(
          accountId,
          { handoffId: handoff.id, projectId, sessionTestId: sessionTest.id },
        );
        expect(linked.state).toBe(target);
        expect(linked.stateChangedAt).toBe(handoff.stateChangedAt);
      }
      const [reread] = (
        await harness.plannedTests.handoffs(accountId, projectId)
      ).handoffs.filter(({ id }) => id === handoff.id);
      expect(reread?.state).toBe(target);
      expect(reread?.sessionTests).toHaveLength(3);
      // The suggestion exists only as a suggestion on Shared.
      expect(reread?.suggestion !== null).toBe(target === "Shared");
    }
  });

  test("Result received is reached only by the founder's explicit move", async () => {
    const harness = await setup();
    const handoff = await reachTestHandoffs(harness, "Shared");
    const sessionTest = await arrive(harness);
    await harness.plannedTests.linkHandoffSessionTest(accountId, {
      handoffId: handoff.id,
      projectId,
      sessionTestId: sessionTest.id,
    });
    const accepted = await harness.plannedTests.transitionHandoff(accountId, {
      expectedState: "Shared",
      handoffId: handoff.id,
      projectId,
      to: "Result received",
    });
    expect(accepted.state).toBe("Result received");
    expect(accepted.suggestion).toBeNull();
    expect(accepted.allowedTransitions).toEqual(["Shared", "Closed"]);
  });

  test("a late report on a Canceled Handoff is linked without reopening it", async () => {
    const harness = await setup();
    const handoff = await reachTestHandoffs(harness, "Canceled");
    const sessionTest = await arrive(harness);
    const linked = await harness.plannedTests.linkHandoffSessionTest(
      accountId,
      { handoffId: handoff.id, projectId, sessionTestId: sessionTest.id },
    );
    expect(linked).toMatchObject({
      allowedTransitions: [],
      resultAfterCancel: true,
      state: "Canceled",
      suggestion: null,
    });
  });

  test("a bound Session Test must belong to a selected exact version", async () => {
    const harness = await setup();
    const second = await harness.plannedTests.create(accountId, {
      ...definition,
      projectId,
      title: "Refund",
    });
    const handoff = await openHandoffTestHandoffs(harness);
    const stray = await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: second.id, version: 1 },
      projectId,
      title: "Refund path",
    });
    await harness.plannedTests.createVersion(accountId, {
      ...definition,
      caseId: harness.caseId,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Changed.",
    });
    const onV2 = await harness.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: harness.caseId, version: 2 },
      projectId,
      title: "Checkout v2",
    });

    for (const sessionTest of [stray, onV2]) {
      await expect(
        harness.plannedTests.linkHandoffSessionTest(accountId, {
          handoffId: handoff.id,
          projectId,
          sessionTestId: sessionTest.id,
        }),
      ).rejects.toBeInstanceOf(TestHandoffScopeMismatchError);
    }
    const adHoc = await arrive(harness, false);
    await expect(
      harness.plannedTests.linkHandoffSessionTest(accountId, {
        handoffId: handoff.id,
        projectId,
        sessionTestId: adHoc.id,
      }),
    ).resolves.toMatchObject({ sessionTests: [{ id: adHoc.id }] });
  });

  test("a Session Test arrives on one Handoff only and unknown ids are refused", async () => {
    const harness = await setup();
    const first = await openHandoffTestHandoffs(harness);
    const second = await openHandoffTestHandoffs(harness);
    const sessionTest = await arrive(harness);
    const link = (handoffId: string, sessionTestId: string) =>
      harness.plannedTests.linkHandoffSessionTest(accountId, {
        handoffId,
        projectId,
        sessionTestId,
      });
    await link(first.id, sessionTest.id);

    await expect(link(second.id, sessionTest.id)).rejects.toBeInstanceOf(
      SessionTestAlreadyInHandoffError,
    );
    await expect(link(first.id, sessionTest.id)).rejects.toBeInstanceOf(
      SessionTestAlreadyInHandoffError,
    );
    await expect(link("missing", sessionTest.id)).rejects.toBeInstanceOf(
      TestHandoffNotFoundError,
    );
    await expect(link(first.id, "missing")).rejects.toBeInstanceOf(
      SessionTestNotFoundError,
    );
  });
});

describe("Test Handoff is not a runner and not an external execution handoff", () => {
  test("the access has no start, run, poll, schedule, cancel or deliver operation", async () => {
    const harness = await setup();
    const members = Object.keys(harness.plannedTests);
    expect(members.filter((name) => RUNNER_VERBS.test(name))).toEqual([]);
    expect(members.filter((name) => HANDOFF_WORD.test(name)).sort()).toEqual([
      "createHandoff",
      "handoffs",
      "linkHandoffSessionTest",
      "transitionHandoff",
      "updateHandoff",
    ]);
  });

  test("Canceled is a local process state and reaches no external tool", async () => {
    const harness = await setup();
    const handoff = await reachTestHandoffs(harness, "Canceled");
    expect(handoff).toMatchObject({ editable: false, state: "Canceled" });
    expect(handoff).not.toHaveProperty("externalRunId");
  });

  test("a Test Handoff is not a Session Test and does not appear as one", async () => {
    const harness = await setup();
    await openHandoffTestHandoffs(harness);
    expect(
      (await harness.plannedTests.sessionTests(accountId, projectId))
        .sessionTests,
    ).toEqual([]);
  });

  test("a Handoff holds no result column and no Work external handoff data", async () => {
    const harness = await setup();
    const handoff = await openHandoffTestHandoffs(harness);
    for (const key of [
      "result",
      "results",
      "outcome",
      "status",
      "workId",
      "returnRecord",
      "reconciled",
    ]) {
      expect(handoff).not.toHaveProperty(key);
    }
  });
});

describe("Test Handoff storage is separate from Work's external handoff", () => {
  test("its tables carry no Work, return, reconcile or result column", () => {
    const columns = Object.values(getTableColumns(testHandoff)).map(
      ({ name }) => name,
    );
    expect(columns).toEqual(
      expect.arrayContaining([
        "package_version",
        "state",
        "target_executor",
        "due_date",
      ]),
    );
    expect(columns.filter((name) => WORK_HANDOFF_COLUMN.test(name))).toEqual(
      [],
    );
    expect(getTableName(testHandoff)).not.toBe(
      getTableName(workExternalExecutionHandoff),
    );
    for (const table of [testHandoffScenario, testHandoffSessionTest]) {
      expect(getTableName(table)).toMatch(HANDOFF_TABLE_PREFIX);
    }
  });
});
