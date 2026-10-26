import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createRequiredPrMergeRuleInputSchema,
  createWorkAutomationRuleInputSchema,
  WORK_AUTOMATION_REQUIRED_PR_MERGE_DEFINITION,
  WORK_AUTOMATION_UI_LABELS,
} from "@cantiara/api/work-automation";
import { describe, expect, test } from "vitest";
import {
  createWorkAutomation,
  type WorkAutomationRequiredPullRequest,
} from "../work-automation";
import {
  createFacts,
  createMemoryWriter,
  createPrMergeRule,
  createRule,
  createRuleReader,
  createSignalLog,
  FIXED_NOW,
  PROJECT_ID,
  setStatus,
  statusOf,
} from "./work-automation-fixtures";

function setup(
  rules: ReturnType<typeof createRule>[],
  options: { failWith?: Error } = {},
) {
  const works = [
    {
      id: "work-1",
      projectId: PROJECT_ID,
      status: "Not Started",
      type: "Task",
    },
    { id: "work-2", projectId: PROJECT_ID, status: "Blocked", type: "Bug" },
  ];
  const memory = createMemoryWriter(works, options);
  const log = createSignalLog();
  const automation = createWorkAutomation({
    facts: createFacts(works),
    now: () => FIXED_NOW,
    rules: createRuleReader(rules),
    signals: log.sink,
    writer: memory.writer,
  });
  return { automation, log, memory, works };
}

function createdFixture(id = "event-1", workId = "work-1") {
  return {
    id,
    kind: "work-created" as const,
    occurredAt: FIXED_NOW.toISOString(),
    origin: "user" as const,
    projectId: PROJECT_ID,
    workId,
  };
}

