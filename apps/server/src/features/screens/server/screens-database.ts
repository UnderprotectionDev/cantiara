import { documentSectionById } from "@cantiara/api/documents";
import {
  type LinkedBlockRecord,
  type ParsedSetScreenLifecycleInput,
  planScreenLifecycle,
  type ScreenList,
  type ScreenRecord,
  type ScreenStore,
  type StoredWireframe,
  screenLifecycleOf,
} from "@cantiara/api/screens";
import {
  createEmptyWireframeDocument,
  type WireframeDocument,
  type WireframeLinkedContent,
} from "@cantiara/api/wireframe-document";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { document as documentTable } from "@cantiara/db/schema/document";
import { project } from "@cantiara/db/schema/project";
import {
  screen,
  screenLinkedBlock,
  screenWireframeVersion,
} from "@cantiara/db/schema/screen";
import { and, asc, desc, eq, inArray, max, sql } from "drizzle-orm";
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

function toStored(
  row: typeof screenWireframeVersion.$inferSelect,
): StoredWireframe {
  return {
    createdAt: row.createdAt.toISOString(),
    document: row.document,
    version: row.version,
    versionId: row.id,
  };
}

function toLinkedBlock(
  row: typeof screenLinkedBlock.$inferSelect,
): LinkedBlockRecord {
  return {
    content: row.content as WireframeLinkedContent,
    id: row.id,
    name: row.name,
    projectId: row.projectId,
    revision: row.revision,
  };
}

/** Gives one affected Screen its next exact version; a Screen in Trash is skipped. */
async function appendAffectedVersion(
  executor: ScreenExecutor,
  projectId: string,
  update: { document: WireframeDocument; screenId: string },
  now: Date,
) {
  const target = await lockScreen(executor, projectId, update.screenId);
  if (!target || target.trashedAt !== null) {
    return;
  }
  const latest = await latestVersion(executor, target.id);
  await executor.insert(screenWireframeVersion).values({
    createdAt: now,
    document: update.document,
    id: crypto.randomUUID(),
    screenId: target.id,
    version: (latest?.version ?? 0) + 1,
  });
}

async function latestVersion(executor: ScreenExecutor, screenId: string) {
  const [latest] = await executor
    .select()
    .from(screenWireframeVersion)
    .where(eq(screenWireframeVersion.screenId, screenId))
    .orderBy(desc(screenWireframeVersion.version))
    .limit(1);
  return latest ?? null;
}

