import {
  fingerprintMutationPayload,
  type MutationUndoMetadata,
  mutationUndoMetadataSchema,
} from "@cantiara/api/mutation-and-undo";
import {
  type CreateWorkAutomationRuleInput,
  createWorkAutomationRuleInputSchema,
  type UpdateWorkAutomationRuleInput,
  updateWorkAutomationRuleInputSchema,
  WORK_AUTOMATION_REQUIRED_PR_MERGE_DEFINITION,
  WORK_AUTOMATION_UI_LABELS,
  type WorkAutomationAccess,
  type WorkAutomationChange,
  type WorkAutomationReceipt,
  type WorkAutomationRule,
  type WorkAutomationRuleVersion,
  type WorkAutomationSignal,
  type WorkAutomationUndoResult,
  workAutomationChangeSchema,
  workAutomationDefinitionSchema,
} from "@cantiara/api/work-automation";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { mutationHistory } from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { work } from "@cantiara/db/schema/work";
import {
  workAutomationApplication,
  workAutomationRule,
  workAutomationRuleVersion,
  workAutomationSignal,
} from "@cantiara/db/schema/work-automation";
import { and, asc, desc, eq, isNull } from "drizzle-orm";

import {
  createWorkAutomation,
  type WorkAutomationApplyInput,
  type WorkAutomationFacts,
  type WorkAutomationRuleReader,
  type WorkAutomationSignalSink,
  type WorkAutomationWriter,
} from "./work-automation";

type WorkDatabaseRecord = typeof work.$inferSelect;

/** The `mutation_history` payload shape the Work lifecycle writes. */
interface WorkHistoryValue {
  work: unknown;
}

/** The `mutation_history` undo value scope `work.status` carries. */
function workStatusUndoMetadata(beforeStatus: string, afterStatus: string) {
  return mutationUndoMetadataSchema.parse({
    after: afterStatus,
    before: beforeStatus,
    kind: "atomic-transform",
    scope: "work.status",
  });
}

/** The snapshot fallback for unwired test doubles: the row JSON with instants. */
function snapshotWorkRow(record: WorkDatabaseRecord) {
  return {
    ...record,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    nextConcreteStepUpdatedAt:
      record.nextConcreteStepUpdatedAt?.toISOString() ?? null,
    statusChangedAt: record.statusChangedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class WorkAutomationProjectNotFoundError extends Error {
  readonly code = "WORK_AUTOMATION_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "WorkAutomationProjectNotFoundError";
  }
}

export class WorkAutomationRuleNameConflictError extends Error {
  readonly code = "WORK_AUTOMATION_RULE_NAME_CONFLICT" as const;

  constructor(name: string, options?: { cause?: unknown }) {
    super(
      `An Automation rule named ${name} already exists in this Project.`,
      options,
    );
    this.name = "WorkAutomationRuleNameConflictError";
  }
}

export class WorkAutomationStaleRevisionError extends Error {
  readonly code = "WORK_AUTOMATION_STALE_REVISION" as const;

  constructor() {
    super("Automation rule changed after this command started.");
    this.name = "WorkAutomationStaleRevisionError";
  }
}

export interface WorkAutomationWorkCreation {
  committedAt: Date;
  idempotencyKey: string;
  payloadFingerprint: string;
  /** The owning Project row the caller holds locked FOR UPDATE. */
  project: typeof project.$inferSelect;
  title: string;
  type: string;
  workId: string;
}

/** Mints one independent Work inside the caller's transaction; idempotent by key. */
export type WorkAutomationWorkCreator = (
  transaction: Executor,
  input: WorkAutomationWorkCreation,
) => Promise<void>;

/** Maps a Work row to the history value the Work lifecycle writes. */
export type WorkAutomationProfileSnapshotter = (
  record: WorkDatabaseRecord,
) => unknown;

export interface DatabaseWorkAutomationOptions {
  /**
   * The repeating-Work boundary, wired from the service wiring; a create-only
   * rule without it fails closed (unavailable) instead of writing nothing.
   */
  createWork?: WorkAutomationWorkCreator;
  now?: () => Date;
  /**
   * Read-only `Required for completion` PR merge facts from GitHub Integration
   * (spec 61). Until that seam ships the default reports none, so the prepared
   * PR-merge rule never matches.
   */
  requiredPullRequests?: WorkAutomationFacts["requiredPullRequests"];
  /** Wired from the service wiring to reuse the Work lifecycle snapshot shape. */
  workHistoryProfile?: WorkAutomationProfileSnapshotter;
}

function isUniqueViolation(error: unknown) {
  let current: unknown = error;
  while (current instanceof Error) {
    const { cause, code } = current as Error & {
      cause?: unknown;
      code?: unknown;
    };
    if (code === "23505") {
      return true;
    }
    current = cause;
  }
  return false;
}

function nameKey(name: string) {
  return name.trim().toLocaleLowerCase("en-US");
}

function toRule(row: typeof workAutomationRule.$inferSelect) {
  return {
    createdAt: row.createdAt.toISOString(),
    definition: workAutomationDefinitionSchema.parse(row.definition),
    enabled: row.enabled,
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    revision: row.revision,
    trashedAt: row.trashedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  } satisfies WorkAutomationRule;
}

function toReceipt(row: typeof workAutomationApplication.$inferSelect) {
  return {
    appliedAt: row.appliedAt.toISOString(),
    changes: row.changes.map((change) =>
      workAutomationChangeSchema.parse(change),
    ),
    id: row.id,
    undoUntil: row.undoUntil.toISOString(),
  } satisfies WorkAutomationReceipt;
}

interface PreviousWorkValue {
  automationHistoryId?: string;
  closureReason?: string | null;
  closureResult?: string | null;
  status: string;
  statusChangedAt: string;
}

type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0];
type StatusChange = Extract<WorkAutomationChange, { kind: "set-work-field" }>;
type UndoPlan = Awaited<ReturnType<typeof planUndo>>;

