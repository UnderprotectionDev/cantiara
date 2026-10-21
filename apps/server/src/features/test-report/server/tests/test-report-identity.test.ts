import {
  type AcceptTestReportInput,
  TestReportRejectedError,
} from "@cantiara/api/test-report";
import { describe, expect, test } from "vitest";

import {
  accepted,
  accountId,
  createMemoryHarness,
  type MemoryHarnessOptions,
  otherProjectId,
  projectId,
} from "../test-report-memory-store";

const userCaller = {
  accountId,
  reporter: { id: accountId, kind: "user" },
} as const;
const integration = (id: string) =>
  ({ accountId, reporter: { id, kind: "integration" } }) as const;

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    executor: { name: "Codex", type: "ai_agent" },
    external_session_id: "run-1",
    project_id: projectId,
    reported_at: "2026-08-06T12:30:00Z",
    schema_version: "test-report/1",
    tests: [
      { external_test_id: "a", normalized_result: "passed", title: "A" },
      { external_test_id: "b", normalized_result: "failed", title: "B" },
    ],
    ...overrides,
  };
}

const mcp = (
  report: unknown,
): Extract<AcceptTestReportInput, { ingress: "MCP" }> => ({
  ingress: "MCP",
  report,
});
const file = (content: string): AcceptTestReportInput => ({
  content,
  format: "json",
  ingress: "File import",
  projectId,
});

async function rejectionOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TestReportRejectedError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the report to be refused.");
}

const handoffs: NonNullable<MemoryHarnessOptions["handoffs"]> = [
  {
    id: "handoff-1",
    packageVersion: 2,
    projectId,
    scenarios: [{ caseId: "case-1", version: 3 }],
    state: "Shared",
  },
  {
    id: "handoff-canceled",
    packageVersion: 1,
    projectId,
    scenarios: [],
    state: "Canceled",
  },
  {
    id: "handoff-foreign",
    packageVersion: 1,
    projectId: otherProjectId,
    scenarios: [],
    state: "Shared",
  },
];

describe("atomic accept leaves no residue", () => {
  test("a store step that fails after the session was written rolls everything back", async () => {
    const harness = createMemoryHarness();
    harness.faults.failAfterSessionInsert = true;
    await expect(
      harness.testReports.accept(integration("i-1"), mcp(envelope())),
    ).rejects.toThrow("Store failed after the session.");
    expect(harness.sessions.size).toBe(0);
    expect(harness.identities.size).toBe(0);

    harness.faults.failAfterSessionInsert = false;
    const retry = await accepted(
      harness.testReports,
      integration("i-1"),
      mcp(envelope()),
    );
    expect(retry.outcome).toBe("created");
  });

  test("one bad test refuses the whole file and imports no row", async () => {
    const harness = createMemoryHarness();
    const bad = envelope({
      tests: [
        { external_test_id: "a", title: "A" },
        { external_test_id: "b", title: "B" },
        { external_test_id: "c" },
      ],
    });
    const failure = await rejectionOf(
      harness.testReports.accept(userCaller, file(JSON.stringify(bad))),
    );
    expect(failure.fieldPath).toBe("tests[2].title");
    expect(harness.sessions.size).toBe(0);
    expect(harness.identities.size).toBe(0);
  });

  test("a refusal after a prior success does not touch the prior session", async () => {
    const harness = createMemoryHarness();
    await harness.testReports.accept(userCaller, mcp(envelope()));
    await rejectionOf(
      harness.testReports.accept(
        userCaller,
        mcp(envelope({ external_session_id: "run-2", tests: [] })),
      ),
    );
    expect(harness.sessions.size).toBe(1);
  });
});

