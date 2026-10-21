import type { MutationPayload } from "@cantiara/api/mutation-and-undo";
import {
  buildUserFlowConvertPlan,
  isSameUserFlowPlan,
  type ParsedConvertUserFlowNodeInput,
  type RecordLookup,
  type RecordLookupKind,
  recordLookupKey,
  type ScreenLookup,
  type UserFlowAccess,
  type UserFlowBindRecord,
  type UserFlowRecord,
  type UserFlowStore,
  type UserFlowTemplateView,
} from "@cantiara/api/user-flow";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { risk } from "@cantiara/db/schema/risk";
import { screen } from "@cantiara/db/schema/screen";
import {
  userFlow,
  userFlowRecordBind,
  userFlowRecordBindRebind,
  userFlowTemplate,
  userFlowVersion,
  userFlowViewport,
} from "@cantiara/db/schema/user-flow";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";

import { insertConvertedRecord } from "../../evidence/server/evidence-record-creation";
import {
  MutationApplyFailedError,
  MutationConflictError,
  MutationStaleBaseRevisionError,
  MutationTargetNotFoundError,
} from "../../mutation-and-undo/server/mutation-contract";
import {
  createDatabaseMutationContract,
  type MutationDatabaseTargetAdapter,
} from "../../mutation-and-undo/server/mutation-contract-database";
import {
  createUserFlow,
  UserFlowConversionStaleError,
  UserFlowProjectReadOnlyError,
  UserFlowRebindStaleError,
  UserFlowVersionConflictError,
} from "./user-flow";

type Executor = Pick<Database, "insert" | "select" | "update">;

type BindRow = typeof userFlowRecordBind.$inferSelect;

function toBind(row: BindRow): UserFlowBindRecord {
  return {
    boundVersion: row.boundVersion,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    nodeId: row.nodeId,
    originVersion: row.originVersion,
    recordId: row.recordId,
    recordType: row.recordType as UserFlowBindRecord["recordType"],
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
    userFlowId: row.userFlowId,
  };
}

function toTemplate(
  row: typeof userFlowTemplate.$inferSelect,
): UserFlowTemplateView {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    name: row.name,
    structure: row.structure,
  };
}

/** Locks the owned Project row and the User Flow row of one write. */
async function lockFlow(
  tx: Pick<Database, "select">,
  accountId: string,
  projectId: string,
  userFlowId: string,
) {
  const [owned] = await tx
    .select({
      archivedAt: project.archivedAt,
      id: project.id,
      name: project.name,
    })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .for("update", { of: project });
  if (!owned) {
    return null;
  }
  if (owned.archivedAt) {
    throw new UserFlowProjectReadOnlyError(owned.id);
  }
  const [flow] = await tx
    .select()
    .from(userFlow)
    .where(and(eq(userFlow.id, userFlowId), eq(userFlow.projectId, projectId)))
    .for("update");
  return flow ? { flow, projectName: owned.name } : null;
}

interface ConversionValue {
  bind: UserFlowBindRecord | null;
}

/**
 * Atomic `Convert and Bind`: exactly one Work, Decision, Risk or Open Question
 * (born through the shared conversion insert, so Work key allocation and Origin
 * Location columns behave as for every other conversion) plus its bind commit
 * together through the Mutation Contract; a retry with the same key returns the
 * same record. The flow rows and `screen` are never written.
 */
