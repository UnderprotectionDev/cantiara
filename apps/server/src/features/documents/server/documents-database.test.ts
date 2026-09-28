import { DocumentStaleRevisionError } from "@cantiara/api/documents";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseDocuments } from "./documents-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Documents database boundary", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `documents-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;

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
    await database?.delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  it("keeps Markdown in the database and changes classification without changing identity or body", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const documents = createDatabaseDocuments(database);
    const source =
      "| A | B |\n| - | - |\n| 1 | 2 |\n\n```mermaid\ngraph TD; A-->B;\n```\n\n$$x^2$$";
    const created = await documents.create(accountId, {
      projectId,
      title: "Architecture",
      body: source,
      type: "General",
    });
    const edited = await documents.update(accountId, {
      documentId: created.id,
      baseRevision: created.revision,
      body: `${source}\n\nUpdated.`,
    });
    const classified = await documents.update(accountId, {
      documentId: created.id,
      baseRevision: edited.revision,
      type: "Spec",
    });

    expect(classified.id).toBe(created.id);
    expect(classified.body).toBe(`${source}\n\nUpdated.`);
    expect(classified.type).toBe("Spec");
    expect(await documents.get(accountId, created.id)).toEqual(classified);
    expect(
      (await documents.list(accountId, projectId)).map(({ id }) => id),
    ).toContain(created.id);
    expect(await documents.get("another-account", created.id)).toBeNull();
    await expect(
      documents.update(accountId, {
        documentId: created.id,
        baseRevision: created.revision,
        body: "stale",
      }),
    ).rejects.toBeInstanceOf(DocumentStaleRevisionError);
  });
});