describe("Work Automation", () => {
  test("runs only explicitly enabled rules outside Trash", async () => {
    const { automation, memory, works } = setup([
      createRule({ enabled: false, id: "draft" }),
      createRule({ id: "trashed", trashedAt: "2026-10-02T09:00:00.000Z" }),
    ]);

    expect(await automation.handleEvent(createdFixture())).toEqual({
      status: "no-match",
    });
    expect(memory.applyCalls()).toBe(0);
    expect(statusOf(works, "work-1")).toBe("Not Started");
  });

  test("applies matching rules and reports a 10-second undo toast", async () => {
    const { automation, works } = setup([createRule()]);

    const result = await automation.handleEvent(createdFixture());

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      return;
    }
    expect(statusOf(works, "work-1")).toBe("In Progress");
    expect(result.toast).toEqual({
      message: "Automation applied 1 change.",
      undoUntil: "2026-10-22T09:00:10.000Z",
      undoable: true,
    });
  });

  test("conflicting values on one target field write nothing and name the rules", async () => {
    const { automation, log, memory, works } = setup([
      createRule({ id: "start", name: "Start" }),
      createRule({
        actions: [{ kind: "set-work-status", status: "Blocked" }],
        id: "block",
        name: "Block",
      }),
    ]);

    const result = await automation.handleEvent(createdFixture());

    expect(result.status).toBe("conflict");
    if (result.status !== "conflict") {
      return;
    }
    expect(memory.applyCalls()).toBe(0);
    expect(statusOf(works, "work-1")).toBe("Not Started");
    expect(result.conflicts).toHaveLength(1);
    expect(
      result.conflicts[0]?.proposals.map(({ attribution, value }) => [
        attribution.ruleName,
        value,
      ]),
    ).toEqual([
      ["Start", { status: "In Progress" }],
      ["Block", { status: "Blocked" }],
    ]);
    expect(result.conflicts[0]?.resolution).toContain("Disable or edit");
    expect(log.signals.map(({ kind }) => kind)).toEqual([
      "automation-conflict",
      "automation-conflict",
    ]);
  });

  test("rule order never picks a winner", async () => {
    const rules = [
      createRule({ id: "a" }),
      createRule({
        actions: [{ kind: "set-work-status", status: "Blocked" }],
        id: "b",
      }),
    ];
    const runs = await Promise.all(
      [rules, [...rules].reverse()].map(async (ordered) => {
        const { automation, works } = setup(ordered);
        const result = await automation.handleEvent(createdFixture());
        return { result, status: statusOf(works, "work-1") };
      }),
    );
    for (const { result, status } of runs) {
      expect(result.status).toBe("conflict");
      expect(status).toBe("Not Started");
    }
  });

  test("non-conflicting proposals become one mutation carrying every attribution", async () => {
    const { automation, memory } = setup([
      createRule({ id: "a", name: "A" }),
      createRule({ id: "b", name: "B", version: 3 }),
    ]);

    const result = await automation.handleEvent(createdFixture());

    expect(result.status).toBe("applied");
    if (result.status !== "applied" || !result.receipt) {
      return;
    }
    expect(memory.applyCalls()).toBe(1);
    expect(result.receipt.changes).toHaveLength(1);
    expect(
      result.receipt.changes[0]?.attributions.map(
        ({ ruleId, ruleVersion, triggerEventId }) => [
          ruleId,
          ruleVersion,
          triggerEventId,
        ],
      ),
    ).toEqual([
      ["a", 1, "event-1"],
      ["b", 3, "event-1"],
    ]);
  });

  test("a conflict on one Work does not block other Work in the same event set", async () => {
    const { automation, works } = setup([
      createRule({
        id: "a",
        trigger: { kind: "work-status-changed", to: "Blocked" },
      }),
      createRule({
        actions: [{ kind: "set-work-status", status: "Not Started" }],
        id: "b",
        trigger: { kind: "work-status-changed", to: "Blocked" },
      }),
    ]);
    const result = await automation.handleEvent({
      ...createdFixture("event-2", "work-2"),
      kind: "work-status-changed",
      to: "Blocked",
    });
    expect(result.status).toBe("conflict");
    expect(statusOf(works, "work-2")).toBe("Blocked");
  });

  test("retrying the same original event is idempotent", async () => {
    const { automation, memory } = setup([createRule()]);

    const first = await automation.handleEvent(createdFixture());
    const second = await automation.handleEvent(createdFixture());

    expect(first.status).toBe("applied");
    expect(second.status).toBe("applied");
    if (first.status === "applied" && second.status === "applied") {
      expect(second.receipt?.id).toBe(first.receipt?.id);
    }
    expect(memory.created).toHaveLength(0);
  });

  test("a rule write never triggers another rule", async () => {
    const { automation, works } = setup([
      createRule({ id: "start" }),
      createRule({
        actions: [{ kind: "set-work-status", status: "Blocked" }],
        id: "on-progress",
        trigger: { kind: "work-status-changed", to: "In Progress" },
      }),
    ]);

    await automation.handleEvent(createdFixture());
    expect(statusOf(works, "work-1")).toBe("In Progress");

    const echoed = await automation.handleEvent({
      ...createdFixture("event-echo"),
      kind: "work-status-changed",
      origin: "automation",
      to: "In Progress",
    });
    expect(echoed).toEqual({ reason: "automation-origin", status: "ignored" });
    expect(statusOf(works, "work-1")).toBe("In Progress");
  });

  test("a failed rule emits an automation-failed signal and the rest still run", async () => {
    const { automation, log, works } = setup([
      createRule({ id: "good", name: "Good" }),
    ]);

    const result = await automation.handleEvent(
      createdFixture("event-9", "missing"),
    );
    expect(result.status).toBe("failed");
    expect(statusOf(works, "work-1")).toBe("Not Started");
    expect(log.signals).toHaveLength(1);
    expect(log.signals[0]).toMatchObject({
      failedStep: "trigger",
      kind: "automation-failed",
      ruleId: "good",
      ruleName: "Good",
      trigger: { kind: "work-created" },
      triggerEventId: "event-9",
    });
    expect(log.signals[0]?.reason).toContain("Edit or disable this rule");
  });

  test("a writer failure is surfaced for every participating rule, never swallowed", async () => {
    const { automation, log } = setup(
      [createRule({ id: "a" }), createRule({ id: "b" })],
      { failWith: new Error("Work revision changed.") },
    );

    const result = await automation.handleEvent(createdFixture());

    expect(result.status).toBe("failed");
    expect(
      log.signals.map(({ failedStep, kind, ruleId }) => [
        kind,
        ruleId,
        failedStep,
      ]),
    ).toEqual([
      ["automation-failed", "a", "action"],
      ["automation-failed", "b", "action"],
    ]);
    expect(log.signals[0]?.reason).toContain("Work revision changed.");
  });

  test("conditions gate the action", async () => {
    const { automation, works } = setup([
      createRule({ conditions: [{ kind: "work-type-is", type: "Bug" }] }),
    ]);

    expect(await automation.handleEvent(createdFixture())).toEqual({
      status: "no-match",
    });
    expect(statusOf(works, "work-1")).toBe("Not Started");
  });

  test("dry run lists matches and proposed changes without writing", async () => {
    const { automation, memory, works } = setup([
      createRule({
        conditions: [{ kind: "work-status-is", status: "Blocked" }],
        enabled: false,
        id: "dry",
        trigger: { kind: "work-status-changed", to: "Blocked" },
      }),
    ]);

    const result = await automation.dryRun("dry");

    expect(result?.written).toBe(false);
    expect(result?.matches.map(({ workId }) => workId)).toEqual(["work-2"]);
    expect(result?.matches[0]?.changes[0]).toMatchObject({
      kind: "set-work-field",
      value: { status: "In Progress" },
    });
    expect(memory.applyCalls()).toBe(0);
    expect(statusOf(works, "work-2")).toBe("Blocked");
  });

  test("dry run of a create trigger previews no existing Work", async () => {
    const { automation, memory, works } = setup([
      createRule({ enabled: false, id: "dry" }),
    ]);

    const result = await automation.dryRun("dry");

    expect(result?.written).toBe(false);
    expect(result?.matches).toEqual([]);
    expect(memory.applyCalls()).toBe(0);
    expect(statusOf(works, "work-1")).toBe("Not Started");
    expect(statusOf(works, "work-2")).toBe("Blocked");
  });

  test("dry run is unavailable for a rule in Trash", async () => {
    const { automation } = setup([
      createRule({ id: "gone", trashedAt: "2026-10-02T09:00:00.000Z" }),
    ]);
    expect(await automation.dryRun("gone")).toBeNull();
  });

  test("repeating Work mints a new independent Work each time", async () => {
    const { automation, memory } = setup([
      createRule({
        actions: [
          { kind: "create-work", title: "Weekly review", type: "Task" },
        ],
        id: "weekly",
        trigger: { everyDays: 7, kind: "recurring-schedule" },
      }),
    ]);
    const tick = (id: string) => ({
      id,
      kind: "recurring-schedule" as const,
      occurredAt: FIXED_NOW.toISOString(),
      origin: "system" as const,
      projectId: PROJECT_ID,
      ruleId: "weekly",
    });

    const first = await automation.handleEvent(tick("tick-1"));
    const second = await automation.handleEvent(tick("tick-2"));

    expect(first.status).toBe("applied");
    expect(second.status).toBe("applied");
    expect(memory.created).toEqual([
      { title: "Weekly review", type: "Task" },
      { title: "Weekly review", type: "Task" },
    ]);
    if (first.status === "applied") {
      expect(first.toast?.undoable).toBe(false);
    }
  });

  test("undo stops when a newer value would be clobbered", async () => {
    const { automation, works } = setup([createRule()]);
    const result = await automation.handleEvent(createdFixture());
    if (result.status !== "applied" || !result.receipt) {
      throw new Error("expected applied");
    }

    setStatus(works, "work-1", "Blocked");
    expect(await automation.undo(result.receipt.id)).toEqual({
      fields: ["work-1:status"],
      status: "conflict",
    });
    expect(statusOf(works, "work-1")).toBe("Blocked");

    setStatus(works, "work-1", "In Progress");
    expect(await automation.undo(result.receipt.id)).toEqual({
      status: "undone",
    });
    expect(statusOf(works, "work-1")).toBe("Not Started");
  });

  test("events outside the closed catalog are ignored", async () => {
    const { automation, memory } = setup([createRule()]);

    const results = await Promise.all(
      ["pull-request-opened", "github-check-failed", "http-webhook"].map(
        (kind) =>
          automation.handleEvent({ id: "x", kind, projectId: PROJECT_ID }),
      ),
    );
    for (const result of results) {
      expect(result).toEqual({
        reason: "unsupported-event",
        status: "ignored",
      });
    }
    expect(memory.applyCalls()).toBe(0);
  });
});