async function convertNodeInDatabase(
  database: Database,
  accountId: string,
  input: ParsedConvertUserFlowNodeInput,
): Promise<UserFlowBindRecord | null> {
  const { plan } = input;
  const adapter: MutationDatabaseTargetAdapter<ConversionValue> = {
    async find(executor, id) {
      const [row] = await executor
        .select()
        .from(userFlowRecordBind)
        .where(eq(userFlowRecordBind.id, id));
      if (row && row.userFlowId !== input.userFlowId) {
        return null;
      }
      return {
        id,
        revision: row?.revision ?? 0,
        value: { bind: row ? toBind(row) : null },
      };
    },
    async update(executor, update) {
      const locked = await lockFlow(
        executor,
        accountId,
        input.projectId,
        input.userFlowId,
      );
      if (!locked) {
        throw new MutationTargetNotFoundError(input.userFlowId);
      }
      const [owner] = await executor
        .select()
        .from(project)
        .where(eq(project.id, input.projectId));
      const [current] = await readRecords(
        executor,
        accountId,
        eq(userFlow.id, input.userFlowId),
      );
      // The exact previewed plan, re-derived under the Project and flow locks.
      const derived =
        owner && current
          ? buildUserFlowConvertPlan(
              { projectName: locked.projectName, record: current },
              {
                nodeId: plan.nodeId,
                target: plan.record.type,
                workType: plan.record.workType ?? "Task",
              },
            )
          : null;
      if (!(owner && derived && isSameUserFlowPlan(plan, derived))) {
        throw new MutationConflictError(input.userFlowId);
      }
      await insertConvertedRecord(executor, owner, {
        body: plan.record.body,
        committedAt: update.committedAt,
        idempotencyKey: String(update.idempotencyKey.key),
        origin: {
          componentId: plan.originLocation.nodeId,
          ownerRecordId: plan.originLocation.userFlowId,
          sourceVersion: String(plan.originLocation.flowVersion),
        },
        payloadFingerprint: update.payloadFingerprint,
        recordId: input.recordId,
        title: plan.record.title,
        type: plan.record.type,
        workType: plan.record.workType,
      });
      await executor.insert(userFlowRecordBind).values({
        actorId: accountId,
        boundVersion: plan.originLocation.flowVersion,
        createdAt: update.committedAt,
        id: update.targetId,
        nodeId: plan.nodeId,
        originVersion: plan.originLocation.flowVersion,
        recordId: input.recordId,
        recordType: plan.record.type,
        revision: 1,
        updatedAt: update.committedAt,
        userFlowId: input.userFlowId,
      });
      return {
        id: update.targetId,
        revision: update.expectedRevision + 1,
        value: update.nextValue,
      };
    },
  };
  const mutation = createDatabaseMutationContract<ConversionValue>(database, {
    target: adapter,
  });
  try {
    const receipt = await mutation.mutate(
      {
        kind: "human",
        actor: { type: "User", actorId: accountId },
        targetId: input.id,
        baseRevision: input.baseRevision,
        clientIdempotencyKey: input.clientIdempotencyKey,
        payload: {
          operation: "convertUserFlowNode",
          ...input,
        } as MutationPayload,
      },
      ({ currentValue, committedAt }) => {
        if (currentValue.bind) {
          throw new MutationConflictError(input.id);
        }
        return {
          bind: {
            boundVersion: plan.originLocation.flowVersion,
            createdAt: committedAt,
            id: input.id,
            nodeId: plan.nodeId,
            originVersion: plan.originLocation.flowVersion,
            recordId: input.recordId,
            recordType: plan.record.type,
            revision: 1,
            updatedAt: committedAt,
            userFlowId: input.userFlowId,
          },
        };
      },
    );
    return receipt.nextValue.bind;
  } catch (error) {
    if (error instanceof MutationTargetNotFoundError) {
      return null;
    }
    throw rethrowConversionError(error, input.userFlowId);
  }
}

function rethrowConversionError(error: unknown, userFlowId: string): unknown {
  const cause = error instanceof MutationApplyFailedError ? error.cause : error;
  if (
    cause instanceof MutationConflictError ||
    cause instanceof MutationStaleBaseRevisionError
  ) {
    return new UserFlowConversionStaleError(userFlowId);
  }
  return cause instanceof UserFlowProjectReadOnlyError ? cause : error;
}

export interface RecordKindRow {
  archived: boolean;
  id: string;
  ownerAccountId: string;
  projectId: string;
  status: string | null;
  title: string;
  trashed: boolean;
}

