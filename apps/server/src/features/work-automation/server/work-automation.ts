import {
  canonicalizeMutationPayload,
  fingerprintMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import {
  WORK_AUTOMATION_UNDO_WINDOW_MS,
  type WorkAutomationAction,
  type WorkAutomationChange,
  type WorkAutomationCondition,
  type WorkAutomationConflict,
  type WorkAutomationDryRunResult,
  type WorkAutomationEvent,
  type WorkAutomationFieldValue,
  type WorkAutomationReceipt,
  type WorkAutomationRule,
  type WorkAutomationRuleAttribution,
  type WorkAutomationSignal,
  type WorkAutomationUndoResult,
  workAutomationEventSchema,
} from "@cantiara/api/work-automation";

export interface WorkAutomationWorkSnapshot {
  id: string;
  projectId: string;
  status: string;
  type: string;
}

export interface WorkAutomationFacts {
  listWorks: (projectId: string) => Promise<WorkAutomationWorkSnapshot[]>;
  work: (workId: string) => Promise<WorkAutomationWorkSnapshot | null>;
}

export interface WorkAutomationRuleReader {
  activeRules: (
    projectId: string,
    triggerKind: WorkAutomationEvent["kind"],
  ) => Promise<WorkAutomationRule[]>;
  find: (ruleId: string) => Promise<WorkAutomationRule | null>;
}

export interface WorkAutomationApplyInput {
  appliedAt: string;
  changes: WorkAutomationChange[];
  idempotencyKey: string;
  projectId: string;
  undoUntil: string;
}

export interface WorkAutomationWriter {
  /** One atomic, idempotent mutation; a replayed key returns the first receipt. */
  apply: (input: WorkAutomationApplyInput) => Promise<WorkAutomationReceipt>;
  undo: (receiptId: string) => Promise<WorkAutomationUndoResult>;
}

export interface WorkAutomationSignalSink {
  publish: (signal: WorkAutomationSignal) => Promise<void>;
}

export interface WorkAutomationOptions {
  facts: WorkAutomationFacts;
  now?: () => Date;
  rules: WorkAutomationRuleReader;
  signals: WorkAutomationSignalSink;
  writer: WorkAutomationWriter;
}

export interface WorkAutomationToast {
  message: string;
  undoable: boolean;
  undoUntil: string;
}

export type WorkAutomationRunResult =
  | { reason: "automation-origin" | "unsupported-event"; status: "ignored" }
  | { status: "no-match" }
  | {
      conflicts: WorkAutomationConflict[];
      failures: WorkAutomationSignal[];
      receipt: WorkAutomationReceipt | null;
      status: "conflict" | "failed" | "applied";
      toast: WorkAutomationToast | null;
    };

interface Proposal {
  attribution: WorkAutomationRuleAttribution;
  change:
    | {
        field: "status";
        kind: "set-work-field";
        value: WorkAutomationFieldValue;
        workId: string;
      }
    | {
        kind: "create-work";
        title: string;
        type: Extract<WorkAutomationChange, { kind: "create-work" }>["type"];
      };
}

class StepFailure extends Error {
  readonly step: WorkAutomationSignal["failedStep"];

  constructor(step: WorkAutomationSignal["failedStep"], message: string) {
    super(message);
    this.name = "WorkAutomationStepFailure";
    this.step = step;
  }
}

const CONFLICT_RESOLUTION =
  "Disable or edit one of these rules so they stop proposing different values for this field.";

function valueKey(value: WorkAutomationFieldValue) {
  return canonicalizeMutationPayload(value as MutationPayload);
}

function conditionHolds(
  condition: WorkAutomationCondition,
  work: WorkAutomationWorkSnapshot,
) {
  if (condition.kind === "work-status-is") {
    return work.status === condition.status;
  }
  return work.type === condition.type;
}

function proposalsFor(
  rule: WorkAutomationRule,
  action: WorkAutomationAction,
  eventId: string,
  work: WorkAutomationWorkSnapshot | null,
): Proposal {
  const attribution: WorkAutomationRuleAttribution = {
    action,
    conditions: rule.definition.conditions,
    ruleId: rule.id,
    ruleName: rule.name,
    ruleVersion: rule.version,
    trigger: rule.definition.trigger,
    triggerEventId: eventId,
  };
  if (action.kind === "create-work") {
    return {
      attribution,
      change: { kind: "create-work", title: action.title, type: action.type },
    };
  }
  if (!work) {
    throw new StepFailure("action", "The target Work is unavailable.");
  }
  return {
    attribution,
    change: {
      field: "status",
      kind: "set-work-field",
      value: { status: action.status },
      workId: work.id,
    },
  };
}

function evaluateRule(
  rule: WorkAutomationRule,
  eventId: string,
  work: WorkAutomationWorkSnapshot | null,
): Proposal[] {
  for (const condition of rule.definition.conditions) {
    if (!(work && conditionHolds(condition, work))) {
      return [];
    }
  }
  return rule.definition.actions.map((action) =>
    proposalsFor(rule, action, eventId, work),
  );
}

function detectConflicts(proposals: Proposal[]) {
  const byField = new Map<string, Proposal[]>();
  for (const proposal of proposals) {
    if (proposal.change.kind !== "set-work-field") {
      continue;
    }
    const key = `${proposal.change.workId}:${proposal.change.field}`;
    byField.set(key, [...(byField.get(key) ?? []), proposal]);
  }
  const conflicts: WorkAutomationConflict[] = [];
  for (const group of byField.values()) {
    const values = new Set(
      group.map(({ change }) =>
        change.kind === "set-work-field" ? valueKey(change.value) : "",
      ),
    );
    if (values.size < 2) {
      continue;
    }
    const first = group[0]?.change;
    if (first?.kind !== "set-work-field") {
      continue;
    }
    conflicts.push({
      field: first.field,
      proposals: group.flatMap(({ attribution, change }) =>
        change.kind === "set-work-field"
          ? [{ attribution, value: change.value }]
          : [],
      ),
      resolution: CONFLICT_RESOLUTION,
      workId: first.workId,
    });
  }
  return conflicts;
}

function mergeChanges(proposals: Proposal[]) {
  const merged = new Map<string, WorkAutomationChange>();
  const changes: WorkAutomationChange[] = [];
  for (const { attribution, change } of proposals) {
    if (change.kind === "create-work") {
      changes.push({ ...change, attributions: [attribution] });
      continue;
    }
    const key = `${change.workId}:${change.field}:${valueKey(change.value)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.attributions.push(attribution);
      continue;
    }
    const created: WorkAutomationChange = {
      ...change,
      attributions: [attribution],
    };
    merged.set(key, created);
    changes.push(created);
  }
  return changes;
}

function failureReason(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error.";
  return `${message} Edit or disable this rule, then run it again.`;
}

function conflictSignals(
  conflicts: WorkAutomationConflict[],
  event: WorkAutomationEvent,
  occurredAt: string,
): WorkAutomationSignal[] {
  return conflicts.flatMap((conflict) => {
    const names = conflict.proposals
      .map(({ attribution }) => attribution.ruleName)
      .join(", ");
    return conflict.proposals.map(({ attribution }) => ({
      failedStep: "action" as const,
      kind: "automation-conflict" as const,
      occurredAt,
      projectId: event.projectId,
      reason: `${CONFLICT_RESOLUTION} Conflicting rules: ${names}.`,
      ruleId: attribution.ruleId,
      ruleName: attribution.ruleName,
      ruleVersion: attribution.ruleVersion,
      trigger: attribution.trigger,
      triggerEventId: event.id,
    }));
  });
}

function runStatus(
  receipt: WorkAutomationReceipt | null,
  conflicts: WorkAutomationConflict[],
) {
  if (receipt) {
    return "applied" as const;
  }
  return conflicts.length > 0 ? ("conflict" as const) : ("failed" as const);
}

function toastFor(receipt: WorkAutomationReceipt): WorkAutomationToast {
  const count = receipt.changes.length;
  return {
    message: `Automation applied ${count} change${count === 1 ? "" : "s"}.`,
    undoUntil: receipt.undoUntil,
    undoable: receipt.changes.every(({ kind }) => kind === "set-work-field"),
  };
}

export function createWorkAutomation(options: WorkAutomationOptions) {
  const now = options.now ?? (() => new Date());

  function failureSignal(
    rule: WorkAutomationRule,
    event: WorkAutomationEvent,
    error: unknown,
  ): WorkAutomationSignal {
    return {
      failedStep: error instanceof StepFailure ? error.step : "action",
      kind: "automation-failed",
      occurredAt: now().toISOString(),
      projectId: rule.projectId,
      reason: failureReason(error),
      ruleId: rule.id,
      ruleName: rule.name,
      ruleVersion: rule.version,
      trigger: rule.definition.trigger,
      triggerEventId: event.id,
    };
  }

  async function matchingRules(event: WorkAutomationEvent) {
    const rules = await options.rules.activeRules(event.projectId, event.kind);
    return rules.filter(
      (rule) =>
        rule.enabled &&
        rule.trashedAt === null &&
        rule.projectId === event.projectId &&
        rule.definition.trigger.kind === event.kind &&
        (event.kind !== "work-status-changed" ||
          (rule.definition.trigger.kind === "work-status-changed" &&
            rule.definition.trigger.to === event.to)) &&
        (event.kind !== "recurring-schedule" || rule.id === event.ruleId),
    );
  }

  async function proposalsForRule(
    rule: WorkAutomationRule,
    event: WorkAutomationEvent,
  ) {
    let work: WorkAutomationWorkSnapshot | null = null;
    if ("workId" in event) {
      work = await options.facts.work(event.workId);
      if (!work) {
        throw new StepFailure("trigger", "The triggering Work is gone.");
      }
    }
    return evaluateRule(rule, event.id, work);
  }

  async function collect(
    rules: WorkAutomationRule[],
    event: WorkAutomationEvent,
  ) {
    const settled = await Promise.all(
      rules.map(async (rule) => {
        try {
          return {
            failure: null,
            proposals: await proposalsForRule(rule, event),
          };
        } catch (error) {
          return {
            failure: failureSignal(rule, event, error),
            proposals: [] as Proposal[],
          };
        }
      }),
    );
    return {
      failures: settled.flatMap(({ failure }) => (failure ? [failure] : [])),
      proposals: settled.flatMap(({ proposals }) => proposals),
    };
  }

  async function applyChanges(
    rules: WorkAutomationRule[],
    event: WorkAutomationEvent,
    changes: WorkAutomationChange[],
  ) {
    const appliedAt = now();
    const participants = changes
      .flatMap((change) => change.attributions)
      .map(({ ruleId, ruleVersion }) => `${ruleId}@${ruleVersion}`)
      .sort();
    const idempotencyKey = await fingerprintMutationPayload({
      eventId: event.id,
      participants,
    });
    try {
      const receipt = await options.writer.apply({
        appliedAt: appliedAt.toISOString(),
        changes,
        idempotencyKey,
        projectId: event.projectId,
        undoUntil: new Date(
          appliedAt.getTime() + WORK_AUTOMATION_UNDO_WINDOW_MS,
        ).toISOString(),
      });
      return { failures: [], receipt };
    } catch (error) {
      const participating = new Set(
        changes.flatMap((change) =>
          change.attributions.map(({ ruleId }) => ruleId),
        ),
      );
      return {
        failures: rules
          .filter(({ id }) => participating.has(id))
          .map((rule) => failureSignal(rule, event, error)),
        receipt: null,
      };
    }
  }

  async function handleEvent(raw: unknown): Promise<WorkAutomationRunResult> {
    if ((raw as { origin?: unknown } | null)?.origin === "automation") {
      return { reason: "automation-origin", status: "ignored" };
    }
    const parsed = workAutomationEventSchema.safeParse(raw);
    if (!parsed.success) {
      return { reason: "unsupported-event", status: "ignored" };
    }
    const event = parsed.data;
    const rules = await matchingRules(event);
    const collected = await collect(rules, event);

    const conflicts = detectConflicts(collected.proposals);
    const conflictedTargets = new Set(conflicts.map(({ workId }) => workId));
    const changes = mergeChanges(
      collected.proposals.filter(
        ({ change }) =>
          change.kind === "create-work" ||
          !conflictedTargets.has(change.workId),
      ),
    );

    const applied =
      changes.length > 0
        ? await applyChanges(rules, event, changes)
        : { failures: [], receipt: null };
    const failures = [...collected.failures, ...applied.failures];
    const { receipt } = applied;

    await Promise.all(
      [
        ...conflictSignals(conflicts, event, now().toISOString()),
        ...failures,
      ].map((signal) => options.signals.publish(signal)),
    );

    if (!(receipt || conflicts.length || failures.length)) {
      return { status: "no-match" };
    }
    return {
      conflicts,
      failures,
      receipt,
      status: runStatus(receipt, conflicts),
      toast: receipt ? toastFor(receipt) : null,
    };
  }

  async function dryRun(
    ruleId: string,
  ): Promise<WorkAutomationDryRunResult | null> {
    const rule = await options.rules.find(ruleId);
    if (!rule || rule.trashedAt) {
      return null;
    }
    const { trigger } = rule.definition;
    const matches: WorkAutomationDryRunResult["matches"] = [];
    if (trigger.kind === "recurring-schedule") {
      matches.push({
        changes: mergeChanges(evaluateRule(rule, "dry-run", null)),
        workId: null,
      });
    } else {
      const works = await options.facts.listWorks(rule.projectId);
      for (const work of works) {
        if (
          trigger.kind === "work-status-changed" &&
          work.status !== trigger.to
        ) {
          continue;
        }
        const changes = mergeChanges(evaluateRule(rule, "dry-run", work));
        if (changes.length > 0) {
          matches.push({ changes, workId: work.id });
        }
      }
    }
    return { matches, ruleId, written: false };
  }

  return {
    dryRun,
    handleEvent,
    undo: (receiptId: string) => options.writer.undo(receiptId),
  };
}

export type WorkAutomation = ReturnType<typeof createWorkAutomation>;