function setupWorkAutomationPrMerge(
  options: {
    required?: WorkAutomationRequiredPullRequest[];
    rules?: ReturnType<typeof createPrMergeRule>[];
    status?: string;
  } = {},
) {
  const works = [
    {
      id: "work-1",
      projectId: PROJECT_ID,
      status: options.status ?? "In Progress",
      type: "Task",
    },
  ];
  const memory = createMemoryWriter(works);
  const log = createSignalLog();
  const automation = createWorkAutomation({
    facts: createFacts(works, { "work-1": options.required ?? [] }),
    now: () => FIXED_NOW,
    rules: createRuleReader(options.rules ?? [createPrMergeRule()]),
    signals: log.sink,
    writer: memory.writer,
  });
  return { automation, log, memory, works };
}

function merged(pullRequestId: string, id = `merge-${pullRequestId}`) {
  return {
    id,
    kind: "pull-request-merged" as const,
    occurredAt: FIXED_NOW.toISOString(),
    origin: "system" as const,
    projectId: PROJECT_ID,
    pullRequestId,
    workId: "work-1",
  };
}

describe("prepared PR-merge rule", () => {
  test("completes Work when every required PR is merged", async () => {
    const { automation, memory, works } = setupWorkAutomationPrMerge({
      required: [
        { id: "pr-1", merged: true },
        { id: "pr-2", merged: true },
      ],
    });

    const result = await automation.handleEvent(merged("pr-2"));

    expect(result.status).toBe("applied");
    if (result.status !== "applied") {
      return;
    }
    expect(statusOf(works, "work-1")).toBe("Closed");
    expect(memory.closures.get("work-1")).toBe("Completed");
    expect(result.receipt?.changes[0]?.attributions[0]).toMatchObject({
      ruleName: WORK_AUTOMATION_UI_LABELS.requiredPrMerge,
      ruleVersion: 1,
      trigger: { kind: "required-prs-merged" },
      triggerEventId: "merge-pr-2",
    });
  });

  test("merge matrix: zero, partial and contextual-only merges do not complete Work", async () => {
    const cases = [
      { event: "pr-1", name: "zero required PRs", required: [] },
      {
        event: "pr-1",
        name: "partial required merge",
        required: [
          { id: "pr-1", merged: true },
          { id: "pr-2", merged: false },
        ],
      },
      {
        event: "contextual-1",
        name: "only a contextual PR merged",
        required: [{ id: "pr-1", merged: false }],
      },
      {
        event: "contextual-1",
        name: "contextual merge after required ones were already merged",
        required: [{ id: "pr-1", merged: true }],
      },
    ];

    const runs = await Promise.all(
      cases.map(async ({ event, name, required }) => {
        const { automation, memory, works } = setupWorkAutomationPrMerge({
          required,
        });
        const result = await automation.handleEvent(merged(event));
        return {
          applyCalls: memory.applyCalls(),
          name,
          result,
          status: statusOf(works, "work-1"),
        };
      }),
    );

    for (const { applyCalls, name, result, status } of runs) {
      expect({ name, result }).toEqual({
        name,
        result: { status: "no-match" },
      });
      expect(applyCalls).toBe(0);
      expect(status).toBe("In Progress");
    }
  });

  test("with the rule off the same condition only suggests Mark as Completed", async () => {
    const required = [{ id: "pr-1", merged: true }];
    const off = setupWorkAutomationPrMerge({ required, rules: [] });
    const result = await off.automation.handleEvent(merged("pr-1"));

    expect(result).toEqual({
      status: "suggested",
      suggestion: { label: "Mark as Completed", workId: "work-1" },
    });
    expect(off.memory.applyCalls()).toBe(0);
    expect(statusOf(off.works, "work-1")).toBe("In Progress");

    const notMet = setupWorkAutomationPrMerge({
      required: [{ id: "pr-1", merged: false }],
      rules: [],
    });
    expect(await notMet.automation.handleEvent(merged("pr-1"))).toEqual({
      status: "no-match",
    });
  });

  test("a PR link or other GitHub events never write", async () => {
    const { automation, memory, works } = setupWorkAutomationPrMerge({
      required: [{ id: "pr-1", merged: true }],
    });

    const results = await Promise.all(
      [
        "pull-request-linked",
        "pull-request-opened",
        "review-requested",
        "changes-requested",
        "check-run-completed",
      ].map((kind) =>
        automation.handleEvent({
          id: kind,
          kind,
          projectId: PROJECT_ID,
          workId: "work-1",
        }),
      ),
    );

    for (const result of results) {
      expect(result).toEqual({
        reason: "unsupported-event",
        status: "ignored",
      });
    }
    expect(memory.applyCalls()).toBe(0);
    expect(statusOf(works, "work-1")).toBe("In Progress");
  });

  test("a failing check neither delays the close nor reopens completed Work", async () => {
    const { automation, works } = setupWorkAutomationPrMerge({
      required: [{ id: "pr-1", merged: true }],
    });
    const completion = await automation.handleEvent(merged("pr-1"));
    expect(completion.status).toBe("applied");

    const failedCheck = await automation.handleEvent({
      id: "check-1",
      kind: "check-run-failed",
      projectId: PROJECT_ID,
      workId: "work-1",
    });

    expect(failedCheck).toEqual({
      reason: "unsupported-event",
      status: "ignored",
    });
    expect(statusOf(works, "work-1")).toBe("Closed");
    expect(await automation.handleEvent(merged("pr-1", "merge-again"))).toEqual(
      { status: "no-match" },
    );
    expect(statusOf(works, "work-1")).toBe("Closed");
  });

  test("dry run lists Work that would complete and writes nothing", async () => {
    const { automation, memory, works } = setupWorkAutomationPrMerge({
      required: [{ id: "pr-1", merged: true }],
      rules: [createPrMergeRule({ enabled: false })],
    });

    const result = await automation.dryRun("pr-merge");

    expect(result?.matches.map(({ workId }) => workId)).toEqual(["work-1"]);
    expect(result?.matches[0]?.changes[0]).toMatchObject({
      value: { closureResult: "Completed", status: "Closed" },
    });
    expect(memory.applyCalls()).toBe(0);
    expect(statusOf(works, "work-1")).toBe("In Progress");
  });

  test("a failed completion is a visible automation-failed signal", async () => {
    const works = [
      {
        id: "work-1",
        projectId: PROJECT_ID,
        status: "In Progress",
        type: "Task",
      },
    ];
    const log = createSignalLog();
    const memory = createMemoryWriter(works, {
      failWith: new Error("Work revision changed."),
    });
    const automation = createWorkAutomation({
      facts: createFacts(works, { "work-1": [{ id: "pr-1", merged: true }] }),
      now: () => FIXED_NOW,
      rules: createRuleReader([createPrMergeRule()]),
      signals: log.sink,
      writer: memory.writer,
    });

    const result = await automation.handleEvent(merged("pr-1"));

    expect(result.status).toBe("failed");
    expect(log.signals[0]).toMatchObject({
      failedStep: "action",
      kind: "automation-failed",
      ruleName: WORK_AUTOMATION_UI_LABELS.requiredPrMerge,
      trigger: { kind: "required-prs-merged" },
      triggerEventId: "merge-pr-1",
    });
    expect(statusOf(works, "work-1")).toBe("In Progress");
  });
});

