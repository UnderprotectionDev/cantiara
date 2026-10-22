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
import type {
  WorkLifecycleAccess,
  WorkType,
} from "@cantiara/api/work-lifecycle";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
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
  idempotencyKey: string;
  projectId: string;
  title: string;
  type: string;
}

export interface DatabaseWorkAutomationOptions {
  /** Mints one independent Work through the Work lifecycle; idempotent by key. */
  createWork?: (input: WorkAutomationWorkCreation) => Promise<void>;
  now?: () => Date;
  /**
   * Read-only `Required for completion` PR merge facts from GitHub Integration
   * (spec 61). Until that seam ships the default reports none, so the prepared
   * PR-merge rule never matches.
   */
  requiredPullRequests?: WorkAutomationFacts["requiredPullRequests"];
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
  closureReason?: string | null;
  closureResult?: string | null;
  status: string;
  statusChangedAt: string;
}

type Executor = Parameters<Parameters<Database["transaction"]>[0]>[0];
type StatusChange = Extract<WorkAutomationChange, { kind: "set-work-field" }>;

interface UndoRestore {
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

async function applyStatusChange(
  transaction: Executor,
  projectId: string,
  change: StatusChange,
  committedAt: Date,
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
  return {
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
): Promise<{ clobbered: string | null; restore: UndoRestore | null }> {
  const [row] = await transaction
    .select()
    .from(work)
    .where(eq(work.id, change.workId))
    .for("update")
    .limit(1);
  if (!(row && before)) {
    return { clobbered: null, restore: null };
  }
  if (row.status !== change.value.status) {
    return { clobbered: `${change.workId}:status`, restore: null };
  }
  if (
    "closureResult" in change.value &&
    row.closureResult !== change.value.closureResult
  ) {
    return { clobbered: `${change.workId}:closureResult`, restore: null };
  }
  return {
    clobbered: null,
    restore: { revision: row.revision, value: before, workId: row.id },
  };
}

function createWriter(
  database: Database,
  options: DatabaseWorkAutomationOptions,
): WorkAutomationWriter {
  const now = options.now ?? (() => new Date());

  async function createIndependentWork(input: WorkAutomationApplyInput) {
    let index = 0;
    for (const change of input.changes) {
      if (change.kind !== "create-work") {
        continue;
      }
      if (!options.createWork) {
        throw new Error("Create repeating Work is unavailable.");
      }
      // biome-ignore lint/performance/noAwaitInLoops: keep creation order stable; each call is idempotent by key.
      await options.createWork({
        idempotencyKey: `${input.idempotencyKey}:${index}`,
        projectId: input.projectId,
        title: change.title,
        type: change.type,
      });
      index += 1;
    }
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
    for (const change of input.changes) {
      if (change.kind === "set-work-field") {
        // biome-ignore lint/performance/noAwaitInLoops: rows lock in order inside one atomic mutation.
        previous[change.workId] = await applyStatusChange(
          transaction,
          input.projectId,
          change,
          committedAt,
        );
      }
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
    await Promise.all(
      plans.flatMap(({ restore }) =>
        restore
          ? [
              transaction
                .update(work)
                .set({
                  closureReason: restore.value.closureReason ?? null,
                  closureResult: restore.value.closureResult ?? null,
                  revision: restore.revision + 1,
                  status: restore.value.status,
                  statusChangedAt: new Date(restore.value.statusChangedAt),
                  updatedAt: undoneAt,
                })
                .where(eq(work.id, restore.workId)),
            ]
          : [],
      ),
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
      await createIndependentWork(input);
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

/** Creation port backed by the Work lifecycle, acting for the Project owner. */
export function createWorkAutomationWorkCreation(
  database: Database,
  lifecycle: Pick<WorkLifecycleAccess, "create">,
): NonNullable<DatabaseWorkAutomationOptions["createWork"]> {
  return async ({ idempotencyKey, projectId, title, type }) => {
    const [owner] = await database
      .select({ accountId: workspace.ownerAccountId })
      .from(project)
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(eq(project.id, projectId))
      .limit(1);
    if (!owner) {
      throw new WorkAutomationProjectNotFoundError(projectId);
    }
    await lifecycle.create(owner.accountId, {
      baseRevision: 0,
      clientIdempotencyKey: idempotencyKey,
      projectId,
      title,
      type: type as WorkType,
    });
  };
}
