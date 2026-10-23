import {
  WORK_AUTOMATION_UI_LABELS,
  type WorkAutomationAction,
  type WorkAutomationChange,
  type WorkAutomationCondition,
  type WorkAutomationReceipt,
  type WorkAutomationRule,
  type WorkAutomationSignal,
  type WorkAutomationTrigger,
  type WorkAutomationUndoResult,
} from "@cantiara/api/work-automation";

import type {
  WorkAutomationApplyInput,
  WorkAutomationFacts,
  WorkAutomationRequiredPullRequest,
  WorkAutomationRuleReader,
  WorkAutomationWorkSnapshot,
  WorkAutomationWriter,
} from "../work-automation";

export const PROJECT_ID = "project-1";
export const FIXED_NOW = new Date("2026-10-22T09:00:00.000Z");

export function createRule(
  overrides: Partial<WorkAutomationRule> & {
    actions?: WorkAutomationAction[];
    conditions?: WorkAutomationCondition[];
    trigger?: WorkAutomationTrigger;
  } = {},
): WorkAutomationRule {
  const { actions, conditions, trigger, ...rest } = overrides;
  return {
    createdAt: "2026-10-01T09:00:00.000Z",
    definition: {
      actions: actions ?? [{ kind: "set-work-status", status: "In Progress" }],
      conditions: conditions ?? [],
      trigger: trigger ?? { kind: "work-created" },
    },
    enabled: true,
    id: "rule-1",
    name: "Start new Work",
    projectId: PROJECT_ID,
    revision: 1,
    trashedAt: null,
    updatedAt: "2026-10-01T09:00:00.000Z",
    version: 1,
    ...rest,
  };
}

export function createFacts(
  works: WorkAutomationWorkSnapshot[],
  requiredPullRequests: Record<
    string,
    WorkAutomationRequiredPullRequest[]
  > = {},
) {
  const facts: WorkAutomationFacts = {
    listWorks: async () => works,
    requiredPullRequests: async (workId) => requiredPullRequests[workId] ?? [],
    work: async (workId) => works.find(({ id }) => id === workId) ?? null,
  };
  return facts;
}

export function createRuleReader(rules: WorkAutomationRule[]) {
  const reader: WorkAutomationRuleReader = {
    activeRules: async (projectId, triggerKind) =>
      rules.filter(
        ({ definition, projectId: ruleProject }) =>
          ruleProject === projectId && definition.trigger.kind === triggerKind,
      ),
    find: async (ruleId) => rules.find(({ id }) => id === ruleId) ?? null,
  };
  return reader;
}

export function createSignalLog() {
  const signals: WorkAutomationSignal[] = [];
  return {
    signals,
    sink: {
      // biome-ignore lint/suspicious/useAwait: the sink double records synchronously.
      publish: async (signal: WorkAutomationSignal) => {
        signals.push(signal);
      },
    },
  };
}

interface StoredReceipt {
  after: Map<string, string>;
  before: Map<string, string>;
  receipt: WorkAutomationReceipt;
}

/** In-memory double of the atomic, idempotent Work writer. */
export function createMemoryWriter(
  works: WorkAutomationWorkSnapshot[],
  options: { failWith?: Error } = {},
) {
  const byKey = new Map<string, StoredReceipt>();
  const byId = new Map<string, StoredReceipt>();
  const created: Array<{ title: string; type: string }> = [];
  const closures = new Map<string, string>();
  let applyCalls = 0;
  let sequence = 0;

  function currentStatus(workId: string) {
    return works.find(({ id }) => id === workId)?.status ?? "";
  }

  const writer: WorkAutomationWriter = {
    // biome-ignore lint/suspicious/useAwait: the writer double is synchronous.
    apply: async (input: WorkAutomationApplyInput) => {
      applyCalls += 1;
      const replay = byKey.get(input.idempotencyKey);
      if (replay) {
        return replay.receipt;
      }
      if (options.failWith) {
        throw options.failWith;
      }
      sequence += 1;
      const before = new Map<string, string>();
      const after = new Map<string, string>();
      for (const change of input.changes) {
        if (change.kind === "create-work") {
          created.push({ title: change.title, type: change.type });
          continue;
        }
        const target = works.find(({ id }) => id === change.workId);
        if (target) {
          before.set(change.workId, target.status);
          target.status = change.value.status;
          if ("closureResult" in change.value) {
            closures.set(change.workId, change.value.closureResult);
          }
          after.set(change.workId, change.value.status);
        }
      }
      const receipt: WorkAutomationReceipt = {
        appliedAt: input.appliedAt,
        changes: input.changes,
        id: `receipt-${sequence}`,
        undoUntil: input.undoUntil,
      };
      const stored = { after, before, receipt };
      byKey.set(input.idempotencyKey, stored);
      byId.set(receipt.id, stored);
      return receipt;
    },
    // biome-ignore lint/suspicious/useAwait: the writer double is synchronous.
    undo: async (receiptId): Promise<WorkAutomationUndoResult> => {
      const stored = byId.get(receiptId);
      if (!stored) {
        return { status: "not-found" };
      }
      if (
        stored.receipt.changes.some(
          (change: WorkAutomationChange) => change.kind === "create-work",
        )
      ) {
        return { status: "not-undoable" };
      }
      const clobbered = [...stored.after].filter(
        ([workId, value]) => currentStatus(workId) !== value,
      );
      if (clobbered.length > 0) {
        return {
          fields: clobbered.map(([workId]) => `${workId}:status`),
          status: "conflict",
        };
      }
      for (const [workId, value] of stored.before) {
        const target = works.find(({ id }) => id === workId);
        if (target) {
          target.status = value;
        }
      }
      return { status: "undone" };
    },
  };

  return {
    applyCalls: () => applyCalls,
    closures,
    created,
    writer,
  };
}

export function statusOf(works: WorkAutomationWorkSnapshot[], workId: string) {
  return works.find(({ id }) => id === workId)?.status;
}

export function setStatus(
  works: WorkAutomationWorkSnapshot[],
  workId: string,
  status: string,
) {
  for (const entry of works) {
    if (entry.id === workId) {
      entry.status = status;
    }
  }
}

export function createPrMergeRule(
  overrides: Partial<WorkAutomationRule> = {},
): WorkAutomationRule {
  return createRule({
    actions: [{ kind: "complete-work" }],
    id: "pr-merge",
    name: WORK_AUTOMATION_UI_LABELS.requiredPrMerge,
    trigger: { kind: "required-prs-merged" },
    ...overrides,
  });
}