describe("prepared rule definition", () => {
  test("a recurring schedule rule only creates Work", () => {
    const created = createWorkAutomationRuleInputSchema.safeParse({
      definition: {
        actions: [
          { kind: "create-work", title: "Weekly review", type: "Task" },
        ],
        conditions: [],
        trigger: { everyDays: 7, kind: "recurring-schedule" },
      },
      name: "Weekly review",
      projectId: PROJECT_ID,
    });
    expect(created.success).toBe(true);

    const mixed = createWorkAutomationRuleInputSchema.safeParse({
      definition: {
        actions: [
          { kind: "create-work", title: "Weekly review", type: "Task" },
          { kind: "set-work-status", status: "In Progress" },
        ],
        conditions: [],
        trigger: { everyDays: 7, kind: "recurring-schedule" },
      },
      name: "Weekly review",
      projectId: PROJECT_ID,
    });
    expect(mixed.success).toBe(false);
  });

  test("only the prepared name and fixed definition may use the PR-merge trigger", () => {
    const valid = createWorkAutomationRuleInputSchema.safeParse({
      definition: WORK_AUTOMATION_REQUIRED_PR_MERGE_DEFINITION,
      name: WORK_AUTOMATION_UI_LABELS.requiredPrMerge,
      projectId: PROJECT_ID,
    });
    expect(valid.success).toBe(true);

    const invalid = [
      {
        definition: WORK_AUTOMATION_REQUIRED_PR_MERGE_DEFINITION,
        name: "My own close rule",
      },
      {
        definition: {
          actions: [{ kind: "complete-work" }],
          conditions: [],
          trigger: { kind: "work-created" },
        },
        name: "Close new Work",
      },
      {
        definition: {
          actions: [{ kind: "complete-work" }],
          conditions: [{ kind: "work-type-is", type: "Bug" }],
          trigger: { kind: "required-prs-merged" },
        },
        name: WORK_AUTOMATION_UI_LABELS.requiredPrMerge,
      },
    ];
    for (const input of invalid) {
      expect(
        createWorkAutomationRuleInputSchema.safeParse({
          ...input,
          projectId: PROJECT_ID,
        }).success,
      ).toBe(false);
    }
    expect(
      createRequiredPrMergeRuleInputSchema.safeParse({
        baseRevision: 0,
        clientIdempotencyKey: "key",
        projectId: PROJECT_ID,
      }).success,
    ).toBe(true);
  });
});

