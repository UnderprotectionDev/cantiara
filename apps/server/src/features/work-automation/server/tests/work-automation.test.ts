import { describe, expect, test } from "vitest";

import { createWorkAutomation } from "../work-automation";
import {
  createFacts,
  createMemoryWriter,
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

function created(id = "event-1", workId = "work-1") {
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

    expect(await automation.handleEvent(created())).toEqual({
      status: "no-match",
    });
    expect(memory.applyCalls()).toBe(0);
    expect(statusOf(works, "work-1")).toBe("Not Started");
  });

  test("applies matching rules and reports a 10-second undo toast", async () => {
    const { automation, works } = setup([createRule()]);

    const result = await automation.handleEvent(created());

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

    const result = await automation.handleEvent(created());

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
        const result = await automation.handleEvent(created());
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

    const result = await automation.handleEvent(created());

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
      ...created("event-2", "work-2"),
      kind: "work-status-changed",
      to: "Blocked",
    });
    expect(result.status).toBe("conflict");
    expect(statusOf(works, "work-2")).toBe("Blocked");
  });

  test("retrying the same original event is idempotent", async () => {
    const { automation, memory } = setup([createRule()]);

    const first = await automation.handleEvent(created());
    const second = await automation.handleEvent(created());

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

    await automation.handleEvent(created());
    expect(statusOf(works, "work-1")).toBe("In Progress");

    const echoed = await automation.handleEvent({
      ...created("event-echo"),
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

    const result = await automation.handleEvent(created("event-9", "missing"));
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

    const result = await automation.handleEvent(created());

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

    expect(await automation.handleEvent(created())).toEqual({
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
    const result = await automation.handleEvent(created());
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
