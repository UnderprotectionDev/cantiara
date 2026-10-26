import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { feedback, feedbackWorkOrigin } from "@cantiara/db/schema/feedback";
import { project } from "@cantiara/db/schema/project";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { workRelation } from "@cantiara/db/schema/relation";
import { risk } from "@cantiara/db/schema/risk";
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
import { createGitHubAppGateway } from "../github-app-gateway";
import {
  createGitHubSecrets,
  parseGitHubKeyRing,
} from "../github-credential-envelope";
import { createDatabaseGitHubIntegration } from "../github-integration-database";
import { createGitHubAppDouble } from "./github-app-double";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("GitHub Integration PR Context Card PostgreSQL seam", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const suffix = crypto.randomUUID().slice(0, 8);
  const accountId = `github-context-${suffix}`;
  const workspaceId = `workspace-context-${suffix}`;
  const projectId = `project-context-${suffix}`;
  const workId = `work-context-${suffix}`;
  const installationId = 7_000_000 + Math.floor(Math.random() * 100_000);

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
  }

  function setup() {
    const app = createGitHubAppDouble();
    app.install(installationId, "acme", [
      { id: 41, name: "web", owner: "acme" },
    ]);
    app.addIssue(installationId, 41, {
      body: `Fixes CTX-${suffix.toUpperCase()}-1`,
      id: 9101,
      number: 6,
      pullRequest: true,
      title: "Retry checkout",
    });
    const github = createDatabaseGitHubIntegration({
      createWork: () => {
        throw new Error("The card never creates Work");
      },
      database: requireDatabase(),
      gateway: createGitHubAppGateway({
        appSlug: "cantiara-test",
        transport: app.transport,
      }),
      secrets: createGitHubSecrets(
        parseGitHubKeyRing(`1:${Buffer.alloc(32, 6).toString("base64")}`, 1),
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
      name: "Context",
      shortCode: `CTX-${suffix.toUpperCase()}`,
      starterConfiguration: "Blank Project",
      workspaceId,
    });
    await db.insert(work).values({
      expectedOutcome: "A failed payment retries once.",
      id: workId,
      key: `CTX-${suffix.toUpperCase()}-1`,
      number: 1,
      problemOpportunity: "Checkout drops on a flaky network.",
      projectId,
      title: "Checkout retry",
      type: "Feature",
    });
    await db.insert(decision).values([
      {
        decision: "Retry once",
        id: `decision-${suffix}`,
        projectId,
        title: "Retry once",
      },
    ]);
    await db.insert(risk).values([
      { id: `risk-open-${suffix}`, projectId, title: "Double charge" },
      {
        id: `risk-done-${suffix}`,
        life: "Resolved",
        projectId,
        title: "Old timeout",
      },
    ]);
    await db.insert(feedback).values([
      {
        id: `feedback-${suffix}`,
        occurredAt: new Date("2026-09-01T00:00:00Z"),
        originalMessage: "Lost my cart",
        projectId,
        title: "Lost cart",
      },
      {
        id: `feedback-old-${suffix}`,
        occurredAt: new Date("2026-09-01T00:00:00Z"),
        originalMessage: "Old",
        projectId,
        status: "Archived",
        title: "Archived feedback",
      },
    ]);
    await db.insert(feedbackWorkOrigin).values({
      actorId: accountId,
      feedbackId: `feedback-${suffix}`,
      id: `origin-${suffix}`,
      workId,
    });
    await db.insert(projectRelease).values({
      id: `release-${suffix}`,
      name: "1.4.0",
      projectId,
    });
    const relation = (
      id: string,
      targetRecordType: string,
      targetRecordId: string,
    ) => ({
      id: `rel-${id}-${suffix}`,
      kind: "Related",
      sourceWorkId: workId,
      targetLabel: id,
      targetProjectId: projectId,
      targetRecordId,
      targetRecordType,
    });
    await db
      .insert(workRelation)
      .values([
        relation("decision", "Decision", `decision-${suffix}`),
        relation("risk-open", "Risk", `risk-open-${suffix}`),
        relation("risk-done", "Risk", `risk-done-${suffix}`),
        relation("feedback", "Feedback", `feedback-${suffix}`),
        relation("feedback-old", "Feedback", `feedback-old-${suffix}`),
        relation("release", "Project Release", `release-${suffix}`),
      ]);
  });

  afterEach(async () => {
    await requireDatabase().delete(user).where(eq(user.id, accountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("derives the card from owner rows, opens each record and writes nothing", async () => {
    const { app, github } = setup();
    const { installUrl } = await github.startInstall(accountId, { projectId });
    await github.completeInstall(accountId, {
      installationId,
      state: new URL(installUrl).searchParams.get("state") ?? "",
    });
    await github.linkRepository(accountId, {
      installationId,
      projectId,
      repositoryId: 41,
    });
    app.setPullRequestReviewers(installationId, 41, 6, {
      requested: ["dana"],
      reviews: [{ login: "ali", state: "APPROVED" }],
    });
    const db = requireDatabase();
    const worksBefore = await db.select().from(work);
    const relationsBefore = await db.select().from(workRelation);

    const { cards } = await github.prContext(accountId, { projectId });
    const [card] = cards;
    expect(card?.number).toBe(6);
    expect(card?.roles[0]?.role).toBe("Required for completion");
    expect(card?.problemSources[0]?.text).toBe(
      "Checkout drops on a flaky network.",
    );
    expect(card?.expectedOutcomes[0]?.text).toBe(
      "A failed payment retries once.",
    );
    expect(card?.decisions.map((row) => row.recordId)).toEqual([
      `decision-${suffix}`,
    ]);
    expect(card?.openRisks.map((row) => row.recordId)).toEqual([
      `risk-open-${suffix}`,
    ]);
    // The Feedback is read once although a relation and an Origin link both reach it.
    expect(card?.feedback.map((row) => row.recordId)).toEqual([
      `feedback-${suffix}`,
    ]);
    expect(card?.targetReleases.map((row) => row.recordId)).toEqual([
      `release-${suffix}`,
    ]);
    expect(card?.reviewers.map((row) => [row.login, row.state])).toEqual([
      ["ali", "Approved"],
      ["dana", "Pending"],
    ]);
    expect(await db.select().from(work)).toEqual(worksBefore);
    expect(await db.select().from(workRelation)).toEqual(relationsBefore);
  });
});
