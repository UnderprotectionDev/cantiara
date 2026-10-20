// biome-ignore-all lint/performance/noAwaitInLoops: Each refusal case is asserted in sequence against one store.
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";
import {
  accountId,
  archivedProjectId,
  projectId,
} from "../../planned-tests/server/planned-tests-memory-store";
import {
  TestGapProjectNotFoundError,
  TestGapProjectReadOnlyError,
  TestGapRelationTargetError,
} from "./test-gaps";
import { createGapHarness } from "./test-gaps-memory-store";

const catalog = [
  {
    label: "Coupon redemption",
    projectId,
    targetId: "f1",
    targetType: "Feature",
  },
  { label: "Fix tax rounding", projectId, targetId: "w1", targetType: "Work" },
  { label: "Double charge", projectId, targetId: "r1", targetType: "Risk" },
  {
    documentRevision: 3,
    label: "Checkout spec",
    projectId,
    sections: [{ id: "s1", label: "Coupons" }],
    targetId: "d1",
    targetType: "Document",
  },
  {
    label: "Release 1.0",
    projectId,
    targetId: "pr1",
    targetType: "Project Release",
  },
  {
    label: "Other project Risk",
    projectId: "project-other",
    targetId: "r9",
    targetType: "Risk",
  },
] as const;

function setup() {
  return createGapHarness(structuredClone([...catalog]) as never);
}

const gap = {
  projectId,
  rationale: "Coupon stacking was never tried on mobile.",
  title: "Mobile coupon stacking untested",
};

