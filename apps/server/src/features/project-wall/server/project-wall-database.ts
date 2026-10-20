import type {
  ProjectWallAccess,
  ProjectWallDensity,
  ProjectWallFieldName,
  ProjectWallHighlight,
  ProjectWallItemRecord,
  ProjectWallRecord,
  ProjectWallSourceLookup,
  ProjectWallSourceType,
  ProjectWallStore,
} from "@cantiara/api/project-wall";
import { recordLookupKey } from "@cantiara/api/user-flow";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { project } from "@cantiara/db/schema/project";
import { projectWall, projectWallItem } from "@cantiara/db/schema/project-wall";
import { risk } from "@cantiara/db/schema/risk";
import { work } from "@cantiara/db/schema/work";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";

import {
  createProjectWall,
  ProjectWallCardDuplicateError,
  ProjectWallProjectReadOnlyError,
} from "./project-wall";

type Executor = Pick<Database, "delete" | "insert" | "select" | "update">;

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
    throw new ProjectWallProjectReadOnlyError(owned.id);
  }
  return owned;
}

/** A wall of the caller's Project, readable (not necessarily writable). */
async function findOwnedWall(
  executor: Executor,
  accountId: string,
  projectId: string,
  wallId: string,
) {
  const [wall] = await executor
    .select({ projectId: projectWall.projectId })
    .from(projectWall)
    .innerJoin(project, eq(project.id, projectWall.projectId))
    .innerJoin(workspace, eq(workspace.id, project.workspaceId))
    .where(
      and(
        eq(projectWall.id, wallId),
        eq(projectWall.projectId, projectId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  return wall ?? null;
}

async function findWritableWall(
  executor: Executor,
  accountId: string,
  projectId: string,
  wallId: string,
) {
  const owned = await requireWritableProject(executor, accountId, projectId);
  return owned
    ? await findOwnedWall(executor, accountId, projectId, wallId)
    : null;
}

type ItemRow = typeof projectWallItem.$inferSelect;
type WallRow = typeof projectWall.$inferSelect;

function toItem(row: ItemRow): ProjectWallItemRecord {
  return {
    density: row.density as ProjectWallDensity,
    highlight: row.highlight as ProjectWallHighlight | null,
    id: row.id,
    placedAt: row.placedAt.toISOString(),
    position: { x: row.positionX, y: row.positionY },
    sourceId: row.sourceId,
    sourceType: row.sourceType as ProjectWallSourceType,
  };
}

function toRecord(row: WallRow, items: ItemRow[]): ProjectWallRecord {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    items: items.map(toItem),
    projectId: row.projectId,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface SourceRow {
  archived: boolean;
  id: string;
  ownerAccountId: string;
  projectId: string;
  status: string | null;
  title: string;
  trashed: boolean;
  values: Partial<Record<ProjectWallFieldName, string | null>>;
}

/**
 * Reads source rows for lookup only. This module has no insert, update or
 * delete against a master table: a wall change cannot write a source.
 */
async function readSourceRows(
  database: Database,
  sourceType: ProjectWallSourceType,
  ids: string[],
): Promise<SourceRow[]> {
  switch (sourceType) {
    case "Work": {
      const rows = await database
        .select({
          archivedAt: work.archivedAt,
          description: work.description,
          id: work.id,
          key: work.key,
          ownerAccountId: workspace.ownerAccountId,
          projectId: work.projectId,
          status: work.status,
          title: work.title,
          trashedAt: work.trashedAt,
          type: work.type,
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
        values: { Description: row.description, Key: row.key, Type: row.type },
      }));
    }
    case "Decision": {
      const rows = await database
        .select({
          decision: decision.decision,
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
      return rows.map(({ decision: text, ...row }) => ({
        ...row,
        archived: false,
        trashed: false,
        values: { Decision: text },
      }));
    }
    case "Risk": {
      const rows = await database
        .select({
          id: risk.id,
          impact: risk.impact,
          ownerAccountId: workspace.ownerAccountId,
          probability: risk.probability,
          projectId: risk.projectId,
          status: risk.life,
          title: risk.title,
        })
        .from(risk)
        .innerJoin(project, eq(project.id, risk.projectId))
        .innerJoin(workspace, eq(workspace.id, project.workspaceId))
        .where(inArray(risk.id, ids));
      return rows.map(({ impact, probability, ...row }) => ({
        ...row,
        archived: false,
        trashed: false,
        values: { Impact: impact, Probability: probability },
      }));
    }
    default:
      return [];
  }
}

const SOURCE_OPTION_LIMIT = 200;

export function createDatabaseProjectWallStore(
  database: Database,
): ProjectWallStore {
  return {
    async addCard(accountId, input) {
      return await database.transaction(async (tx) => {
        if (
          !(await findWritableWall(
            tx,
            accountId,
            input.projectId,
            input.wallId,
          ))
        ) {
          return null;
        }
        const [row] = await tx
          .insert(projectWallItem)
          .values({
            density: input.density,
            id: input.id,
            placedAt: new Date(input.placedAt),
            positionX: input.position.x,
            positionY: input.position.y,
            sourceId: input.sourceId,
            sourceType: input.sourceType,
            wallId: input.wallId,
          })
          .onConflictDoNothing()
          .returning();
        if (!row) {
          throw new ProjectWallCardDuplicateError();
        }
        await tx
          .update(projectWall)
          .set({ updatedAt: new Date() })
          .where(eq(projectWall.id, input.wallId));
        return toItem(row);
      });
    },

    async createWall(accountId, input) {
      return await database.transaction(async (tx) => {
        if (!(await requireWritableProject(tx, accountId, input.projectId))) {
          return null;
        }
        const [row] = await tx
          .insert(projectWall)
          .values({
            id: input.id,
            projectId: input.projectId,
            title: input.title,
          })
          .returning();
        return row ? toRecord(row, []) : null;
      });
    },

    async deleteWall(accountId, projectId, wallId) {
      return await database.transaction(async (tx) => {
        if (!(await findWritableWall(tx, accountId, projectId, wallId))) {
          return false;
        }
        // Cards cascade; only wall rows are removed, never a source record.
        await tx.delete(projectWall).where(eq(projectWall.id, wallId));
        return true;
      });
    },

    async findWall(accountId, projectId, wallId) {
      if (!(await findOwnedWall(database, accountId, projectId, wallId))) {
        return null;
      }
      const [wall] = await database
        .select()
        .from(projectWall)
        .where(eq(projectWall.id, wallId));
      if (!wall) {
        return null;
      }
      const items = await database
        .select()
        .from(projectWallItem)
        .where(eq(projectWallItem.wallId, wallId))
        .orderBy(asc(projectWallItem.placedAt), asc(projectWallItem.id));
      return toRecord(wall, items);
    },

    async listSourceOptions(accountId, projectId) {
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
          .limit(SOURCE_OPTION_LIMIT),
        database
          .select({ id: decision.id, title: decision.title })
          .from(decision)
          .where(eq(decision.projectId, projectId))
          .orderBy(asc(decision.title), asc(decision.id))
          .limit(SOURCE_OPTION_LIMIT),
        database
          .select({ id: risk.id, title: risk.title })
          .from(risk)
          .where(eq(risk.projectId, projectId))
          .orderBy(asc(risk.title), asc(risk.id))
          .limit(SOURCE_OPTION_LIMIT),
      ]);
      return [
        ...works.map((row) => ({ ...row, sourceType: "Work" as const })),
        ...decisions.map((row) => ({
          ...row,
          sourceType: "Decision" as const,
        })),
        ...risks.map((row) => ({ ...row, sourceType: "Risk" as const })),
      ];
    },

    async listWalls(accountId, projectId) {
      if (!(await findOwnedProject(database, accountId, projectId))) {
        return null;
      }
      const walls = await database
        .select()
        .from(projectWall)
        .where(eq(projectWall.projectId, projectId))
        .orderBy(asc(projectWall.createdAt), asc(projectWall.id));
      const counts = await database
        .select({ cards: count(), wallId: projectWallItem.wallId })
        .from(projectWallItem)
        .innerJoin(projectWall, eq(projectWall.id, projectWallItem.wallId))
        .where(eq(projectWall.projectId, projectId))
        .groupBy(projectWallItem.wallId);
      const cardCounts = new Map(counts.map((row) => [row.wallId, row.cards]));
      return walls.map((wall) => ({
        cardCount: cardCounts.get(wall.id) ?? 0,
        createdAt: wall.createdAt.toISOString(),
        id: wall.id,
        projectId: wall.projectId,
        title: wall.title,
        updatedAt: wall.updatedAt.toISOString(),
      }));
    },

    async lookupSources(accountId, refs) {
      const lookups = new Map<string, ProjectWallSourceLookup>();
      const idsByType = new Map<ProjectWallSourceType, string[]>();
      for (const { id, sourceType } of refs) {
        idsByType.set(sourceType, [...(idsByType.get(sourceType) ?? []), id]);
      }
      await Promise.all(
        [...idsByType].map(async ([sourceType, ids]) => {
          for (const row of await readSourceRows(database, sourceType, ids)) {
            // A record of another account is "No access": no name, no state.
            lookups.set(
              recordLookupKey(sourceType, row.id),
              row.ownerAccountId === accountId
                ? {
                    archived: row.archived,
                    kind: "found",
                    projectId: row.projectId,
                    status: row.status,
                    title: row.title,
                    trashed: row.trashed,
                    values: row.values,
                  }
                : { kind: "inaccessible" },
            );
          }
        }),
      );
      return lookups;
    },

    async moveCards(accountId, input) {
      return await database.transaction(async (tx) => {
        if (
          !(await findWritableWall(
            tx,
            accountId,
            input.projectId,
            input.wallId,
          ))
        ) {
          return false;
        }
        for (const { cardId, position } of input.moves) {
          // biome-ignore lint/performance/noAwaitInLoops: One transaction connection runs its statements in order.
          await tx
            .update(projectWallItem)
            .set({ positionX: position.x, positionY: position.y })
            .where(
              and(
                eq(projectWallItem.id, cardId),
                eq(projectWallItem.wallId, input.wallId),
              ),
            );
        }
        return true;
      });
    },

    async removeCard(accountId, input) {
      return await database.transaction(async (tx) => {
        if (
          !(await findWritableWall(
            tx,
            accountId,
            input.projectId,
            input.wallId,
          ))
        ) {
          return false;
        }
        const removed = await tx
          .delete(projectWallItem)
          .where(
            and(
              eq(projectWallItem.id, input.cardId),
              eq(projectWallItem.wallId, input.wallId),
            ),
          )
          .returning({ id: projectWallItem.id });
        return removed.length > 0;
      });
    },

    async renameWall(accountId, input) {
      return await database.transaction(async (tx) => {
        if (
          !(await findWritableWall(
            tx,
            accountId,
            input.projectId,
            input.wallId,
          ))
        ) {
          return false;
        }
        await tx
          .update(projectWall)
          .set({ title: input.title })
          .where(eq(projectWall.id, input.wallId));
        return true;
      });
    },

    async setCardDensity(accountId, input) {
      return await database.transaction(async (tx) => {
        if (
          !(await findWritableWall(
            tx,
            accountId,
            input.projectId,
            input.wallId,
          ))
        ) {
          return false;
        }
        const changed = await tx
          .update(projectWallItem)
          .set({ density: input.density })
          .where(
            and(
              eq(projectWallItem.id, input.cardId),
              eq(projectWallItem.wallId, input.wallId),
            ),
          )
          .returning({ id: projectWallItem.id });
        return changed.length > 0;
      });
    },

    async setCardHighlight(accountId, input) {
      return await database.transaction(async (tx) => {
        if (
          !(await findWritableWall(
            tx,
            accountId,
            input.projectId,
            input.wallId,
          ))
        ) {
          return false;
        }
        const changed = await tx
          .update(projectWallItem)
          .set({ highlight: input.highlight })
          .where(
            and(
              eq(projectWallItem.id, input.cardId),
              eq(projectWallItem.wallId, input.wallId),
            ),
          )
          .returning({ id: projectWallItem.id });
        return changed.length > 0;
      });
    },
  };
}

export function createDatabaseProjectWall(
  database: Database,
): ProjectWallAccess {
  return createProjectWall(createDatabaseProjectWallStore(database));
}