export async function readRecordRows(
  database: Database,
  kind: RecordLookupKind,
  ids: string[],
): Promise<RecordKindRow[]> {
  switch (kind) {
    case "Work": {
      const rows = await database
        .select({
          archivedAt: work.archivedAt,
          id: work.id,
          ownerAccountId: workspace.ownerAccountId,
          projectId: work.projectId,
          status: work.status,
          title: work.title,
          trashedAt: work.trashedAt,
        })
        .from(work)
        .innerJoin(project, eq(project.id, work.projectId))
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(inArray(work.id, ids));
      return rows.map((row) => ({
        archived: row.archivedAt !== null,
        id: row.id,
        ownerAccountId: row.ownerAccountId,
        projectId: row.projectId,
        status: row.status,
        title: row.title,
        trashed: row.trashedAt !== null,
      }));
    }
    case "Decision": {
      const rows = await database
        .select({
          id: decision.id,
          ownerAccountId: workspace.ownerAccountId,
          projectId: decision.projectId,
          status: decision.life,
          title: decision.title,
        })
        .from(decision)
        .innerJoin(project, eq(project.id, decision.projectId))
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(inArray(decision.id, ids));
      return rows.map((row) => ({ ...row, archived: false, trashed: false }));
    }
    case "Risk": {
      const rows = await database
        .select({
          id: risk.id,
          ownerAccountId: workspace.ownerAccountId,
          projectId: risk.projectId,
          status: risk.life,
          title: risk.title,
        })
        .from(risk)
        .innerJoin(project, eq(project.id, risk.projectId))
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(inArray(risk.id, ids));
      return rows.map((row) => ({ ...row, archived: false, trashed: false }));
    }
    case "Open Question": {
      const rows = await database
        .select({
          id: openQuestion.id,
          ownerAccountId: workspace.ownerAccountId,
          projectId: openQuestion.projectId,
          status: openQuestion.life,
          title: openQuestion.title,
        })
        .from(openQuestion)
        .innerJoin(project, eq(project.id, openQuestion.projectId))
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(inArray(openQuestion.id, ids));
      return rows.map((row) => ({ ...row, archived: false, trashed: false }));
    }
    default:
      return [];
  }
}