describe("Test Gap record", () => {
  test("is filed by hand with title, rationale and support relations of every family", async () => {
    const { testGaps } = setup();

    const created = await testGaps.create(accountId, {
      ...gap,
      relations: [
        { targetId: "f1", targetType: "Feature" },
        { targetId: "w1", targetType: "Work" },
        { targetId: "r1", targetType: "Risk" },
        {
          documentRevision: 3,
          sectionId: "s1",
          targetId: "d1",
          targetType: "Document",
        },
        { targetId: "pr1", targetType: "Project Release" },
      ],
    });

    expect(created).toMatchObject({
      projectId,
      rationale: gap.rationale,
      title: gap.title,
    });
    expect(
      created.relations.map(({ label, state, targetType }) => [
        targetType,
        label,
        state,
      ]),
    ).toEqual([
      ["Feature", "Coupon redemption", "resolved"],
      ["Work", "Fix tax rounding", "resolved"],
      ["Risk", "Double charge", "resolved"],
      ["Document", "Checkout spec", "resolved"],
      ["Project Release", "Release 1.0", "resolved"],
    ]);
    expect(created.relations[3]).toMatchObject({
      documentRevision: 3,
      sectionLabel: "Coupons",
    });
    expect((await testGaps.list(accountId, projectId)).gaps).toEqual([created]);
  });

  test("can be filed with no relations and lists newest records from this Project only", async () => {
    const { testGaps } = setup();

    const created = await testGaps.create(accountId, gap);

    expect(created.relations).toEqual([]);
    expect((await testGaps.list(accountId, archivedProjectId)).gaps).toEqual(
      [],
    );
  });

  test("refuses a relation that is not an existing, active record of this Project", async () => {
    const harness = setup();
    harness.setState("Risk", "r1", "trashed");

    for (const relation of [
      { targetId: "missing", targetType: "Feature" },
      { targetId: "r9", targetType: "Risk" },
      { targetId: "r1", targetType: "Risk" },
      { documentRevision: 2, targetId: "d1", targetType: "Document" },
      {
        documentRevision: 3,
        sectionId: "gone",
        targetId: "d1",
        targetType: "Document",
      },
      // A Work id never lands in the Feature family.
      { targetId: "w1", targetType: "Feature" },
    ] as const) {
      await expect(
        harness.testGaps.create(accountId, { ...gap, relations: [relation] }),
      ).rejects.toBeInstanceOf(TestGapRelationTargetError);
    }
    await expect(
      harness.testGaps.create(accountId, {
        ...gap,
        relations: [
          { targetId: "f1", targetType: "Feature" },
          { targetId: "f1", targetType: "Feature" },
        ],
      }),
    ).rejects.toBeInstanceOf(TestGapRelationTargetError);
    expect(harness.gaps.size).toBe(0);
  });

  test("reports a support record that went away as broken and keeps the Gap", async () => {
    const harness = setup();
    const created = await harness.testGaps.create(accountId, {
      ...gap,
      relations: [{ targetId: "r1", targetType: "Risk" }],
    });

    harness.setState("Risk", "r1", "trashed");

    const [listed] = (await harness.testGaps.list(accountId, projectId)).gaps;
    expect(listed?.id).toBe(created.id);
    expect(listed?.relations[0]).toMatchObject({
      brokenReason: "In Trash",
      label: null,
      state: "broken",
      targetId: "r1",
    });
  });

  test("binding a support relation never writes the target", async () => {
    const harness = setup();
    const before = structuredClone([...harness.catalog.values()]);

    await harness.testGaps.create(accountId, {
      ...gap,
      relations: [
        { targetId: "f1", targetType: "Feature" },
        { targetId: "pr1", targetType: "Project Release" },
      ],
    });

    expect([...harness.catalog.values()]).toEqual(before);
  });

  test("offers only live Project records as relation targets", async () => {
    const harness = setup();

    expect(
      await harness.testGaps.relationTargets(accountId, {
        projectId,
        targetType: "Risk",
      }),
    ).toMatchObject([{ targetId: "r1" }]);
    expect(
      await harness.testGaps.relationTargets(accountId, {
        projectId,
        targetType: "Document",
      }),
    ).toMatchObject([
      { documentRevision: 3, sections: [{ id: "s1", label: "Coupons" }] },
    ]);
  });

  test("an archived Project stays readable but takes no new Gap", async () => {
    const { testGaps } = setup();

    await expect(
      testGaps.create(accountId, { ...gap, projectId: archivedProjectId }),
    ).rejects.toBeInstanceOf(TestGapProjectReadOnlyError);
    expect(await testGaps.list(accountId, archivedProjectId)).toMatchObject({
      readOnly: true,
    });
  });

  test("another account does not see or file Gaps in this Project", async () => {
    const { testGaps } = setup();

    await expect(testGaps.create("someone-else", gap)).rejects.toBeInstanceOf(
      TestGapProjectNotFoundError,
    );
    await expect(
      testGaps.list("someone-else", projectId),
    ).rejects.toBeInstanceOf(TestGapProjectNotFoundError);
  });

  test("validates the record text", async () => {
    const { testGaps } = setup();

    await expect(
      testGaps.create(accountId, { ...gap, title: "  " }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      testGaps.create(accountId, { ...gap, rationale: "" }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("Test Gap is not a coverage figure, a Bug, a Risk or a Product Gap", () => {
  test("refuses coverage, score, status, severity and record-type fields", async () => {
    const { testGaps } = setup();

    for (const extra of [
      { coverage: 40 },
      { score: 3 },
      { severity: "High" },
      { status: "Met by result" },
      { state: "Planned" },
      { kind: "Bug" },
      { type: "Product Gap" },
      { result: "Failed" },
    ]) {
      await expect(
        testGaps.create(accountId, { ...gap, ...extra } as never),
      ).rejects.toBeInstanceOf(ZodError);
    }
  });

  test("refuses Bug and Product Gap as support relation families", async () => {
    const { testGaps } = setup();

    for (const targetType of [
      "Bug",
      "Product Gap",
      "Test Gap",
      "Session Test",
    ]) {
      await expect(
        testGaps.create(accountId, {
          ...gap,
          relations: [{ targetId: "x", targetType }] as never,
        }),
      ).rejects.toBeInstanceOf(ZodError);
    }
  });

  test("stores nothing but the founder's own text and relations", async () => {
    const harness = setup();
    await harness.testGaps.create(accountId, gap);

    expect(Object.keys([...harness.gaps.values()][0] ?? {}).sort()).toEqual([
      "createdAt",
      "id",
      "projectId",
      "rationale",
      "relations",
      "title",
      "updatedAt",
    ]);
  });
});

describe("The product never files a Test Gap on its own", () => {
  test("a failed, reported or unbound Session Test, a spec change and a new case version leave no Gap", async () => {
    const harness = setup();
    const { planned } = harness;
    const definition = {
      expectedBehavior: "The coupon applies once.",
      preconditions: "Signed-in customer.",
      purpose: "Check coupon stacking.",
      scope: "Mobile.",
      title: "Stack coupons",
    };
    const scenario = await planned.plannedTests.create(accountId, {
      ...definition,
      projectId,
    });
    await planned.plannedTests.createVersion(accountId, {
      ...definition,
      caseId: scenario.id,
      changeKind: "Meaningful change",
      expectedVersion: 1,
      projectId,
      scope: "Mobile and web.",
    });
    await planned.plannedTests.recordSessionTest(accountId, {
      binding: { caseId: scenario.id, version: 1 },
      projectId,
      title: "Stacked coupons on Android",
    });
    await planned.plannedTests.recordSessionTest(accountId, {
      expectedBehavior: "Refund shown.",
      projectId,
      purpose: "Ad hoc refund try.",
      title: "Refund try",
    });
    const handoff = await planned.plannedTests.createHandoff(accountId, {
      projectId,
      purpose: "Mobile pass",
      scenarios: [{ caseId: scenario.id, version: 1 }],
      title: "Mobile pass",
    });
    const [recorded] = (
      await planned.plannedTests.sessionTests(accountId, projectId)
    ).sessionTests;
    if (!recorded) {
      throw new Error("Expected a recorded Session Test.");
    }
    await planned.plannedTests.transitionHandoff(accountId, {
      expectedState: "Draft",
      handoffId: handoff.id,
      projectId,
      to: "Ready to share",
    });
    await planned.plannedTests.transitionHandoff(accountId, {
      expectedState: "Ready to share",
      handoffId: handoff.id,
      projectId,
      to: "Shared",
    });
    await planned.plannedTests.linkHandoffSessionTest(accountId, {
      handoffId: handoff.id,
      projectId,
      sessionTestId: recorded.id,
    });

    expect(harness.gaps.size).toBe(0);
    expect((await harness.testGaps.list(accountId, projectId)).gaps).toEqual(
      [],
    );
  });

  test("the seam exposes a manual create and reads, and no automatic filing operation", () => {
    const { testGaps } = setup();

    expect(Object.keys(testGaps).sort()).toEqual([
      "create",
      "list",
      "relationTargets",
    ]);
  });
});
