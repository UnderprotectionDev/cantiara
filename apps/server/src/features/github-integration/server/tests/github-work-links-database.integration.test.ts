import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  githubAttentionSignal,
  githubExternalRecord,
  githubWorkLink,
} from "@cantiara/db/schema/github-integration";
import { project } from "@cantiara/db/schema/project";
import { work, workRetiredIdentity } from "@cantiara/db/schema/work";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import { createGitHubAppDouble } from "../github-app-double";
import { createGitHubAppGateway } from "../github-app-gateway";
import {
  createGitHubSecrets,
  parseGitHubKeyRing,
} from "../github-credential-envelope";
import { createDatabaseGitHubIntegration } from "../github-integration-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("GitHub Integration Work links PostgreSQL seam", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `github-links-${suffix}`;
  const workspaceId = `workspace-links-${suffix}`;
  const projectId = `project-links-${suffix}`;
  const shortCode = `GL-${suffix.toUpperCase()}`;
  const installationId = 5_000_000 + Math.floor(Math.random() * 100_000);

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  function setup() {
    const app = createGitHubAppDouble();
    app.install(installationId, "acme", [
      { id: 21, name: "web", owner: "acme" },
    ]);
    const github = createDatabaseGitHubIntegration({
      // Stands in for the server root's Work-owner insert (same columns, same key rule).
      createWork: async (executor, owner, input) => {
        const number = owner.workCount + 1;
        const key = `${owner.shortCode}-${number}`;
        await executor
          .update(project)
          .set({ workCount: number })
          .where(eq(project.id, owner.id));
        await executor.insert(work).values({
          description: input.description,
          id: input.workId,
          key,
          number,
          originOwnerRecordId: input.originRecordId,
          projectId: owner.id,
          title: input.title,
          type: input.type,
        });
        return key;
      },
      database: requireDatabase(),
      gateway: createGitHubAppGateway({
        appSlug: "cantiara-test",
        transport: app.transport,
      }),
      secrets: createGitHubSecrets(
        parseGitHubKeyRing(`1:${Buffer.alloc(32, 4).toString("base64")}`, 1),
      ),
    });
    return { app, github };
  }

  async function addWork(number: number, title: string, id = `w${number}`) {
    await requireDatabase()
      .insert(work)
      .values({
        id: `${id}-${suffix}`,
        key: `${shortCode}-${number}`,
        number,
        projectId,
        title,
        type: "Task",
      });
    return `${id}-${suffix}`;
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values({
      email: `${accountId}@example.invalid`,
      id: accountId,
      name: "Founder",
    });
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      name: "Links",
      shortCode,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
  });

  afterEach(async () => {
    await requireDatabase().delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  async function connect(github: ReturnType<typeof setup>["github"]) {
    const { installUrl } = await github.startInstall(accountId, { projectId });
    await github.completeInstall(accountId, {
      installationId,
      state: new URL(installUrl).searchParams.get("state") ?? "",
    });
    return await github.linkRepository(accountId, {
      installationId,
      projectId,
      repositoryId: 21,
    });
  }

  test("maps roles, keeps Work untouched and dedupes the unlinked signal", async () => {
    const { app, github } = setup();
    const workId = await addWork(1, "Checkout");
    await addWork(2, "Layout");
    app.addIssue(installationId, 21, {
      body: `Fixes ${shortCode}-1`,
      id: 8001,
      number: 1,
      pullRequest: true,
      title: "Closing PR",
    });
    app.addIssue(installationId, 21, {
      id: 8002,
      number: 2,
      pullRequest: true,
      title: `Context ${shortCode}-2`,
    });
    app.addIssue(installationId, 21, {
      id: 8003,
      number: 3,
      pullRequest: true,
      title: "Nobody links this",
    });
    const repository = await connect(github);
    const before = await requireDatabase().select().from(work);

    const { links } = await github.workLinks(accountId, { projectId });
    expect(
      links.map((link) => `${link.number}:${link.workKey}:${link.role}`).sort(),
    ).toEqual([
      `1:${shortCode}-1:Required for completion`,
      `2:${shortCode}-2:Contextual`,
    ]);

    // Same records read again: the unlinked signal stays one row.
    await github.syncNow(accountId, { linkId: repository.id, projectId });
    const signals = await github.attentionSignals(accountId, { projectId });
    await github.attentionSignals(accountId, { projectId });
    expect(signals.map((signal) => signal.record.number)).toEqual([3]);
    expect(
      await requireDatabase()
        .select()
        .from(githubAttentionSignal)
        .where(eq(githubAttentionSignal.projectId, projectId)),
    ).toHaveLength(1);
    expect(await requireDatabase().select().from(work)).toEqual(before);

    // Completed Work + open PR: a neutral signal, no Work write.
    await requireDatabase()
      .update(work)
      .set({ closureResult: "Completed", status: "Closed" })
      .where(eq(work.id, workId));
    const afterComplete = await requireDatabase().select().from(work);
    const conflict = await github.attentionSignals(accountId, { projectId });
    expect(conflict.map((signal) => signal.signalType).sort()).toEqual([
      "unlinked-open-pr",
      "work-pr-status-conflict",
    ]);
    expect(await requireDatabase().select().from(work)).toEqual(afterComplete);
  });

  test("a retired Work key matches the surviving Work and a second key only suggests", async () => {
    const { app, github } = setup();
    const survivor = await addWork(5, "Survivor");
    await requireDatabase()
      .insert(workRetiredIdentity)
      .values({
        id: `retired-${suffix}`,
        key: `${shortCode}-3`,
        mergeId: `merge-${suffix}`,
        projectId,
        survivingWorkId: survivor,
      });
    app.addIssue(installationId, 21, {
      body: `Closes ${shortCode}-3`,
      id: 8010,
      number: 10,
      pullRequest: true,
      title: "Old key",
    });
    app.addIssue(installationId, 21, {
      body: `Closes ${shortCode}-5 and ${shortCode}-77`,
      id: 8011,
      number: 11,
      pullRequest: true,
      title: "Two keys",
    });
    await connect(github);
    const { links, suggestions } = await github.workLinks(accountId, {
      projectId,
    });
    expect(links).toMatchObject([
      {
        matchedKey: `${shortCode}-3`,
        role: "Required for completion",
        workKey: `${shortCode}-5`,
      },
    ]);
    expect(suggestions.map((suggestion) => suggestion.reason).sort()).toEqual([
      "Multiple Work keys",
      "No Work with this key",
    ]);
  });

  test("Create work and link makes one Work through the key allocation; the closed catalog holds in SQL", async () => {
    const { app, github } = setup();
    app.addIssue(installationId, 21, { id: 8020, number: 20, title: "Idea" });
    await connect(github);
    const [record] = await requireDatabase()
      .select()
      .from(githubExternalRecord)
      .where(eq(githubExternalRecord.projectId, projectId));
    const created = await github.createWorkAndLink(accountId, {
      description: "",
      projectId,
      recordId: record?.id ?? "",
      title: "Idea work",
      type: "Task",
    });
    expect(created.work).toMatchObject({
      key: `${shortCode}-1`,
      status: "Not Started",
    });
    expect(created.link).toMatchObject({
      origin: "Create work and link",
      role: "Contextual",
    });
    // Required for completion on an Issue row is refused by the table itself.
    await expect(
      requireDatabase()
        .insert(githubWorkLink)
        .values({
          id: `bad-${suffix}`,
          kind: "Issue",
          origin: "Manual",
          projectId,
          recordId: record?.id,
          repositoryLinkId: record?.linkId ?? "",
          role: "Required for completion",
          targetKey: `bad-${suffix}`,
          workId: created.work.id,
        }),
    ).rejects.toThrow();
  });
});
