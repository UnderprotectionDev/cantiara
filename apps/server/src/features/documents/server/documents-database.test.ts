import type { Context } from "@cantiara/api/context";
import type { Document } from "@cantiara/api/documents";
import { appRouter } from "@cantiara/api/routers/index";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
} from "@cantiara/db/schema/mutation";
import { project } from "@cantiara/db/schema/project";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDatabaseDocumentMutationContracts,
  createDatabaseDocuments,
} from "./documents-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Documents database boundary", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `documents-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;

  function client() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const context: Context = {
      accountAccess: {
        listSessions: async () => [],
        revokeOtherSessions: async () => undefined,
        revokeSession: async () => undefined,
      },
      accountPreferences: {
        get: () => Promise.reject(new Error("Not part of this test.")),
      },
      auth: null,
      db: database,
      documentMutationContracts:
        createDatabaseDocumentMutationContracts(database),
      documents: createDatabaseDocuments(database),
      githubAvailability: { getStatus: () => "available" },
      session: {
        session: { id: "session-1" },
        user: { id: accountId },
      } as Context["session"],
    };
    return createRouterClient(appRouter, { context });
  }

  beforeEach(async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    await database.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await database.insert(project).values({
      id: projectId,
      workspaceId,
      name: "Documents test",
      shortCode: `DOC-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      starterConfiguration: "Blank Project",
    });
  });

  afterEach(async () => {
    await database
      ?.delete(mutationHistory)
      .where(eq(mutationHistory.actorId, accountId));
    await database
      ?.delete(mutationReceipt)
      .where(eq(mutationReceipt.actorId, accountId));
    await database
      ?.delete(mutationStaging)
      .where(eq(mutationStaging.actorId, accountId));
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  it("persists Markdown edits, replays retries, and blocks writes after Project archive", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const documents = client();
    const source =
      "| A | B |\n| - | - |\n| 1 | 2 |\n\n```mermaid\ngraph TD; A-->B;\n```\n\n$$x^2$$";
    const createInput = {
      baseRevision: 0,
      body: source,
      clientIdempotencyKey: "create-document-once",
      projectId,
      title: "Architecture",
      type: "General" as const,
    };
    const created = await documents.createDocument(createInput);
    const retriedCreate = await documents.createDocument(createInput);

    expect(retriedCreate).toEqual(created);
    expect(await documents.documents({ projectId })).toEqual([created]);

    await expect(
      documents.createDocument({ ...createInput, body: "different payload" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    const updateInput = {
      baseRevision: created.revision,
      body: `${source}\n\nUpdated.`,
      clientIdempotencyKey: "update-document-once",
      documentId: created.id,
    };
    const updated = await documents.updateDocument(updateInput);
    const retriedUpdate = await documents.updateDocument(updateInput);

    expect(retriedUpdate).toEqual(updated);
    expect(updated).toMatchObject({
      body: `${source}\n\nUpdated.`,
      id: created.id,
      revision: 2,
    });
    await expect(
      documents.updateDocument({
        baseRevision: created.revision,
        body: "stale edit",
        clientIdempotencyKey: "update-document-stale",
        documentId: created.id,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "STALE_BASE_REVISION", currentRevision: updated.revision },
    });

    await database
      .update(project)
      .set({ archivedAt: new Date() })
      .where(eq(project.id, projectId));

    await expect(
      documents.createDocument({
        ...createInput,
        clientIdempotencyKey: "create-after-archive",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      documents.updateDocument({
        baseRevision: updated.revision,
        body: "archived edit",
        clientIdempotencyKey: "update-after-archive",
        documentId: created.id,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const stillReadable = (await documents.document({
      documentId: created.id,
    })) as Document;
    expect(stillReadable).toEqual(updated);
    expect(await documents.documents({ projectId })).toEqual([updated]);
  });
});