describe("idempotent identity", () => {
  test("the same report again returns the prior receipt as duplicate", async () => {
    const harness = createMemoryHarness();
    const caller = integration("i-1");
    const first = await accepted(harness.testReports, caller, mcp(envelope()));
    const second = await accepted(harness.testReports, caller, mcp(envelope()));
    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("duplicate");
    expect(second.session.id).toBe(first.session.id);
    expect(second.session.acceptedAt).toBe(first.session.acceptedAt);
    expect(second.session.fingerprint).toBe(first.session.fingerprint);
    expect(harness.sessions.size).toBe(1);
  });

  test("field order and JSON whitespace are not new content", async () => {
    const harness = createMemoryHarness();
    const report = envelope();
    const first = await accepted(
      harness.testReports,
      userCaller,
      file(JSON.stringify(report)),
    );
    const reordered = Object.fromEntries(Object.entries(report).reverse());
    const second = await accepted(
      harness.testReports,
      userCaller,
      file(JSON.stringify(reordered, null, 4)),
    );
    expect(second.outcome).toBe("duplicate");
    expect(second.session.id).toBe(first.session.id);
  });

  test("a different executor name is not part of the key or the content", async () => {
    const harness = createMemoryHarness();
    const caller = integration("i-1");
    const first = await accepted(harness.testReports, caller, mcp(envelope()));
    const second = await accepted(
      harness.testReports,
      caller,
      mcp(envelope({ executor: { name: "Claude Code", type: "ai_agent" } })),
    );
    expect(second.outcome).toBe("duplicate");
    expect(second.session.id).toBe(first.session.id);
    expect(second.session.executor.name).toBe("Codex");
  });

  test("the same external id with different content is identity_conflict and changes nothing", async () => {
    const harness = createMemoryHarness();
    const caller = integration("i-1");
    const first = await accepted(harness.testReports, caller, mcp(envelope()));
    const failure = await rejectionOf(
      harness.testReports.accept(
        caller,
        mcp(
          envelope({
            tests: [
              {
                external_test_id: "a",
                normalized_result: "failed",
                title: "A",
              },
            ],
          }),
        ),
      ),
    );
    expect(failure.code).toBe("identity_conflict");
    expect(failure.fieldPath).toBe("external_session_id");
    expect(harness.sessions.size).toBe(1);
    expect([...harness.sessions.values()][0]?.fingerprint).toBe(
      first.session.fingerprint,
    );
  });

  test("another reporter or another ingress with the same external id is its own session", async () => {
    const harness = createMemoryHarness();
    const results = await Promise.all([
      harness.testReports.accept(integration("i-1"), mcp(envelope())),
      harness.testReports.accept(integration("i-2"), mcp(envelope())),
      harness.testReports.accept(userCaller, file(JSON.stringify(envelope()))),
    ]);
    expect(results.map(({ outcome }) => outcome)).toEqual([
      "created",
      "created",
      "created",
    ]);
    expect(harness.sessions.size).toBe(3);
  });
});

