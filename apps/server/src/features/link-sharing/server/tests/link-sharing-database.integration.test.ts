import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import { externalSurfaceSnapshotRevision } from "@cantiara/db/schema/external-surface";
import { work } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectShell } from "../../../project-shell/server/project-shell-database";
import { createDatabaseLinkSharing } from "../link-sharing-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Link Sharing PostgreSQL", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `share-${crypto.randomUUID()}`;

  beforeEach(async () => {
    await database?.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await database?.insert(workspace).values({
      id: `workspace-${crypto.randomUUID()}`,
      ownerAccountId: accountId,
    });
  });
  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await database?.$client.end();
  });

  test("approves a Document into one surface and keeps later edits private", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Share",
        shortCode: "SHR",
        starterConfiguration: "Blank Project",
      },
    );
    const documentId = `doc-${crypto.randomUUID()}`;
    await database.insert(document).values({
      body: "Dear {{musteri_adi}} and `{{inline_code}}`",
      id: documentId,
      projectId: profile.id,
      title: "Plan",
    });
    const access = createDatabaseLinkSharing(database);
    const root = { id: documentId, kind: "Document" as const };

    const roots = await access.roots(accountId, profile.id);
    expect(roots?.map((entry) => entry.id)).toContain(documentId);
    expect(await access.roots("someone-else", profile.id)).toBeNull();

    const preview = await access.preview(accountId, { root });
    expect(preview?.surface).toBeNull();
    expect(preview?.placeholders.map((entry) => entry.placeholder)).toEqual([
      "{{musteri_adi}}",
    ]);
    const approvedItemIds = (preview?.items ?? []).map((item) => item.itemId);

    expect(await access.preview("someone-else", { root })).toBeNull();

    const approved = await access.approve(accountId, {
      approvalId: `approval-${crypto.randomUUID()}`,
      approvedItemIds,
      liveItemIds: [],
      publishAnyway: true,
      root,
    });
    expect(approved).toMatchObject({ label: "Approved snapshot", revision: 1 });

    await database
      .update(document)
      .set({ body: "Edited after approval" })
      .where(eq(document.id, documentId));
    const [revision] = await database
      .select()
      .from(externalSurfaceSnapshotRevision)
      .where(
        eq(
          externalSurfaceSnapshotRevision.surfaceId,
          approved?.surfaceId ?? "",
        ),
      );
    expect(JSON.stringify(revision?.snapshot)).not.toContain(
      "Edited after approval",
    );
    const next = await access.preview(accountId, { root });
    expect(next?.surface?.surfaceId).toBe(approved?.surfaceId);
    expect(next?.diff?.changed).toContain(`field:Document:${documentId}:body`);
  });

  test("lists Work with the live allow-list kinds and no inherited record", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      { name: "Work", shortCode: "WRK", starterConfiguration: "Blank Project" },
    );
    const workId = `work-${crypto.randomUUID()}`;
    await database.insert(work).values({
      id: workId,
      key: "WRK-1",
      number: 1,
      projectId: profile.id,
      title: "Ship",
      type: "Task",
    });
    const preview = await createDatabaseLinkSharing(database).preview(
      accountId,
      { root: { id: workId, kind: "Work" } },
    );
    expect(
      preview?.items.filter((item) => item.kind === "Record"),
    ).toHaveLength(1);
    expect(
      preview?.items
        .filter((item) => item.liveEligible)
        .map((item) => item.label),
    ).toContain("Status");
  });
});
