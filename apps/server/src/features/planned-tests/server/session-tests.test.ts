import { describe, expect, test } from "vitest";

import {
  PlannedTestCaseNotFoundError,
  PlannedTestProjectNotFoundError,
  PlannedTestProjectReadOnlyError,
  PlannedTestVersionNotFoundError,
  SessionTestAlreadyBoundError,
  SessionTestNotFoundError,
} from "./planned-tests";
import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  projectId,
} from "./planned-tests-memory-store";

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
