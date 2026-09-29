import type {
  CreateSmartCollectionInput,
  SmartCollectionsAccess,
  SmartCollectionViewSource,
} from "@cantiara/api/smart-collections";
import {
  SmartCollectionConflictError,
  SmartCollectionUnavailableError,
} from "@cantiara/api/smart-collections";
import type { Database } from "@cantiara/db";
import { workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import {
  smartCollection,
  smartCollectionView,
} from "@cantiara/db/schema/smart-collection";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, isNull } from "drizzle-orm";

export function createDatabaseSmartCollections(
  database: Database,
): SmartCollectionsAccess {
  async function getView(
    accountId: string,
    viewId: string,
  ): Promise<SmartCollectionViewSource | null> {
    const [row] = await database
      .select({ collection: smartCollection, view: smartCollectionView })
      .from(smartCollectionView)
      .innerJoin(
        smartCollection,
        eq(smartCollectionView.collectionId, smartCollection.id),
      )
      .innerJoin(project, eq(smartCollection.projectId, project.id))
      .innerJoin(workspace, eq(project.workspaceId, workspace.id))
      .where(
        and(
          eq(smartCollectionView.id, viewId),
          eq(workspace.ownerAccountId, accountId),
        ),
      )
      .limit(1);
    if (!row) {
      return null;
    }
    const { collection, view } = row;
    const works = await database
      .select({
        id: work.id,
        key: work.key,
        title: work.title,
        status: work.status,
        type: work.type,
      })
      .from(work)
      .where(
        and(
          eq(work.projectId, collection.projectId),
          isNull(work.trashedAt),
          collection.conditions.status
            ? eq(work.status, collection.conditions.status)
            : undefined,
          collection.conditions.type
            ? eq(work.type, collection.conditions.type)
            : undefined,
        ),
      )
      .orderBy(asc(work.key));
    return {
      collectionId: collection.id,
      collectionName: collection.name,
      id: view.id,
      name: view.name,
      presentation: view.presentation as "List" | "Table",
      projectId: collection.projectId,
      works,
    };
  }

  return {
    getView,
    async create(accountId: string, input: CreateSmartCollectionInput) {
      const [owned] = await database
        .select({ id: project.id })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, input.projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!owned) {
        throw new SmartCollectionUnavailableError();
      }
      const collectionId = input.clientIdempotencyKey;
      const viewId = `${collectionId}:default`;
      await database.transaction(async (tx) => {
        const [created] = await tx
          .insert(smartCollection)
          .values({
            id: collectionId,
            projectId: input.projectId,
            name: input.name,
            conditions: input.conditions,
          })
          .onConflictDoNothing()
          .returning({ id: smartCollection.id });
        if (!created) {
          const [existing] = await tx
            .select()
            .from(smartCollection)
            .where(eq(smartCollection.id, collectionId))
            .limit(1);
          const [existingView] = await tx
            .select()
            .from(smartCollectionView)
            .where(eq(smartCollectionView.id, viewId))
            .limit(1);
          if (
            existing?.projectId !== input.projectId ||
            existing.name !== input.name ||
            JSON.stringify(existing.conditions) !==
              JSON.stringify(input.conditions) ||
            existingView?.name !== input.viewName ||
            existingView.presentation !== input.presentation
          ) {
            throw new SmartCollectionConflictError();
          }
          return;
        }
        await tx.insert(smartCollectionView).values({
          id: viewId,
          collectionId,
          name: input.viewName,
          presentation: input.presentation,
        });
      });
      const result = await getView(accountId, viewId);
      if (!result) {
        throw new SmartCollectionUnavailableError();
      }
      return result;
    },
    async listViews(accountId, projectId) {
      const rows = await database
        .select({ id: smartCollectionView.id })
        .from(smartCollectionView)
        .innerJoin(
          smartCollection,
          eq(smartCollectionView.collectionId, smartCollection.id),
        )
        .innerJoin(project, eq(smartCollection.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(smartCollection.projectId, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        );
      return (
        await Promise.all(rows.map(({ id }) => getView(accountId, id)))
      ).filter((value): value is SmartCollectionViewSource => value !== null);
    },
  };
}