interface UndoRestore {
  beforeWork: WorkDatabaseRecord;
  revision: number;
  value: PreviousWorkValue;
  workId: string;
}

async function findApplication(
  executor: Pick<Executor, "select">,
  projectId: string,
  idempotencyKey: string,
) {
  const [row] = await executor
    .select()
    .from(workAutomationApplication)
    .where(
      and(
        eq(workAutomationApplication.projectId, projectId),
        eq(workAutomationApplication.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Applies one status change and writes the matching `mutation_history` row in
 * the same transaction, so the Work's normal history explains the change with
 * the `System automation` actor and points back to the automation application
 * (`sourceId`) and the original trigger event (`deliveryId`).
 */
async function applyStatusChange(
  transaction: Executor,
  applicationId: string,
  projectId: string,
  change: StatusChange,
  committedAt: Date,
  profile: WorkAutomationProfileSnapshotter,
): Promise<PreviousWorkValue> {
  const [row] = await transaction
    .select()
    .from(work)
    .where(
      and(
        eq(work.id, change.workId),
        eq(work.projectId, projectId),
        isNull(work.trashedAt),
      ),
    )
    .for("update")
    .limit(1);
  if (!row) {
    throw new Error("The target Work no longer exists.");
  }
  if (row.status === "Closed") {
    throw new Error("The target Work is already closed.");
  }
  await transaction
    .update(work)
    .set({
      ...("closureResult" in change.value
        ? { closureReason: null, closureResult: change.value.closureResult }
        : {}),
      revision: row.revision + 1,
      status: change.value.status,
      statusChangedAt:
        row.status === change.value.status ? row.statusChangedAt : committedAt,
      updatedAt: committedAt,
    })
    .where(eq(work.id, row.id));
  const [after] = await transaction
    .select()
    .from(work)
    .where(eq(work.id, row.id))
    .limit(1);
  if (!after) {
    throw new Error("The target Work could not be re-read.");
  }
  const beforeValue: WorkHistoryValue = { work: profile(row) };
  const afterValue: WorkHistoryValue = { work: profile(after) };
  const deliveryId = change.attributions[0]?.triggerEventId ?? "";
  const historyId = await insertAutomationHistoryRow(transaction, {
    applicationId,
    committedAt,
    deliveryId,
    nextValue: afterValue,
    previousValue: beforeValue,
    revision: after.revision,
    targetId: after.id,
    undo: workStatusUndoMetadata(row.status, after.status),
  });
  return {
    automationHistoryId: historyId,
    closureReason: row.closureReason,
    closureResult: row.closureResult,
    status: row.status,
    statusChangedAt: row.statusChangedAt.toISOString(),
  };
}

async function planUndo(
  transaction: Executor,
  change: StatusChange,
  before: PreviousWorkValue | undefined,
): Promise<{
  beforeWork: WorkDatabaseRecord | null;
  clobbered: string | null;
  restore: UndoRestore | null;
}> {
  const [row] = await transaction
    .select()
    .from(work)
    .where(eq(work.id, change.workId))
    .for("update")
    .limit(1);
  if (!(row && before)) {
    return { beforeWork: null, clobbered: null, restore: null };
  }
  if (row.status !== change.value.status) {
    return {
      beforeWork: row,
      clobbered: `${change.workId}:status`,
      restore: null,
    };
  }
  if (
    "closureResult" in change.value &&
    row.closureResult !== change.value.closureResult
  ) {
    return {
      beforeWork: row,
      clobbered: `${change.workId}:closureResult`,
      restore: null,
    };
  }
  return {
    beforeWork: row,
    clobbered: null,
    restore: {
      beforeWork: row,
      revision: row.revision,
      value: before,
      workId: row.id,
    },
  };
}

/**
 * The `mutation_history` rows the automation writes explain the change on the
 * Work's normal history (PRD 06): the `System automation` actor, the source
 * (`sourceId`: the automation application) and the delivery (`deliveryId`: the
 * original trigger event) let every history reader resolve the rule,
 * definition version, trigger, conditions and action from the application row.
 */
async function insertAutomationHistoryRow(
  transaction: Executor,
  row: {
    applicationId: string;
    committedAt: Date;
    deliveryId: string;
    nextValue: WorkHistoryValue;
    previousValue: WorkHistoryValue;
    revision: number;
    targetId: string;
    undo?: MutationUndoMetadata;
    undoOf?: string | null;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  await transaction.insert(mutationHistory).values({
    actorId: "work-automation",
    actorType: "System automation",
    deliveryId: row.deliveryId,
    id,
    nextValue: row.nextValue,
    occurredAt: row.committedAt,
    ...(row.undo ? { undo: row.undo } : {}),
    ...(row.undoOf ? { undoOf: row.undoOf } : {}),
    originKind: "source",
    payloadFingerprint: await fingerprintMutationPayload({
      kind: "work-automation-history",
      revision: row.revision,
      targetId: row.targetId,
      triggerEventId: row.deliveryId,
    }),
    previousValue: row.previousValue,
    revision: row.revision,
    sourceId: row.applicationId,
    targetId: row.targetId,
  });
  return id;
}

/**
 * Restores each unclobbered Work once the receipt undo commits. Only the
 * fields the automation wrote are reverted; unrelated later edits are kept.
 */
async function restoreWorkStatuses(
  transaction: Executor,
  plans: UndoPlan[],
  undoneAt: Date,
) {
  for (const { restore } of plans) {
    if (!restore) {
      continue;
    }
    // biome-ignore lint/performance/noAwaitInLoops: rows lock in receipt order inside one transaction.
    await transaction
      .update(work)
      .set({
        closureReason: restore.value.closureReason ?? null,
        closureResult: restore.value.closureResult ?? null,
        revision: restore.revision + 1,
        status: restore.value.status,
        statusChangedAt: new Date(restore.value.statusChangedAt),
        updatedAt: undoneAt,
      })
      .where(eq(work.id, restore.workId));
  }
}

async function writeUndoHistoryRows(
  transaction: Executor,
  applicationId: string,
  statusChanges: StatusChange[],
  plans: UndoPlan[],
  undoneAt: Date,
  profile: WorkAutomationProfileSnapshotter,
) {
  for (const [index, plan] of plans.entries()) {
    if (!plan.restore) {
      continue;
    }
    const change = statusChanges[index];
    // biome-ignore lint/performance/noAwaitInLoops: rows read back in receipt order inside one transaction.
    const [after] = await transaction
      .select()
      .from(work)
      .where(eq(work.id, plan.restore.workId))
      .limit(1);
    if (!(change && after)) {
      continue;
    }
    await insertAutomationHistoryRow(transaction, {
      applicationId,
      committedAt: undoneAt,
      deliveryId: change.attributions[0]?.triggerEventId ?? "",
      nextValue: { work: profile(after) },
      previousValue: { work: profile(plan.restore.beforeWork) },
      revision: after.revision,
      targetId: after.id,
      undo: workStatusUndoMetadata(
        plan.restore.beforeWork.status,
        after.status,
      ),
      undoOf: plan.restore.value.automationHistoryId ?? null,
    });
  }
}

function createWriter(
  database: Database,
  options: DatabaseWorkAutomationOptions,
): WorkAutomationWriter {
  const now = options.now ?? (() => new Date());
  const profile: WorkAutomationProfileSnapshotter =
    options.workHistoryProfile ?? snapshotWorkRow;

  /**
   * Creates the repeating Work of one `create-work` change inside the same
   * transaction as the application row: each Work is one independent record
   * and the whole application is atomic, so a failed commit leaves neither.
   * The schema keeps schedule actions create-only, so a batch never mixes
   * creation with status changes.
   */
  async function createRepeatingWork(
    transaction: Executor,
    applicationId: string,
    projection: WorkAutomationApplyInput,
    change: Extract<WorkAutomationChange, { kind: "create-work" }>,
    createIndex: number,
    committedAt: Date,
  ) {
    const idempotencyKey = `${projection.idempotencyKey}:${createIndex}`;
    const [projectRow] = await transaction
      .select()
      .from(project)
      .where(eq(project.id, projection.projectId))
      .for("update")
      .limit(1);
    if (!projectRow) {
      throw new Error("The owning Project is unavailable.");
    }
    if (projectRow.archivedAt) {
      throw new Error("The Project is archived.");
    }
    if (!options.createWork) {
      throw new Error("Create repeating Work is unavailable.");
    }
    const workId = crypto.randomUUID();
    await options.createWork(transaction, {
      committedAt,
      idempotencyKey,
      project: projectRow,
      payloadFingerprint: await fingerprintMutationPayload({
        change,
        idempotencyKey,
      }),
      title: change.title,
      type: change.type,
      workId,
    });
    const [created] = await transaction
      .select()
      .from(work)
      .where(eq(work.id, workId))
      .limit(1);
    if (!created) {
      throw new Error("Repeating Work could not be read back.");
    }
    await insertAutomationHistoryRow(transaction, {
      applicationId,
      committedAt,
      deliveryId: change.attributions[0]?.triggerEventId ?? "",
      nextValue: { work: profile(created) },
      previousValue: { work: null },
      revision: created.revision,
      targetId: workId,
    });
  }

  async function commit(
    transaction: Executor,
    input: WorkAutomationApplyInput,
  ) {
    const [inserted] = await transaction
      .insert(workAutomationApplication)
      .values({
        appliedAt: new Date(input.appliedAt),
        changes: input.changes,
        id: crypto.randomUUID(),
        idempotencyKey: input.idempotencyKey,
        previousValues: {},
        projectId: input.projectId,
        undoUntil: new Date(input.undoUntil),
      })
      .onConflictDoNothing()
      .returning();
    if (!inserted) {
      const winner = await findApplication(
        transaction,
        input.projectId,
        input.idempotencyKey,
      );
      if (!winner) {
        throw new Error("Automation application could not be recorded.");
      }
      return toReceipt(winner);
    }

    const previous: Record<string, PreviousWorkValue> = {};
    const committedAt = now();
    let createIndex = 0;
    for (const change of input.changes) {
      if (change.kind !== "create-work") {
        continue;
      }
      // biome-ignore lint/performance/noAwaitInLoops: keep creation order stable; each Work is one independent record.
      await createRepeatingWork(
        transaction,
        inserted.id,
        input,
        change,
        createIndex,
        committedAt,
      );
      createIndex += 1;
    }
    for (const change of input.changes) {
      if (change.kind !== "set-work-field") {
        continue;
      }
      // biome-ignore lint/performance/noAwaitInLoops: rows lock in order inside one atomic mutation.
      previous[change.workId] = await applyStatusChange(
        transaction,
        inserted.id,
        input.projectId,
        change,
        committedAt,
        profile,
      );
    }
    await transaction
      .update(workAutomationApplication)
      .set({ previousValues: previous })
      .where(eq(workAutomationApplication.id, inserted.id));
    return toReceipt(inserted);
  }

  async function undoInTransaction(
    transaction: Executor,
    receiptId: string,
  ): Promise<WorkAutomationUndoResult> {
    const [application] = await transaction
      .select()
      .from(workAutomationApplication)
      .where(eq(workAutomationApplication.id, receiptId))
      .for("update")
      .limit(1);
    if (!application) {
      return { status: "not-found" };
    }
    const { changes } = toReceipt(application);
    const statusChanges = changes.filter(
      (change): change is StatusChange => change.kind === "set-work-field",
    );
    if (application.undoneAt || statusChanges.length !== changes.length) {
      return { status: "not-undoable" };
    }
    if (now().getTime() > application.undoUntil.getTime()) {
      // The receipt itself only owns the 10-second toast window; later undo
      // lives on each record's own history.
      return { status: "not-undoable" };
    }
    const previous = application.previousValues as Record<
      string,
      PreviousWorkValue
    >;
    const plans = await Promise.all(
      statusChanges.map((change) =>
        planUndo(transaction, change, previous[change.workId]),
      ),
    );
    const clobbered = plans.flatMap(({ clobbered: field }) =>
      field ? [field] : [],
    );
    if (clobbered.length > 0) {
      return { fields: clobbered, status: "conflict" };
    }
    const undoneAt = now();
    await restoreWorkStatuses(transaction, plans, undoneAt);
    await writeUndoHistoryRows(
      transaction,
      application.id,
      statusChanges,
      plans,
      undoneAt,
      profile,
    );
    await transaction
      .update(workAutomationApplication)
      .set({ undoneAt })
      .where(eq(workAutomationApplication.id, receiptId));
    return { status: "undone" };
  }

  return {
    async apply(input) {
      const replayed = await findApplication(
        database,
        input.projectId,
        input.idempotencyKey,
      );
      if (replayed) {
        return toReceipt(replayed);
      }
      return await database.transaction((transaction) =>
        commit(transaction, input),
      );
    },

    undo(receiptId) {
      return database.transaction((transaction) =>
        undoInTransaction(transaction, receiptId),
      );
    },
  };
}

function createFacts(
  database: Database,
  pullRequestFacts: WorkAutomationFacts["requiredPullRequests"],
): WorkAutomationFacts {
  const columns = {
    id: work.id,
    projectId: work.projectId,
    status: work.status,
    type: work.type,
  };
  return {
    async listWorks(projectId) {
      return await database
        .select(columns)
        .from(work)
        .where(and(eq(work.projectId, projectId), isNull(work.trashedAt)))
        .orderBy(asc(work.number));
    },
    requiredPullRequests: pullRequestFacts,
    async work(workId) {
      const [row] = await database
        .select(columns)
        .from(work)
        .where(and(eq(work.id, workId), isNull(work.trashedAt)))
        .limit(1);
      return row ?? null;
    },
  };
}

function createSignalSink(database: Database): WorkAutomationSignalSink {
  return {
    async publish(signal: WorkAutomationSignal) {
      await database.insert(workAutomationSignal).values({
        failedStep: signal.failedStep,
        id: crypto.randomUUID(),
        kind: signal.kind,
        occurredAt: new Date(signal.occurredAt),
        projectId: signal.projectId,
        reason: signal.reason,
        ruleId: signal.ruleId,
        ruleName: signal.ruleName,
        ruleVersion: signal.ruleVersion,
        trigger: signal.trigger,
        triggerEventId: signal.triggerEventId,
      });
    },
  };
}

function createRuleReader(database: Database): WorkAutomationRuleReader {
  return {
    async activeRules(projectId, triggerKind) {
      const rows = await database
        .select()
        .from(workAutomationRule)
        .where(
          and(
            eq(workAutomationRule.projectId, projectId),
            eq(workAutomationRule.enabled, true),
            isNull(workAutomationRule.trashedAt),
          ),
        )
        .orderBy(asc(workAutomationRule.createdAt));
      return rows
        .map(toRule)
        .filter(({ definition }) => definition.trigger.kind === triggerKind);
    },
    async find(ruleId) {
      const [row] = await database
        .select()
        .from(workAutomationRule)
        .where(eq(workAutomationRule.id, ruleId))
        .limit(1);
      return row ? toRule(row) : null;
    },
  };
}

export interface DatabaseWorkAutomation {
  access: WorkAutomationAccess;
  engine: ReturnType<typeof createWorkAutomation>;
}

export function createDatabaseWorkAutomation(
  database: Database,
  options: DatabaseWorkAutomationOptions = {},
): DatabaseWorkAutomation {
  const now = options.now ?? (() => new Date());
  const reader = createRuleReader(database);
  const engine = createWorkAutomation({
    facts: createFacts(
      database,
      options.requiredPullRequests ?? (() => Promise.resolve([])),
    ),
    now,
    rules: reader,
    signals: createSignalSink(database),
    writer: createWriter(database, options),
  });

  async function ownedProject(accountId: string, projectId: string) {
    const [row] = await database
      .select({ id: project.id })
      .from(project)
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
      )
      .limit(1);
    return row ?? null;
  }

  async function ownedRule(accountId: string, ruleId: string) {
    const [row] = await database
      .select({ rule: workAutomationRule })
      .from(workAutomationRule)
      .innerJoin(project, eq(workAutomationRule.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(
          eq(workAutomationRule.id, ruleId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    return row?.rule ?? null;
  }

  async function changeRule(
    accountId: string,
    ruleId: string,
    baseRevision: number,
    build: (current: typeof workAutomationRule.$inferSelect) => {
      set: Partial<typeof workAutomationRule.$inferInsert>;
      version?: { definition: unknown; name: string; version: number };
    },
  ) {
    const current = await ownedRule(accountId, ruleId);
    if (!current || current.trashedAt) {
      return null;
    }
    if (current.revision !== baseRevision) {
      throw new WorkAutomationStaleRevisionError();
    }
    const { set, version } = build(current);
    try {
      return await database.transaction(async (transaction) => {
        const [updated] = await transaction
          .update(workAutomationRule)
          .set({ ...set, revision: current.revision + 1 })
          .where(
            and(
              eq(workAutomationRule.id, ruleId),
              eq(workAutomationRule.revision, baseRevision),
            ),
          )
          .returning();
        if (!updated) {
          throw new WorkAutomationStaleRevisionError();
        }
        if (version) {
          await transaction.insert(workAutomationRuleVersion).values({
            ...version,
            ruleId,
            savedAt: now(),
          });
        }
        return toRule(updated);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new WorkAutomationRuleNameConflictError(
          typeof set.name === "string" ? set.name : current.name,
          { cause: error },
        );
      }
      throw error;
    }
  }

  const access: WorkAutomationAccess = {
    async create(accountId, rawInput: CreateWorkAutomationRuleInput) {
      const input = createWorkAutomationRuleInputSchema.parse(rawInput);
      if (!(await ownedProject(accountId, input.projectId))) {
        throw new WorkAutomationProjectNotFoundError(input.projectId);
      }
      const id = crypto.randomUUID();
      try {
        return await database.transaction(async (transaction) => {
          const [created] = await transaction
            .insert(workAutomationRule)
            .values({
              definition: input.definition,
              enabled: false,
              id,
              name: input.name,
              nameKey: nameKey(input.name),
              projectId: input.projectId,
            })
            .returning();
          if (!created) {
            throw new Error("Automation rule could not be created.");
          }
          await transaction.insert(workAutomationRuleVersion).values({
            definition: input.definition,
            name: input.name,
            ruleId: id,
            savedAt: now(),
            version: 1,
          });
          return toRule(created);
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new WorkAutomationRuleNameConflictError(input.name, {
            cause: error,
          });
        }
        throw error;
      }
    },

    createRequiredPrMergeRule(accountId, projectId) {
      return access.create(accountId, {
        definition: WORK_AUTOMATION_REQUIRED_PR_MERGE_DEFINITION,
        name: WORK_AUTOMATION_UI_LABELS.requiredPrMerge,
        projectId,
      });
    },

    async dryRun(accountId, ruleId) {
      if (!(await ownedRule(accountId, ruleId))) {
        return null;
      }
      return await engine.dryRun(ruleId);
    },

    async list(accountId, projectId) {
      if (!(await ownedProject(accountId, projectId))) {
        return null;
      }
      const rows = await database
        .select()
        .from(workAutomationRule)
        .where(
          and(
            eq(workAutomationRule.projectId, projectId),
            isNull(workAutomationRule.trashedAt),
          ),
        )
        .orderBy(asc(workAutomationRule.createdAt));
      return rows.map(toRule);
    },

    async restoreVersion(accountId, { baseRevision, ruleId, version }) {
      const [target] = await database
        .select()
        .from(workAutomationRuleVersion)
        .where(
          and(
            eq(workAutomationRuleVersion.ruleId, ruleId),
            eq(workAutomationRuleVersion.version, version),
          ),
        )
        .limit(1);
      if (!target) {
        return null;
      }
      return await changeRule(accountId, ruleId, baseRevision, (current) => {
        const nextVersion = current.version + 1;
        return {
          set: {
            definition: target.definition,
            name: target.name,
            nameKey: nameKey(target.name),
            version: nextVersion,
          },
          version: {
            definition: target.definition,
            name: target.name,
            version: nextVersion,
          },
        };
      });
    },

    async setEnabled(accountId, { baseRevision, enabled, ruleId }) {
      return await changeRule(accountId, ruleId, baseRevision, () => ({
        set: { enabled },
      }));
    },

    async trash(accountId, ruleId, baseRevision) {
      return await changeRule(accountId, ruleId, baseRevision, () => ({
        set: { enabled: false, trashedAt: now() },
      }));
    },

    async undo(accountId, receiptId) {
      const [owned] = await database
        .select({ id: workAutomationApplication.id })
        .from(workAutomationApplication)
        .innerJoin(project, eq(workAutomationApplication.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(workAutomationApplication.id, receiptId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!owned) {
        return { status: "not-found" };
      }
      return await engine.undo(receiptId);
    },

    async update(
      accountId,
      ruleId,
      baseRevision,
      rawInput: UpdateWorkAutomationRuleInput,
    ) {
      const input = updateWorkAutomationRuleInputSchema.parse(rawInput);
      return await changeRule(accountId, ruleId, baseRevision, (current) => {
        const nextVersion = current.version + 1;
        return {
          set: {
            definition: input.definition,
            name: input.name,
            nameKey: nameKey(input.name),
            version: nextVersion,
          },
          version: {
            definition: input.definition,
            name: input.name,
            version: nextVersion,
          },
        };
      });
    },

    async versions(accountId, ruleId) {
      if (!(await ownedRule(accountId, ruleId))) {
        return null;
      }
      const rows = await database
        .select()
        .from(workAutomationRuleVersion)
        .where(eq(workAutomationRuleVersion.ruleId, ruleId))
        .orderBy(desc(workAutomationRuleVersion.version));
      return rows.map(
        (row): WorkAutomationRuleVersion => ({
          definition: workAutomationDefinitionSchema.parse(row.definition),
          name: row.name,
          ruleId: row.ruleId,
          savedAt: row.savedAt.toISOString(),
          version: row.version,
        }),
      );
    },
  };

  return { access, engine };
}
