import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import {
  githubAttentionSignal,
  githubPullRequestCheck,
  githubPullRequestHead,
} from "@cantiara/db/schema/github-integration";
import { project } from "@cantiara/db/schema/project";
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

import { createGitHubAppDouble } from "../github-app-double";
import { createGitHubAppGateway } from "../github-app-gateway";
import {
  createGitHubSecrets,
  parseGitHubKeyRing,
} from "../github-credential-envelope";
import { createDatabaseGitHubIntegration } from "../github-integration-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const HEAD_A = "a".repeat(40);
const HEAD_B = "b".repeat(40);

describeDatabase("GitHub Integration PR check summary PostgreSQL seam", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `github-checks-${suffix}`;
  const workspaceId = `workspace-checks-${suffix}`;
  const projectId = `project-checks-${suffix}`;
  const installationId = 6_000_000 + Math.floor(Math.random() * 100_000);

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  function setup() {
    const app = createGitHubAppDouble();
    app.install(installationId, "acme", [
      { id: 31, name: "web", owner: "acme" },
    ]);
    app.addIssue(installationId, 31, {
      id: 9001,
      number: 5,
      pullRequest: true,
      title: "Retry checkout",
    });
    const github = createDatabaseGitHubIntegration({
      createWork: () => {
        throw new Error("Checks never create Work");
      },
      database: requireDatabase(),
      gateway: createGitHubAppGateway({
        appSlug: "cantiara-test",
        transport: app.transport,
      }),
      secrets: createGitHubSecrets(
        parseGitHubKeyRing(`1:${Buffer.alloc(32, 5).toString("base64")}`, 1),
      ),
    });
    return { app, github };
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
      name: "Checks",
      shortCode: `CK-${suffix.toUpperCase()}`,
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

  test("stores the current head and its checks, supersedes older ones and raises one Action needed signal", async () => {
    const { app, github } = setup();
    app.setPullRequestChecks(installationId, 31, {
      checkRuns: [
        { conclusion: "failure", id: 1, name: "build", required: true },
        { conclusion: "success", id: 2, name: "lint" },
      ],
      headSha: HEAD_A,
      number: 5,
    });
    const { installUrl } = await github.startInstall(accountId, { projectId });
    await github.completeInstall(accountId, {
      installationId,
      state: new URL(installUrl).searchParams.get("state") ?? "",
    });
    const link = await github.linkRepository(accountId, {
      installationId,
      projectId,
      repositoryId: 31,
    });
    const works = await requireDatabase()
      .select()
      .from(work)
      .where(eq(work.projectId, projectId));

    const [pull] = (await github.checks(accountId, { projectId })).pullRequests;
    expect(pull?.headSha).toBe(HEAD_A);
    expect(
      pull?.checks.map((check) => [check.checkId, check.requirement]),
    ).toEqual([
      ["1", "Required"],
      ["2", "Unknown"],
    ]);
    const signals = await github.attentionSignals(accountId, { projectId });
    expect(
      signals.filter((signal) => signal.signalType === "failed-check"),
    ).toHaveLength(1);

    app.setPullRequestChecks(installationId, 31, {
      checkRuns: [{ conclusion: "success", id: 3, name: "build" }],
      headSha: HEAD_B,
      number: 5,
    });
    await github.syncNow(accountId, { linkId: link.id, projectId });
    const [next] = (await github.checks(accountId, { projectId })).pullRequests;
    expect(next?.headSha).toBe(HEAD_B);
    expect(next?.checks.map((check) => check.checkId)).toEqual(["3"]);
    expect(
      await requireDatabase()
        .select()
        .from(githubPullRequestCheck)
        .where(eq(githubPullRequestCheck.projectId, projectId)),
    ).toHaveLength(1);
    expect(
      await requireDatabase()
        .select()
        .from(githubPullRequestHead)
        .where(eq(githubPullRequestHead.projectId, projectId)),
    ).toHaveLength(1);
    const open = (
      await github.attentionSignals(accountId, { projectId })
    ).filter((signal) => signal.signalType === "failed-check");
    expect(open).toHaveLength(0);
    // The signal row is kept as closed, never deleted or re-opened for the old head.
    expect(
      await requireDatabase()
        .select()
        .from(githubAttentionSignal)
        .where(eq(githubAttentionSignal.projectId, projectId)),
    ).toHaveLength(2);
    expect(
      await requireDatabase()
        .select()
        .from(work)
        .where(eq(work.projectId, projectId)),
    ).toEqual(works);
  });
});
