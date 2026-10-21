// biome-ignore-all lint/performance/noAwaitInLoops: Each state is driven in sequence against one Handoff.
import {
  externalExecutionHandoffInputSchema,
  renderExternalExecutionHandoffPackage,
} from "@cantiara/api/external-handoffs";
import {
  TEST_HANDOFF_STATES,
  type TestHandoffState,
} from "@cantiara/api/planned-tests";
import { describe, expect, test } from "vitest";

import {
  PlannedTestProjectReadOnlyError,
  PlannedTestRelationTargetError,
  TestHandoffPackageBlockedError,
  TestHandoffPackageStaleError,
  TestHandoffPackageStateError,
} from "../planned-tests";
import {
  accountId,
  archivedProjectId,
  createMemoryHarness,
  projectId,
  projectName,
} from "../planned-tests-memory-store";

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

const definition = {
  expectedBehavior: "The order is confirmed and a receipt is shown.",
  notes: "Use the sandbox gateway only.",
  preconditions: "A signed-in customer with one item in the cart.",
  purpose: "Confirm checkout completes.",
  scope: "Card payment only; no coupons.",
  title: "Checkout with a saved card",
};

function catalog() {
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

async function setup() {
  const harness = createMemoryHarness(catalog());
  const created = await harness.plannedTests.create(accountId, {
    ...definition,
    projectId,
  });
  const unselected = await harness.plannedTests.create(accountId, {
    ...definition,
    projectId,
    title: "Unselected wallet case",
  });
  return { ...harness, caseId: created.id, unselectedId: unselected.id };
}

type Harness = Awaited<ReturnType<typeof setup>>;

function openHandoff(harness: Harness, overrides: object = {}) {
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
  harness: Harness,
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

async function produce(harness: Harness, handoffId: string) {
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
    const harness = await setup();
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
    const harness = await setup();
    const handoff = await reach(harness, "Ready to share");

    const { package: json } = await produce(harness, handoff.id);

    expect(json.scenarios).toHaveLength(1);
    const [scenario] = json.scenarios;
    expect(Object.keys(scenario ?? {}).sort()).toEqual([...PRD_SCENARIO_KEYS]);
    expect(scenario).toEqual({
      expected_behavior: definition.expectedBehavior,
      notes: definition.notes,
      preconditions: definition.preconditions,
      purpose: definition.purpose,
      scenario_id: harness.caseId,
      scenario_version: 1,
      scope: definition.scope,
      title: definition.title,
    });
  });

  test("return instructions follow the PRD row and name test-report/1 as the only structured return", async () => {
    const harness = await setup();
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
    const harness = await setup();
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
    const harness = await setup();
    await harness.plannedTests.createVersion(accountId, {
      ...definition,
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
      scope: definition.scope,
    });
  });

  test("a fresh Handoff with nothing optional still yields the full key set with empty sections", async () => {
    const harness = await setup();
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
    const harness = await setup();
    const handoff = await reach(harness, "Ready to share");
    const first = await produce(harness, handoff.id);

    await harness.plannedTests.createVersion(accountId, {
      ...definition,
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
      scope: definition.scope,
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
    const harness = await setup();
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
    const harness = await setup();
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
    const harness = await setup();
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
    const harness = await setup();
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
    const harness = await setup();
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
      const harness = await setup();
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
    const harness = await setup();
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
    const harness = await setup();

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
    const harness = await setup();

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
      const harness = await setup();
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
      const harness = await setup();

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
    const harness = await setup();

    const handoff = await openHandoff(harness, {
      environmentPreconditions:
        "The password: incorrect case must show an error. The token expires.",
    });

    expect(handoff.environmentPreconditions).toContain("password: incorrect");
  });

  test("a secret that sits in a copied case version blocks the package and never reaches a rendering", async () => {
    const harness = await setup();
    const leaky = await harness.plannedTests.create(accountId, {
      ...definition,
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
    const harness = await setup();
    const handoff = await reach(harness, "Ready to share");

    const produced = await produce(harness, handoff.id);

    expect(produced.json).not.toMatch(RAW_SECRET);
    expect(Object.keys(produced.package)).not.toContain("attachments");
    expect(produced.json).not.toMatch(ATTACHMENT_KEY);
  });
});

describe("Producing a package starts nothing", () => {
  test("the access has no start, run, poll, schedule, cancel, deliver or grant operation", async () => {
    const { plannedTests } = await setup();

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
    const harness = await setup();
    const handoff = await reach(harness, "Ready to share");

    const { json } = await produce(harness, handoff.id);

    expect(json).not.toMatch(TOOL_GRANT_KEY);
  });
});

describe("The package is a different contract from Work's external execution handoff", () => {
  test("key sets differ and coding context never defines test scope", async () => {
    const harness = await setup();
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