describe("Handoff checks", () => {
  test("handoff_id without a package version, or a wrong one, is refused", async () => {
    const harness = createMemoryHarness({ handoffs });
    expect(
      (
        await rejectionOf(
          harness.testReports.accept(
            userCaller,
            mcp(envelope({ handoff_id: "handoff-1" })),
          ),
        )
      ).code,
    ).toBe("invalid_field");
    const mismatch = await rejectionOf(
      harness.testReports.accept(
        userCaller,
        mcp(envelope({ handoff_id: "handoff-1", handoff_package_version: 1 })),
      ),
    );
    expect(mismatch).toMatchObject({
      code: "reference_scope_mismatch",
      fieldPath: "handoff_package_version",
    });
    expect(harness.sessions.size).toBe(0);
  });

  test("an unknown Handoff is reference_not_found and another Project's is reference_scope_mismatch", async () => {
    const harness = createMemoryHarness({ handoffs });
    const failures = await Promise.all(
      ["handoff-missing", "handoff-foreign"].map((handoffId) =>
        rejectionOf(
          harness.testReports.accept(
            userCaller,
            mcp(
              envelope({ handoff_id: handoffId, handoff_package_version: 1 }),
            ),
          ),
        ),
      ),
    );
    expect(failures.map(({ code, fieldPath }) => [code, fieldPath])).toEqual([
      ["reference_not_found", "handoff_id"],
      ["reference_scope_mismatch", "handoff_id"],
    ]);
    expect(harness.sessions.size).toBe(0);
  });

  test("the exact scenario version must be in the Handoff package", async () => {
    const harness = createMemoryHarness({
      handoffs,
      scenarios: ["case-1@3", "case-1@4"],
    });
    const withScenario = (version: number) =>
      envelope({
        handoff_id: "handoff-1",
        handoff_package_version: 2,
        tests: [
          {
            external_test_id: "a",
            scenario_id: "case-1",
            scenario_version: version,
            title: "A",
          },
        ],
      });
    const outside = await rejectionOf(
      harness.testReports.accept(userCaller, mcp(withScenario(4))),
    );
    expect(outside.code).toBe("reference_scope_mismatch");
    const inside = await accepted(
      harness.testReports,
      userCaller,
      mcp(withScenario(3)),
    );
    expect(inside.session.handoffId).toBe("handoff-1");
    expect(inside.session.handoffStateAtAccept).toBe("Shared");
  });

  test("a report to a Canceled Handoff is history and the Handoff stays Canceled", async () => {
    const harness = createMemoryHarness({ handoffs });
    const { session } = await accepted(
      harness.testReports,
      userCaller,
      mcp(
        envelope({
          handoff_id: "handoff-canceled",
          handoff_package_version: 1,
        }),
      ),
    );
    expect(session.handoffStateAtAccept).toBe("Canceled");
    expect(handoffs.find(({ id }) => id === "handoff-canceled")?.state).toBe(
      "Canceled",
    );
  });
});

describe("relations allow-list", () => {
  const references = [
    { id: "work-1", projectId, type: "work" },
    { id: "feature-foreign", projectId: otherProjectId, type: "feature" },
    { id: "release-1", projectId, type: "project_release" },
  ];
  const withRelations = (relations: unknown[]) =>
    envelope({
      tests: [{ external_test_id: "a", relations, title: "A" }],
    });
  const refusalOf = (
    harness: ReturnType<typeof createMemoryHarness>,
    relations: unknown[],
  ) =>
    rejectionOf(
      harness.testReports.accept(userCaller, mcp(withRelations(relations))),
    );

  test("valid relations are stored on the Session Test and create nothing else", async () => {
    const harness = createMemoryHarness({
      handoffs,
      references,
      scenarios: ["case-1@3"],
    });
    const { session } = await accepted(
      harness.testReports,
      userCaller,
      mcp(
        withRelations([
          { target_id: "work-1", target_type: "work" },
          { target_id: "release-1", target_type: "project_release" },
          { target_id: "handoff-1", target_type: "test_handoff" },
          {
            scenario_version: 3,
            target_id: "case-1",
            target_type: "planned_test_case",
          },
        ]),
      ),
    );
    expect(session.tests[0]?.relations).toHaveLength(4);
  });

  test("each invalid relation uses the PRD error code", async () => {
    const harness = createMemoryHarness({ handoffs, references });
    const codes = await Promise.all(
      [
        [{ target_id: "d", target_type: "document" }],
        [{ target_id: "feature-foreign", target_type: "feature" }],
        [{ target_id: "nope", target_type: "work" }],
        [{ target_id: "gap-1", target_type: "test_gap" }],
        [{ target_id: "case-1", target_type: "planned_test_case" }],
        [{ target_id: "handoff-foreign", target_type: "test_handoff" }],
      ].map(async (relations) => (await refusalOf(harness, relations)).code),
    );
    expect(codes).toEqual([
      "unsupported_field",
      "reference_scope_mismatch",
      "reference_not_found",
      "reference_not_found",
      "invalid_field",
      "reference_scope_mismatch",
    ]);
    expect(harness.sessions.size).toBe(0);
  });

  test("a Handoff relation that contradicts handoff_id is reference_scope_mismatch", async () => {
    const harness = createMemoryHarness({ handoffs, references });
    const failure = await rejectionOf(
      harness.testReports.accept(
        userCaller,
        mcp(
          envelope({
            handoff_id: "handoff-1",
            handoff_package_version: 2,
            tests: [
              {
                external_test_id: "a",
                relations: [
                  {
                    target_id: "handoff-canceled",
                    target_type: "test_handoff",
                  },
                ],
                title: "A",
              },
            ],
          }),
        ),
      ),
    );
    expect(failure.code).toBe("reference_scope_mismatch");
  });
});

