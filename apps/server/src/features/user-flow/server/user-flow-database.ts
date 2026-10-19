import type {
  ScreenLookup,
  UserFlowAccess,
  UserFlowRecord,
  UserFlowStore,
} from "@cantiara/api/user-flow";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import {
  screen,
  userFlow,
  userFlowVersion,
} from "@cantiara/db/schema/user-flow";
import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";

import {
  createUserFlow,
  UserFlowProjectReadOnlyError,
  UserFlowVersionConflictError,
} from "./user-flow";

type Executor = Pick<Database, "insert" | "select" | "update">;

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
 * PostgreSQL adapter of the User Flow seam. It reads `screen` only to resolve
 * live references and never writes it.
 */
export function createDatabaseUserFlowStore(database: Database): UserFlowStore {
  return {
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
            isNull(screen.redactedAt),
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
          redactedAt: screen.redactedAt,
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
          redactedAt: row.redactedAt?.toISOString() ?? null,
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