const EFFECT_PATTERN = /completion-effects|Finish effect/i;
const GITHUB_WRITE_PATTERN =
  /octokit|api\.github\.com|child_process|Bun\.spawn|release gate/i;
const RUN_LOG_PATTERN =
  /run[-_ ]?log|automation_run|suggestAutomation|watchHabit/i;

describe("Work Automation boundaries", () => {
  const serverDirectory = join(import.meta.dirname, "..");
  const sources = readdirSync(serverDirectory)
    .filter((file) => file.endsWith(".ts"))
    .map((file) => ({
      file,
      source: readFileSync(join(serverDirectory, file), "utf8"),
    }));

  test("reads the Work Automation sources", () => {
    expect(sources.map(({ file }) => file)).toContain("work-automation.ts");
  });

  test("never reaches the Bitiriş efekti catalog", () => {
    for (const { file, source } of sources) {
      expect({
        file,
        hit: EFFECT_PATTERN.test(source),
      }).toEqual({
        file,
        hit: false,
      });
    }
  });

  test("never calls GitHub write APIs, a release gate or a test runner", () => {
    for (const { file, source } of sources) {
      expect({
        file,
        hit: GITHUB_WRITE_PATTERN.test(source),
      }).toEqual({ file, hit: false });
    }
  });

  test("keeps no separate run log or habit-watching suggestions", () => {
    for (const { file, source } of sources) {
      expect({
        file,
        hit: RUN_LOG_PATTERN.test(source),
      }).toEqual({ file, hit: false });
    }
  });
});

describe("reserved prepared name", () => {
  test("no other rule may borrow the prepared PR-merge name", () => {
    expect(
      createWorkAutomationRuleInputSchema.safeParse({
        definition: {
          actions: [{ kind: "set-work-status", status: "In Progress" }],
          conditions: [],
          trigger: { kind: "work-created" },
        },
        name: WORK_AUTOMATION_UI_LABELS.requiredPrMerge,
        projectId: PROJECT_ID,
      }).success,
    ).toBe(false);
  });
});
