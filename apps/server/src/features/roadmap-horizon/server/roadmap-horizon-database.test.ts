import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { projectBacklogOrder } from "@cantiara/db/schema/backlog";
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
import { createDatabaseBacklog } from "../../backlog/server/backlog-database";
import { createDatabaseProjectShell } from "../../project-shell/server/project-shell-database";
import { createDatabaseWorkLifecycle } from "../../work-lifecycle/server/work-lifecycle-database";
import { createDatabaseRoadmapHorizon } from "./roadmap-horizon-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Roadmap Horizon PostgreSQL contract", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `roadmap-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;

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
  });
  afterEach(async () => {
    await database?.delete(user).where(eq(user.id, accountId));
  });
  afterAll(async () => {
    await database?.$client.end();
  });

  test("placing Work on Now preserves status, dates, and Backlog manual order", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Roadmap Project",
        shortCode: "RMP",
        starterConfiguration: "Blank Project",
      },
    );
    const ids = [`work-${crypto.randomUUID()}`, `work-${crypto.randomUUID()}`];
    await database.insert(work).values(
      ids.map((id, index) => ({
        id,
        key: `RMP-${index + 1}`,
        number: index + 1,
        projectId: profile.id,
        status: index === 0 ? "Blocked" : "Not Started",
        targetDate: index === 0 ? "2026-11-01" : null,
        title: `Work ${index + 1}`,
        type: "Research",
      })),
    );
    await database.insert(projectBacklogOrder).values({
      projectId: profile.id,
      revision: 1,
      workIds: [ids[1] ?? "", ids[0] ?? ""],
    });
    const lifecycle = createDatabaseWorkLifecycle(database);
    const backlog = createDatabaseBacklog(database);
    const before = await lifecycle.find(accountId, ids[0] ?? "");
    if (!before) {
      throw new Error("Expected Work");
    }
    const saved = await lifecycle.updateRoadmapHorizon(accountId, {
      baseRevision: before.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      horizon: "Now",
      workId: before.id,
    });
    expect(saved.roadmapHorizon).toBe("Now");
    expect(saved.status).toBe("Blocked");
    expect(saved.statusChangedAt).toBe(before.statusChangedAt);
    expect(saved.plannedStartDate).toBeNull();
    expect(saved.targetDate).toBe("2026-11-01");
    expect((await backlog.list(workspaceId, profile.id))?.workIds).toEqual([
      ids[1],
      ids[0],
    ]);
  });

  test("saved view filters remain metadata and cannot create Work membership", async () => {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    const profile = await createDatabaseProjectShell(database).create(
      accountId,
      {
        name: "Views Project",
        shortCode: "VWS",
        starterConfiguration: "Blank Project",
      },
    );
    const roadmap = createDatabaseRoadmapHorizon(database);
    const saved = await roadmap.saveView(accountId, {
      groupBy: "Horizon",
      horizons: ["Next"],
      markBy: "Type",
      name: "Research direction",
      projectId: profile.id,
      types: ["Research"],
    });
    expect(saved?.name).toBe("Research direction");
    expect(await roadmap.listViews(accountId, profile.id)).toEqual([saved]);
    expect(await roadmap.listViews("another-account", profile.id)).toBeNull();
  });
});
