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
  createRuleReader,
  createSignalLog,
  FIXED_NOW,
  PROJECT_ID,
  statusOf,
} from "./work-automation-fixtures";

function setup(
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
    const { automation, memory, works } = setup({
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
        const { automation, memory, works } = setup({ required });
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
    const off = setup({ required, rules: [] });
    const result = await off.automation.handleEvent(merged("pr-1"));

    expect(result).toEqual({
      status: "suggested",
      suggestion: { label: "Mark as Completed", workId: "work-1" },
    });
    expect(off.memory.applyCalls()).toBe(0);
    expect(statusOf(off.works, "work-1")).toBe("In Progress");

    const notMet = setup({
      required: [{ id: "pr-1", merged: false }],
      rules: [],
    });
    expect(await notMet.automation.handleEvent(merged("pr-1"))).toEqual({
      status: "no-match",
    });
  });

  test("a PR link or other GitHub events never write", async () => {
    const { automation, memory, works } = setup({
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
    const { automation, works } = setup({
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
    const { automation, memory, works } = setup({
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