async function findOwnedWorkspace(
  executor: Pick<Database, "select">,
  accountId: string,
  projectId: string,
) {
  const [owned] = await executor
    .select({ archivedAt: project.archivedAt, workspaceId: workspace.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  return owned ?? null;
}

async function findOwnedProject(
  executor: Executor,
  accountId: string,
  projectId: string,
) {
  const [owned] = await executor
    .select({ archivedAt: project.archivedAt, id: project.id })
    .from(project)
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    );
  return owned ?? null;
}

async function requireWritableProject(
  executor: Executor,
  accountId: string,
  projectId: string,
) {
  const owned = await findOwnedProject(executor, accountId, projectId);
  if (owned?.archivedAt) {
    throw new UserFlowProjectReadOnlyError(owned.id);
  }
  return owned;
}

function toRecord(
  row: typeof userFlow.$inferSelect,
  version: typeof userFlowVersion.$inferSelect,
): UserFlowRecord {
  return {
    createdAt: row.createdAt.toISOString(),
    document: version.document,
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    version: version.version,
  };
}

async function readRecords(
  executor: Executor,
  accountId: string,
  where: SQL | undefined,
) {
  const rows = await executor
    .select({ flow: userFlow, version: userFlowVersion })
    .from(userFlow)
    .innerJoin(project, eq(project.id, userFlow.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .innerJoin(
      userFlowVersion,
      and(
        eq(userFlowVersion.userFlowId, userFlow.id),
        eq(userFlowVersion.version, userFlow.currentVersion),
      ),
    )
    .where(and(where, eq(workspace.ownerAccountId, accountId)))
    .orderBy(asc(userFlow.createdAt), asc(userFlow.id));
  return rows.map(({ flow, version }) => toRecord(flow, version));
}

/**
 * PostgreSQL adapter of the User Flow seam. It resolves live references against
 * the Screen master (`project_screen`) and creates one for `Promote to Screen`.
 */
export function createDatabaseUserFlowStore(database: Database): UserFlowStore {
  return {
    convertNode: (accountId, input) =>
      convertNodeInDatabase(database, accountId, input),

    async createScreen(accountId, input) {
      return await database.transaction(async (tx) => {
        if (!(await requireWritableProject(tx, accountId, input.projectId))) {
          return null;
        }
        const [created] = await tx
          .insert(screen)
          .values({
            id: input.id,
            projectId: input.projectId,
            title: input.title,
          })
          .returning({ id: screen.id, title: screen.title });
        return created ?? null;
      });
    },

    async createTemplate(accountId, input) {
      return await database.transaction(async (tx) => {
        const owned = await findOwnedWorkspace(tx, accountId, input.projectId);
        if (!owned) {
          return null;
        }
        const [created] = await tx
          .insert(userFlowTemplate)
          .values({
            actorId: accountId,
            id: input.id,
            name: input.name,
            structure: input.structure,
            workspaceId: owned.workspaceId,
          })
          .returning();
        return created ? toTemplate(created) : null;
      });
    },

    async findTemplate(accountId, projectId, templateId) {
      const owned = await findOwnedWorkspace(database, accountId, projectId);
      if (!owned) {
        return null;
      }
      const [row] = await database
        .select()
        .from(userFlowTemplate)
        .where(
          and(
            eq(userFlowTemplate.id, templateId),
            eq(userFlowTemplate.workspaceId, owned.workspaceId),
          ),
        );
      return row ? toTemplate(row) : null;
    },

    async findVersion(accountId, projectId, userFlowId, version) {
      const [row] = await database
        .select({ document: userFlowVersion.document })
        .from(userFlowVersion)
        .innerJoin(userFlow, eq(userFlow.id, userFlowVersion.userFlowId))
        .innerJoin(project, eq(project.id, userFlow.projectId))
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(
          and(
            eq(userFlowVersion.userFlowId, userFlowId),
            eq(userFlowVersion.version, version),
            eq(userFlow.projectId, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        );
      return row?.document ?? null;
    },

    async listBinds(accountId, projectId, userFlowId) {
      const [flow] = await readRecords(
        database,
        accountId,
        and(eq(userFlow.id, userFlowId), eq(userFlow.projectId, projectId)),
      );
      if (!flow) {
        return null;
      }
      const rows = await database
        .select()
        .from(userFlowRecordBind)
        .where(eq(userFlowRecordBind.userFlowId, userFlowId))
        .orderBy(asc(userFlowRecordBind.createdAt), asc(userFlowRecordBind.id));
      return rows.map(toBind);
    },

    async listCardRecords(accountId, projectId) {
      if (!(await findOwnedProject(database, accountId, projectId))) {
        return null;
      }
      const [works, decisions, risks] = await Promise.all([
        database
          .select({ id: work.id, title: work.title })
          .from(work)
          .where(
            and(
              eq(work.projectId, projectId),
              isNull(work.archivedAt),
              isNull(work.trashedAt),
            ),
          )
          .orderBy(asc(work.title), asc(work.id))
          .limit(200),
        database
          .select({ id: decision.id, title: decision.title })
          .from(decision)
          .where(eq(decision.projectId, projectId))
          .orderBy(asc(decision.title), asc(decision.id))
          .limit(200),
        database
          .select({ id: risk.id, title: risk.title })
          .from(risk)
          .where(eq(risk.projectId, projectId))
          .orderBy(asc(risk.title), asc(risk.id))
          .limit(200),
      ]);
      return [
        ...works.map((row) => ({ ...row, kind: "Work" as const })),
        ...decisions.map((row) => ({ ...row, kind: "Decision" as const })),
        ...risks.map((row) => ({ ...row, kind: "Risk" as const })),
      ];
    },

    async listTemplates(accountId, projectId) {
      const owned = await findOwnedWorkspace(database, accountId, projectId);
      if (!owned) {
        return null;
      }
      const rows = await database
        .select()
        .from(userFlowTemplate)
        .where(eq(userFlowTemplate.workspaceId, owned.workspaceId))
        .orderBy(asc(userFlowTemplate.createdAt), asc(userFlowTemplate.id));
      return rows.map(toTemplate);
    },

    async lookupRecords(accountId, refs) {
      const lookups = new Map<string, RecordLookup>();
      const idsByKind = new Map<RecordLookupKind, string[]>();
      for (const { id, kind } of refs) {
        idsByKind.set(kind, [...(idsByKind.get(kind) ?? []), id]);
      }
      await Promise.all(
        [...idsByKind].map(async ([kind, ids]) => {
          for (const row of await readRecordRows(database, kind, ids)) {
            // A record of another account is "No access": no name, no state.
            lookups.set(
              recordLookupKey(kind, row.id),
              row.ownerAccountId === accountId
                ? {
                    archived: row.archived,
                    kind: "found",
                    projectId: row.projectId,
                    status: row.status,
                    title: row.title,
                    trashed: row.trashed,
                  }
                : { kind: "inaccessible" },
            );
          }
        }),
      );
      return lookups;
    },

    async readConversionSource(accountId, projectId, userFlowId) {
      const owned = await findOwnedProject(database, accountId, projectId);
      if (!owned) {
        return null;
      }
      const [name] = await database
        .select({ name: project.name })
        .from(project)
        .where(eq(project.id, projectId));
      const [record] = await readRecords(
        database,
        accountId,
        and(eq(userFlow.id, userFlowId), eq(userFlow.projectId, projectId)),
      );
      return record && name ? { projectName: name.name, record } : null;
    },

    async rebind(accountId, input) {
      return await database.transaction(async (tx) => {
        const locked = await lockFlow(
          tx,
          accountId,
          input.projectId,
          input.userFlowId,
        );
        if (!locked) {
          return null;
        }
        const [bind] = await tx
          .select()
          .from(userFlowRecordBind)
          .where(
            and(
              eq(userFlowRecordBind.id, input.bindId),
              eq(userFlowRecordBind.userFlowId, input.userFlowId),
            ),
          )
          .for("update");
        if (!bind) {
          return null;
        }
        const { plan } = input;
        if (
          bind.revision !== plan.bindRevision ||
          bind.boundVersion !== plan.fromVersion ||
          locked.flow.currentVersion !== plan.toVersion
        ) {
          throw new UserFlowRebindStaleError(bind.id);
        }
        // Only the bound version moves; the Origin Location columns stay.
        const [moved] = await tx
          .update(userFlowRecordBind)
          .set({
            boundVersion: plan.toVersion,
            revision: bind.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(userFlowRecordBind.id, bind.id))
          .returning();
        await tx.insert(userFlowRecordBindRebind).values({
          actorId: accountId,
          bindId: bind.id,
          fromVersion: plan.fromVersion,
          id: crypto.randomUUID(),
          toVersion: plan.toVersion,
        });
        return moved ? toBind(moved) : null;
      });
    },

    async appendVersion(accountId, input) {
      return await database.transaction(async (tx) => {
        const owned = await requireWritableProject(
          tx,
          accountId,
          input.projectId,
        );
        if (!owned) {
          return null;
        }
        const [locked] = await tx
          .select()
          .from(userFlow)
          .where(
            and(
              eq(userFlow.id, input.userFlowId),
              eq(userFlow.projectId, input.projectId),
            ),
          )
          .for("update");
        if (!locked) {
          return null;
        }
        if (locked.currentVersion !== input.expectedVersion) {
          throw new UserFlowVersionConflictError(locked.id);
        }
        const version = locked.currentVersion + 1;
        const [created] = await tx
          .insert(userFlowVersion)
          .values({
            document: input.document,
            id: crypto.randomUUID(),
            userFlowId: locked.id,
            version,
          })
          .returning();
        const [updated] = await tx
          .update(userFlow)
          .set({ currentVersion: version, updatedAt: new Date() })
          .where(eq(userFlow.id, locked.id))
          .returning();
        return created && updated ? toRecord(updated, created) : null;
      });
    },

    async create(accountId, input) {
      return await database.transaction(async (tx) => {
        const owned = await requireWritableProject(
          tx,
          accountId,
          input.projectId,
        );
        if (!owned) {
          return null;
        }
        const [flow] = await tx
          .insert(userFlow)
          .values({
            id: input.id,
            projectId: input.projectId,
            title: input.title,
          })
          .returning();
        const [version] = await tx
          .insert(userFlowVersion)
          .values({
            document: input.document,
            id: crypto.randomUUID(),
            userFlowId: input.id,
            version: 1,
          })
          .returning();
        return flow && version ? toRecord(flow, version) : null;
      });
    },

    async find(accountId, projectId, userFlowId) {
      const [record] = await readRecords(
        database,
        accountId,
        and(eq(userFlow.id, userFlowId), eq(userFlow.projectId, projectId)),
      );
      return record ?? null;
    },

    async findViewport(accountId, userFlowId) {
      const [row] = await database
        .select({ viewport: userFlowViewport.viewport })
        .from(userFlowViewport)
        .where(
          and(
            eq(userFlowViewport.accountId, accountId),
            eq(userFlowViewport.userFlowId, userFlowId),
          ),
        );
      return row?.viewport ?? null;
    },

    async saveViewport(accountId, userFlowId, viewport) {
      await database
        .insert(userFlowViewport)
        .values({ accountId, userFlowId, viewport })
        .onConflictDoUpdate({
          set: { updatedAt: new Date(), viewport },
          target: [userFlowViewport.accountId, userFlowViewport.userFlowId],
        });
    },

    async list(accountId, projectId) {
      if (!(await findOwnedProject(database, accountId, projectId))) {
        return null;
      }
      return await readRecords(
        database,
        accountId,
        eq(userFlow.projectId, projectId),
      );
    },

    async listScreens(accountId, projectId) {
      if (!(await findOwnedProject(database, accountId, projectId))) {
        return null;
      }
      return await database
        .select({ id: screen.id, title: screen.title })
        .from(screen)
        .where(
          and(
            eq(screen.projectId, projectId),
            isNull(screen.archivedAt),
            isNull(screen.trashedAt),
          ),
        )
        .orderBy(asc(screen.title), asc(screen.id));
    },

    async lookupScreens(accountId, screenIds) {
      const lookups = new Map<string, ScreenLookup>();
      if (screenIds.length === 0) {
        return lookups;
      }
      const rows = await database
        .select({
          archivedAt: screen.archivedAt,
          id: screen.id,
          ownerAccountId: workspace.ownerAccountId,
          projectId: screen.projectId,
          title: screen.title,
          trashedAt: screen.trashedAt,
        })
        .from(screen)
        .innerJoin(project, eq(project.id, screen.projectId))
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(inArray(screen.id, screenIds));
      for (const row of rows) {
        // A Screen of another account is "No access": no name, no state.
        if (row.ownerAccountId !== accountId) {
          lookups.set(row.id, { kind: "inaccessible" });
          continue;
        }
        lookups.set(row.id, {
          archivedAt: row.archivedAt?.toISOString() ?? null,
          kind: "found",
          projectId: row.projectId,
          // The Screen master has no redaction: a deleted Screen has no row.
          redactedAt: null,
          title: row.title,
          trashedAt: row.trashedAt?.toISOString() ?? null,
        });
      }
      return lookups;
    },
  };
}

export function createDatabaseUserFlow(database: Database): UserFlowAccess {
  return createUserFlow(createDatabaseUserFlowStore(database));
}
