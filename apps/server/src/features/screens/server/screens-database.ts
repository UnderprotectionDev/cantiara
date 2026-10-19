import {
  planScreenLifecycle,
  type ScreenList,
  type ScreenRecord,
  type ScreenStore,
  screenLifecycleOf,
} from "@cantiara/api/screens";
import type { Database } from "@cantiara/db";
import { screen, screenWireframeVersion } from "@cantiara/db/schema/screen";
import { and, asc, desc, eq, inArray, max } from "drizzle-orm";
import {
  type FeedbackExecutor,
  findOwnedProject,
  findReadableProject,
} from "../../feedback/server/feedback-database";
import {
  createScreens,
  ScreenLifecycleInvalidError,
  ScreenProjectReadOnlyError,
  ScreenRevisionConflictError,
} from "./screens";

type ScreenExecutor = FeedbackExecutor;

async function openProject(
  executor: ScreenExecutor,
  accountId: string,
  projectId: string,
) {
  const owned = await findOwnedProject(executor, accountId, projectId);
  if (owned?.archivedAt) {
    throw new ScreenProjectReadOnlyError(owned.id);
  }
  return owned;
}

async function toRecords(
  executor: ScreenExecutor,
  rows: (typeof screen.$inferSelect)[],
): Promise<ScreenRecord[]> {
  if (rows.length === 0) {
    return [];
  }
  const versions = await executor
    .select()
    .from(screenWireframeVersion)
    .where(
      inArray(
        screenWireframeVersion.screenId,
        rows.map(({ id }) => id),
      ),
    )
    .orderBy(asc(screenWireframeVersion.version));
  return rows.map((row) => ({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    lifecycle: screenLifecycleOf(row),
    projectId: row.projectId,
    revision: row.revision,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    wireframeVersions: versions
      .filter(({ screenId }) => screenId === row.id)
      .map(({ createdAt, id, version }) => ({
        createdAt: createdAt.toISOString(),
        id,
        version,
      })),
  }));
}

async function lockScreen(
  executor: ScreenExecutor,
  projectId: string,
  screenId: string,
) {
  const [current] = await executor
    .select()
    .from(screen)
    .where(and(eq(screen.id, screenId), eq(screen.projectId, projectId)))
    .for("update");
  return current ?? null;
}

/** Writes the Screen row only; Wireframe versions keep their Screen id untouched. */
async function applyLifecycle(
  executor: ScreenExecutor,
  current: typeof screen.$inferSelect,
  input: ParsedSetScreenLifecycleInput,
) {
  if (
    input.expectedRevision !== undefined &&
    input.expectedRevision !== current.revision
  ) {
    throw new ScreenRevisionConflictError(current.id);
  }
  const plan = planScreenLifecycle(
    {
      archived: current.archivedAt !== null,
      trashed: current.trashedAt !== null,
    },
    input.action,
  );
  if (!plan) {
    throw new ScreenLifecycleInvalidError(current.id, input.action);
  }
  if (!plan.changed) {
    return current;
  }
  const now = new Date();
  const [updated] = await executor
    .update(screen)
    .set({
      archivedAt: plan.archived ? (current.archivedAt ?? now) : null,
      revision: current.revision + 1,
      trashedAt: plan.trashed ? (current.trashedAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(screen.id, current.id))
    .returning();
  if (!updated) {
    throw new Error("Screen lifecycle was not updated.");
  }
  return updated;
}

export function createDatabaseScreenStore(database: Database): ScreenStore {
  return {
    attachWireframeVersion(accountId, projectId, screenId) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, projectId);
        if (!owned) {
          return null;
        }
        const current = await lockScreen(executor, owned.id, screenId);
        // A Screen in Trash is a broken target; its history only grows through restore.
        if (!current || current.trashedAt !== null) {
          return null;
        }
        const [latest] = await executor
          .select({ version: max(screenWireframeVersion.version) })
          .from(screenWireframeVersion)
          .where(eq(screenWireframeVersion.screenId, current.id));
        await executor.insert(screenWireframeVersion).values({
          createdAt: new Date(),
          id: crypto.randomUUID(),
          screenId: current.id,
          version: (latest?.version ?? 0) + 1,
        });
        const [record] = await toRecords(executor, [current]);
        return record ?? null;
      });
    },

    create(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, input.projectId);
        if (!owned) {
          return null;
        }
        const now = new Date();
        const [created] = await executor
          .insert(screen)
          .values({
            createdAt: now,
            id: crypto.randomUUID(),
            projectId: owned.id,
            revision: 1,
            title: input.title,
            updatedAt: now,
          })
          .returning();
        if (!created) {
          throw new Error("Screen was not created.");
        }
        const [record] = await toRecords(executor, [created]);
        return record ?? null;
      });
    },

    find(accountId, projectId, screenId) {
      return database.transaction(
        async (executor) => {
          const owned = await findReadableProject(
            executor,
            accountId,
            projectId,
          );
          if (!owned) {
            return null;
          }
          const [row] = await executor
            .select()
            .from(screen)
            .where(
              and(eq(screen.id, screenId), eq(screen.projectId, owned.id)),
            );
          if (!row) {
            return null;
          }
          const [record] = await toRecords(executor, [row]);
          return record ?? null;
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    list(accountId, projectId): Promise<ScreenList | null> {
      return database.transaction(
        async (executor) => {
          const owned = await findReadableProject(
            executor,
            accountId,
            projectId,
          );
          if (!owned) {
            return null;
          }
          const rows = await executor
            .select()
            .from(screen)
            .where(eq(screen.projectId, owned.id))
            .orderBy(desc(screen.createdAt), asc(screen.id));
          return {
            readOnly: owned.archivedAt !== null,
            screens: await toRecords(executor, rows),
          };
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    setLifecycle(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, input.projectId);
        if (!owned) {
          return null;
        }
        const current = await lockScreen(executor, owned.id, input.screenId);
        if (!current) {
          return null;
        }
        const row = await applyLifecycle(executor, current, input);
        const [record] = await toRecords(executor, [row]);
        return record ?? null;
      });
    },
  };
}

export function createDatabaseScreens(database: Database) {
  return createScreens(createDatabaseScreenStore(database));
}
