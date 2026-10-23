import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  githubExternalRecord,
  githubInstallationCredential,
} from "@cantiara/db/schema/github-integration";
import { project } from "@cantiara/db/schema/project";
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

describeDatabase("GitHub Integration PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `github-${suffix}`;
  const otherAccountId = `github-other-${suffix}`;
  const workspaceId = `workspace-${suffix}`;
  const projectId = `project-${suffix}`;
  const installationId = 4_000_000 + Math.floor(Math.random() * 100_000);

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  function setup() {
    const app = createGitHubAppDouble();
    app.install(installationId, "acme", [
      { id: 11, name: "web", owner: "acme" },
    ]);
    app.addIssue(installationId, 11, {
      id: 7001,
      number: 1,
      title: "Checkout fails",
    });
    const github = createDatabaseGitHubIntegration({
      database: requireDatabase(),
      gateway: createGitHubAppGateway({
        appSlug: "cantiara-test",
        transport: app.transport,
      }),
      secrets: createGitHubSecrets(
        parseGitHubKeyRing(`1:${Buffer.alloc(32, 3).toString("base64")}`, 1),
      ),
    });
    return { app, github };
  }

  beforeEach(async () => {
    const db = requireDatabase();
    await db.insert(user).values([
      { email: `${accountId}@example.invalid`, id: accountId, name: "Founder" },
      {
        email: `${otherAccountId}@example.invalid`,
        id: otherAccountId,
        name: "Other",
      },
    ]);
    await db
      .insert(workspace)
      .values({ id: workspaceId, ownerAccountId: accountId });
    await db.insert(project).values({
      id: projectId,
      name: "GitHub",
      shortCode: `GH-${suffix.toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
  });

  afterEach(async () => {
    const db = requireDatabase();
    await db.delete(user).where(eq(user.id, accountId));
    await db.delete(user).where(eq(user.id, otherAccountId));
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
      repositoryId: 11,
    });
  }

  test("links by stable id, keeps renames, stores only sealed credentials and records", async () => {
    const { app, github } = setup();
    const link = await connect(github);
    expect(link).toMatchObject({ connection: "Connected", repositoryId: 11 });

    app.renameRepository(installationId, 11, { name: "site", owner: "new-co" });
    const again = await github.linkRepository(accountId, {
      installationId,
      projectId,
      repositoryId: 11,
    });
    expect(again.id).toBe(link.id);
    expect(again.previousNames).toMatchObject([{ name: "web", owner: "acme" }]);

    const credentials = await requireDatabase()
      .select()
      .from(githubInstallationCredential);
    expect(credentials.length).toBeGreaterThan(0);
    expect(JSON.stringify(credentials)).not.toContain("ghs_double");

    const records = await requireDatabase()
      .select()
      .from(githubExternalRecord)
      .where(eq(githubExternalRecord.projectId, projectId));
    expect(records.map((record) => record.title)).toEqual(["Checkout fails"]);
  });

  test("uninstall stops the link and keeps its records; another account sees nothing", async () => {
    const { app, github } = setup();
    const link = await connect(github);
    app.uninstall(installationId);
    await github.recordInstallationRemoved(installationId);
    const overview = await github.overview(accountId, projectId);
    expect(overview.links[0]).toMatchObject({
      connection: "Disconnected",
      externalRecordCount: 1,
      id: link.id,
      stopReason: "App uninstalled",
    });
    await expect(
      github.overview(otherAccountId, projectId),
    ).rejects.toMatchObject({ code: "GITHUB_PROJECT_NOT_FOUND" });
  });

  test("two accounts completing the same installation cannot both claim it", async () => {
    const { github } = setup();
    const db = requireDatabase();
    const otherProjectId = `project-other-${suffix}`;
    await db.insert(workspace).values({
      id: `workspace-other-${suffix}`,
      ownerAccountId: otherAccountId,
    });
    await db.insert(project).values({
      id: otherProjectId,
      name: "GitHub",
      shortCode: `GH-O${suffix.toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId: `workspace-other-${suffix}`,
    });
    const attempts = await Promise.allSettled(
      (
        [
          [accountId, projectId],
          [otherAccountId, otherProjectId],
        ] as const
      ).map(async ([attempter, targetProject]) => {
        const { installUrl } = await github.startInstall(attempter, {
          projectId: targetProject,
        });
        return await github.completeInstall(attempter, {
          installationId,
          state: new URL(installUrl).searchParams.get("state") ?? "",
        });
      }),
    );
    expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(
      rejected && "reason" in rejected ? (rejected.reason as Error) : null,
    ).toMatchObject({ code: "GITHUB_INSTALLATION_CLAIMED" });
  });
});
