// biome-ignore-all lint/performance/useTopLevelRegex: Inline patterns assert one rendered string each.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { document } from "@cantiara/db/schema/document";
import {
  externalSurface,
  linkShareGateAttempt,
  linkShareVisitorSession,
} from "@cantiara/db/schema/external-surface";
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
import { createDatabaseLinkSharingVisitor } from "../link-sharing-visitor-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const signals = { device: "Browser/1", network: "203.0.113.7" };

describeDatabase("Link Sharing visitor session PostgreSQL", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `share-visitor-${crypto.randomUUID()}`;

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

  test("exchanges the token for a session, stores only hashes and ends sessions on a password change", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Share",
        shortCode: "SHV",
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
    const founder = createDatabaseLinkSharing(database);
    const visitor = createDatabaseLinkSharingVisitor(database, {
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
    expect(token).not.toBe("");

    const [row] = await database
      .select()
      .from(externalSurface)
      .where(eq(externalSurface.id, surfaceId));
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(token);

    const granted = await visitor.exchange({ password: null, signals, token });
    if (granted.status !== "granted") {
      throw new Error("not granted");
    }
    expect(
      (await visitor.authorize(surfaceId, granted.cookieValue))?.manifest.items
        .length,
    ).toBeGreaterThan(0);
    const [session] = await database
      .select()
      .from(linkShareVisitorSession)
      .where(eq(linkShareVisitorSession.surfaceId, surfaceId));
    expect(session?.secretHash).not.toContain(
      granted.cookieValue.split(".")[1] ?? "missing",
    );
    expect(
      (session?.expiresAt.getTime() ?? 0) - (session?.createdAt.getTime() ?? 0),
    ).toBe(12 * 60 * 60 * 1000);

    await founder.setPassword(accountId, {
      password: "correct horse battery",
      surfaceId,
    });
    expect(await visitor.authorize(surfaceId, granted.cookieValue)).toBeNull();
    expect(await visitor.exchange({ password: null, signals, token })).toEqual({
      status: "denied",
    });
    expect(
      await visitor.exchange({ password: "wrong password", signals, token }),
    ).toEqual({ status: "denied" });
    expect(
      await visitor.exchange({
        password: "correct horse battery",
        signals,
        token,
      }),
    ).toMatchObject({ status: "granted" });
    expect(
      await founder.setPassword("someone-else", { password: null, surfaceId }),
    ).toBeNull();

    const attempts = await database.select().from(linkShareGateAttempt);
    for (const attempt of attempts) {
      expect(attempt.key).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
