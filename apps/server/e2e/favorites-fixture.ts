import type { Database } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  smartCollection,
  smartCollectionView,
} from "@cantiara/db/schema/smart-collection";
import { work } from "@cantiara/db/schema/work";
import { and, eq } from "drizzle-orm";
import { createDatabaseFavorites } from "../src/features/favorites/server/favorites-database";

export async function createFavoritesFixture(
  database: Database,
  accountId: string,
  projectId: string,
) {
  const [ownedWorkspace] = await database
    .select({ id: workspace.id })
    .from(workspace)
    .where(eq(workspace.ownerAccountId, accountId));
  if (!ownedWorkspace) {
    throw new Error("Favorites fixture needs its Workspace.");
  }
  const workId = crypto.randomUUID();
  const documentId = crypto.randomUUID();
  const wikiId = crypto.randomUUID();
  const decisionId = crypto.randomUUID();
  const collectionId = crypto.randomUUID();
  const viewId = crypto.randomUUID();
  const deletedId = crypto.randomUUID();
  const privateId = crypto.randomUUID();
  const staleId = crypto.randomUUID();
  await database.insert(work).values({
    id: workId,
    projectId,
    number: 1,
    key: "FAV-1",
    title: "Favorite Work",
    type: "Task",
    status: "Not Started",
  });
  await database.insert(document).values([
    {
      id: documentId,
      projectId,
      title: "Favorite Document",
      body: "Original Project Document.",
    },
    {
      id: wikiId,
      workspaceId: ownedWorkspace.id,
      title: "Favorite Wiki",
      body: "Original Wiki Document.",
    },
    {
      id: deletedId,
      projectId,
      title: "Deleted Favorite",
      body: "Must disappear.",
    },
    {
      id: privateId,
      projectId,
      title: "Private Favorite",
      body: "Must not leak.",
    },
    {
      id: staleId,
      projectId,
      title: "Favorite stale document",
      body: "Removed after list read.",
    },
  ]);
  await database.insert(decision).values({
    id: decisionId,
    projectId,
    title: "Favorite Decision",
    decision: "Original Decision.",
    life: "Valid",
  });
  await database.insert(smartCollection).values({
    id: collectionId,
    projectId,
    name: "Favorite Collection",
    scope: { projectIds: [projectId] },
    conditions: {},
  });
  await database.insert(smartCollectionView).values({
    id: viewId,
    collectionId,
    name: "Favorite view",
    presentation: "List",
  });
  const favorites = createDatabaseFavorites(database);
  await favorites.add(accountId, {
    sourceRecordId: projectId,
    sourceRecordType: "Project",
  });
  await favorites.add(accountId, {
    sourceRecordId: workId,
    sourceRecordType: "Work",
  });
  await Promise.all(
    [documentId, wikiId, deletedId, privateId, staleId].map((id) =>
      favorites.add(accountId, {
        sourceRecordId: id,
        sourceRecordType: "Document",
      }),
    ),
  );
  await favorites.add(accountId, {
    sourceRecordId: decisionId,
    sourceRecordType: "Decision",
  });
  await favorites.add(accountId, {
    sourceRecordId: collectionId,
    sourceRecordType: "Smart Collection",
  });
  await database.delete(document).where(eq(document.id, deletedId));
  const privateAccountId = crypto.randomUUID();
  const privateWorkspaceId = crypto.randomUUID();
  await database.insert(user).values({
    id: privateAccountId,
    name: "Private founder",
    email: `favorites-private-${privateAccountId}@example.invalid`,
  });
  await database
    .insert(workspace)
    .values({ id: privateWorkspaceId, ownerAccountId: privateAccountId });
  await database
    .update(document)
    .set({ projectId: null, workspaceId: privateWorkspaceId })
    .where(eq(document.id, privateId));
  return { workId, documentId, wikiId, decisionId, viewId, staleId };
}

export async function deleteStaleFavoriteSource(
  database: Database,
  documentId: string,
) {
  await database
    .delete(document)
    .where(
      and(
        eq(document.id, documentId),
        eq(document.title, "Favorite stale document"),
      ),
    );
}

export async function prepareFavoritesFixture(
  database: Database,
  fixtureKey: string,
  accountId: string,
  createProject: () => Promise<{ id: string }>,
) {
  if (fixtureKey !== "favorites-sources") {
    return {};
  }
  const sourceProject = await createProject();
  return {
    projectId: sourceProject.id,
    favoritesFixture: await createFavoritesFixture(
      database,
      accountId,
      sourceProject.id,
    ),
  };
}
