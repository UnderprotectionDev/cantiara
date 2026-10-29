// biome-ignore-all lint/performance/useTopLevelRegex: Inline patterns assert one rendered string each.
import { createDb } from "@cantiara/db";
import { auditRecord, user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import {
  externalSurface,
  linkShareVisitorSession,
} from "@cantiara/db/schema/external-surface";
import { and, eq, like } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { createDatabaseProjectShell } from "../../../project-shell/server/project-shell-database";
import type {
  LinkSharingSecurityEvents,
  ShareAccessEvent,
} from "../link-sharing";
import { createDatabaseLinkSharingAudit } from "../link-sharing-audit-database";
import {
  createDatabaseLinkSharing,
  createDatabaseLinkSharingReplay,
} from "../link-sharing-database";
import { createDatabaseLinkSharingVisitor } from "../link-sharing-visitor-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const signals = { device: "Browser/1", network: "203.0.113.7" };

describeDatabase("Link Sharing expiry, revoke and replay PostgreSQL", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `share-lifecycle-${crypto.randomUUID()}`;

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
    await database
      ?.delete(auditRecord)
      .where(like(auditRecord.type, "link-sharing.%"));
  });
  afterAll(async () => {
    await database?.$client.end();
  });

  test("expiry stops access without revoking, reopen and reshare are separate, revoke is terminal and replay keeps a restored live row cancelled", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Lifecycle",
        shortCode: "SHL",
        starterConfiguration: "Blank Project",
      },
    );
    const documentId = `doc-${crypto.randomUUID()}`;
    await database.insert(document).values({
      body: "Visible body",
      id: documentId,
      projectId: profile.id,
      title: "Plan",
    });
    let current = new Date();
    // The security log lives in its own database; an in-memory log stands in.
    const events: ShareAccessEvent[] = [];
    const securityEvents: LinkSharingSecurityEvents = {
      append: (event) => {
        events.push(event);
        return Promise.resolve();
      },
      list: () => Promise.resolve([...events]),
    };
    const audit = createDatabaseLinkSharingAudit(database);
    const founder = createDatabaseLinkSharing(database, {
      audit,
      events: securityEvents,
    });
    const visitor = createDatabaseLinkSharingVisitor(database, {
      audit,
      rateSecret: "integration-rate-secret",
    });
    const root = { id: documentId, kind: "Document" as const };
    const preview = await founder.preview(accountId, { root });
    const approved = await founder.approve(accountId, {
      approvalId: `approval-${crypto.randomUUID()}`,
      approvedItemIds: (preview?.items ?? []).map((item) => item.itemId),
      liveItemIds: [],
      publishAnyway: true,
      root,
    });
    const token = approved?.accessToken ?? "";
    const surfaceId = approved?.surfaceId ?? "";

    // Expiry (a short one) ends access but not the row.
    await founder.setExpiry(accountId, {
      expiresAt: new Date(current.getTime() + 1500).toISOString(),
      surfaceId,
    });
    const granted = await visitor.exchange({ password: null, signals, token });
    if (granted.status !== "granted") {
      throw new Error("not granted");
    }
    current = new Date(current.getTime() + 3000);
    await new Promise((resolve) => setTimeout(resolve, 1600));
    expect(
      (await visitor.authorize(surfaceId, granted.cookieValue)).status,
    ).toBe("denied");
    expect(await visitor.exchange({ password: null, signals, token })).toEqual({
      status: "denied",
    });
    const [expired] = await database
      .select()
      .from(externalSurface)
      .where(eq(externalSurface.id, surfaceId));
    expect(expired?.cancelledAt).toBeNull();
    expect(expired?.expiresAt).not.toBeNull();

    // Reopen needs the confirmation and readmits the old link.
    await founder.reopen(accountId, {
      confirmOldHoldersRegainAccess: true,
      expiresAt: null,
      surfaceId,
    });
    const reopened = await visitor.exchange({ password: null, signals, token });
    expect(reopened.status).toBe("granted");
    expect(
      (await visitor.authorize(surfaceId, granted.cookieValue)).status,
    ).toBe("denied");

    // Revoke is terminal: gone, sessions removed, same URL never reused.
    const before = { ...expired };
    expect(await founder.revoke(accountId, { surfaceId })).toMatchObject({
      surfaceId,
    });
    expect(await visitor.exchange({ password: null, signals, token })).toEqual({
      status: "gone",
    });
    expect(
      await database
        .select()
        .from(linkShareVisitorSession)
        .where(eq(linkShareVisitorSession.surfaceId, surfaceId)),
    ).toHaveLength(0);

    // A restored row that is still live is cancelled again by replay.
    await database
      .update(externalSurface)
      .set({ accessEpoch: before.accessEpoch ?? 0, cancelledAt: null })
      .where(eq(externalSurface.id, surfaceId));
    await createDatabaseLinkSharingReplay(database, securityEvents).replay();
    const [replayed] = await database
      .select()
      .from(externalSurface)
      .where(eq(externalSurface.id, surfaceId));
    expect(replayed?.cancelledAt).not.toBeNull();
    expect(await visitor.exchange({ password: null, signals, token })).toEqual({
      status: "gone",
    });

    // Denetim kaydı entries landed in the 365-day audit class, secret-free.
    const audited = await database
      .select()
      .from(auditRecord)
      .where(
        and(
          like(auditRecord.type, "link-sharing.%"),
          eq(auditRecord.targetSessionAlias, surfaceId),
        ),
      );
    expect(audited.map((record) => record.type).sort()).toEqual(
      [
        "link-sharing.expiry-changed",
        "link-sharing.share-created",
        "link-sharing.share-reopened",
        "link-sharing.share-revoked",
      ].sort(),
    );
    expect(JSON.stringify(audited)).not.toContain(token);
  });
});