describe("limits", () => {
  const oneTest = (extra: Record<string, unknown>) =>
    envelope({ tests: [{ external_test_id: "a", title: "A", ...extra }] });
  const refuse = (report: unknown) =>
    rejectionOf(
      createMemoryHarness().testReports.accept(userCaller, mcp(report)),
    );

  test("per-test caps are invalid_field and sizes are payload_too_large", async () => {
    const relation = { target_id: "w", target_type: "work" };
    const evidence = { type: "external_url", value: "https://example.test" };
    const codes = await Promise.all([
      refuse(oneTest({ relations: new Array(51).fill(relation) })),
      refuse(oneTest({ evidence: new Array(21).fill(evidence) })),
      refuse(
        oneTest({
          evidence: [
            { type: "text_excerpt", value: "x".repeat(16 * 1024 + 1) },
          ],
        }),
      ),
      refuse({ ...oneTest({}), raw_report: "x".repeat(1024 * 1024 + 1) }),
    ]);
    expect(codes.map(({ code }) => code)).toEqual([
      "invalid_field",
      "invalid_field",
      "invalid_field",
      "payload_too_large",
    ]);
  });

  test("an envelope over 5 MiB is payload_too_large before it is validated", async () => {
    const failure = await rejectionOf(
      createMemoryHarness().testReports.accept(
        userCaller,
        file(" ".repeat(5 * 1024 * 1024 + 1)),
      ),
    );
    expect(failure.code).toBe("payload_too_large");
    const mcpFailure = await refuse({
      ...envelope(),
      padding: "x".repeat(5 * 1024 * 1024 + 1),
    });
    expect(mcpFailure.code).toBe("payload_too_large");
  });
});

describe("attachment_ref evidence", () => {
  const attachments = [
    { contentHash: "a".repeat(64), id: "file-1", projectId },
    {
      contentHash: "b".repeat(64),
      id: "file-foreign",
      projectId: otherProjectId,
    },
    {
      contentHash: "c".repeat(64),
      id: "file-trashed",
      lifecycleStatus: "Trash" as const,
      projectId,
    },
  ];
  const withAttachment = (id: string) =>
    envelope({
      tests: [
        {
          evidence: [{ type: "attachment_ref", value: id }],
          external_test_id: "a",
          title: "A",
        },
      ],
    });

  test("must be an accessible File Attachment of the same Project", async () => {
    const harness = createMemoryHarness({ attachments });
    const codes = await Promise.all(
      ["nope", "file-trashed", "file-foreign"].map(async (id) => {
        const failure = await rejectionOf(
          harness.testReports.accept(userCaller, mcp(withAttachment(id))),
        );
        return [failure.code, failure.fieldPath];
      }),
    );
    expect(codes).toEqual([
      ["reference_not_found", "tests[0].evidence[0].value"],
      ["reference_not_found", "tests[0].evidence[0].value"],
      ["reference_scope_mismatch", "tests[0].evidence[0].value"],
    ]);
    expect(harness.sessions.size).toBe(0);
    const ok = await harness.testReports.accept(
      userCaller,
      mcp(withAttachment("file-1")),
    );
    expect(ok.outcome).toBe("created");
  });

  test("its content hash is part of the fingerprint", async () => {
    const first = createMemoryHarness({ attachments });
    const changed = createMemoryHarness({
      attachments: [{ contentHash: "d".repeat(64), id: "file-1", projectId }],
    });
    const [one, two] = await Promise.all([
      first.testReports.accept(userCaller, mcp(withAttachment("file-1"))),
      changed.testReports.accept(userCaller, mcp(withAttachment("file-1"))),
    ]);
    expect(one.session.fingerprint).not.toBe(two.session.fingerprint);
  });
});