export function createDatabaseScreenStore(database: Database): ScreenStore {
  return {
    applyLinkedBlockChange(accountId, input, updates) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, input.projectId);
        if (!owned) {
          return null;
        }
        const [current] = await executor
          .select()
          .from(screenLinkedBlock)
          .where(
            and(
              eq(screenLinkedBlock.id, input.definitionId),
              eq(screenLinkedBlock.projectId, owned.id),
            ),
          )
          .for("update");
        if (!current) {
          return null;
        }
        if (
          input.expectedRevision !== undefined &&
          input.expectedRevision !== current.revision
        ) {
          throw new ScreenRevisionConflictError(current.id);
        }
        const now = new Date();
        const [saved] = await executor
          .update(screenLinkedBlock)
          .set({
            content: input.content,
            revision: current.revision + 1,
            updatedAt: now,
          })
          .where(eq(screenLinkedBlock.id, current.id))
          .returning();
        // Each affected Screen gains a new exact version; older versions keep
        // the source content they were saved with.
        await Promise.all(
          updates.map((update) =>
            appendAffectedVersion(executor, owned.id, update, now),
          ),
        );
        return saved ? toLinkedBlock(saved) : null;
      });
    },

    createLinkedBlock(accountId, input) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, input.projectId);
        if (!owned) {
          return null;
        }
        const now = new Date();
        const [created] = await executor
          .insert(screenLinkedBlock)
          .values({
            content: input.content,
            createdAt: now,
            id: crypto.randomUUID(),
            name: input.name,
            projectId: owned.id,
            revision: 1,
            updatedAt: now,
          })
          .returning();
        return created ? toLinkedBlock(created) : null;
      });
    },

    findLinkedBlock(accountId, projectId, definitionId) {
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
            .from(screenLinkedBlock)
            .where(
              and(
                eq(screenLinkedBlock.id, definitionId),
                eq(screenLinkedBlock.projectId, owned.id),
              ),
            );
          return row ? toLinkedBlock(row) : null;
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    findWireframe(accountId, projectId, screenId, version) {
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
          if (!row || row.trashedAt !== null) {
            return null;
          }
          const versions = await executor
            .select()
            .from(screenWireframeVersion)
            .where(eq(screenWireframeVersion.screenId, row.id))
            .orderBy(desc(screenWireframeVersion.version));
          const found =
            version === undefined
              ? versions[0]
              : versions.find((item) => item.version === version);
          if (found) {
            return toStored(found);
          }
          // A Screen without a Wireframe yet opens an empty, unsaved document.
          return version === undefined
            ? {
                createdAt: row.createdAt.toISOString(),
                document: createEmptyWireframeDocument(),
                version: 0,
                versionId: "",
              }
            : null;
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    headDocuments(accountId, projectId) {
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
            .where(eq(screen.projectId, owned.id));
          const versions = rows.length
            ? await executor
                .select()
                .from(screenWireframeVersion)
                .where(
                  inArray(
                    screenWireframeVersion.screenId,
                    rows.map(({ id }) => id),
                  ),
                )
                .orderBy(desc(screenWireframeVersion.version))
            : [];
          return rows.flatMap((row) => {
            const head = versions.find(({ screenId }) => screenId === row.id);
            return head
              ? [
                  {
                    document: head.document,
                    lifecycle: screenLifecycleOf(row),
                    screenId: row.id,
                    title: row.title,
                  },
                ]
              : [];
          });
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    listLinkedBlocks(accountId, projectId) {
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
            .from(screenLinkedBlock)
            .where(eq(screenLinkedBlock.projectId, owned.id))
            .orderBy(asc(screenLinkedBlock.name), asc(screenLinkedBlock.id));
          return rows.map(toLinkedBlock);
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    readLiveSections(accountId, sources) {
      return database.transaction(
        async (executor) => {
          const ids = [...new Set(sources.map(({ documentId }) => documentId))];
          const rows = ids.length
            ? await executor
                .select({ body: documentTable.body, id: documentTable.id })
                .from(documentTable)
                .leftJoin(project, eq(documentTable.projectId, project.id))
                .innerJoin(
                  workspace,
                  eq(
                    sql`coalesce(${documentTable.workspaceId}, ${project.workspaceId})`,
                    workspace.id,
                  ),
                )
                .where(
                  and(
                    inArray(documentTable.id, ids),
                    eq(workspace.ownerAccountId, accountId),
                  ),
                )
            : [];
          const bodies = new Map(rows.map((row) => [row.id, row.body]));
          return sources.map(({ documentId, sectionId }) => {
            const body = bodies.get(documentId);
            const section =
              body === undefined ? null : documentSectionById(body, sectionId);
            return { documentId, sectionId, text: section?.content ?? null };
          });
        },
        { accessMode: "read only", isolationLevel: "repeatable read" },
      );
    },

    saveWireframe(accountId, projectId, screenId, document) {
      return database.transaction(async (executor) => {
        const owned = await openProject(executor, accountId, projectId);
        if (!owned) {
          return null;
        }
        const current = await lockScreen(executor, owned.id, screenId);
        if (!current || current.trashedAt !== null) {
          return null;
        }
        // Geometry writes update the working version in place and never touch
        // the Screen row, so the Screen list has nothing to refetch.
        const latest = await latestVersion(executor, current.id);
        if (latest) {
          const [updated] = await executor
            .update(screenWireframeVersion)
            .set({ document })
            .where(eq(screenWireframeVersion.id, latest.id))
            .returning();
          return updated ? toStored(updated) : null;
        }
        const [created] = await executor
          .insert(screenWireframeVersion)
          .values({
            createdAt: new Date(),
            document,
            id: crypto.randomUUID(),
            screenId: current.id,
            version: 1,
          })
          .returning();
        return created ? toStored(created) : null;
      });
    },

    attachWireframeVersion(accountId, projectId, screenId, document) {
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
          ...(document ? { document } : {}),
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
