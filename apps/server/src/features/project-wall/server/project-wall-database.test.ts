// biome-ignore-all lint/performance/noAwaitInLoops: Seam calls are sequential by design.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { project } from "@cantiara/db/schema/project";
import { projectWallItem } from "@cantiara/db/schema/project-wall";
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

import {
  ProjectWallCardDuplicateError,
  ProjectWallProjectReadOnlyError,
} from "./project-wall";
import { createDatabaseProjectWall } from "./project-wall-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Project Wall (PostgreSQL)", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `pw-${crypto.randomUUID()}`;
  const otherAccountId = `pw-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const archivedProjectId = `project-${crypto.randomUUID()}`;
  const otherProjectId = `project-${crypto.randomUUID()}`;
  const workId = `work-${crypto.randomUUID()}`;
  const decisionId = `decision-${crypto.randomUUID()}`;

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
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
    await db.insert(workspace).values([
      { id: workspaceId, ownerAccountId: accountId },
      { id: otherWorkspaceId, ownerAccountId: otherAccountId },
    ]);
    const code = () => crypto.randomUUID().slice(0, 8).toUpperCase();
    await db.insert(project).values([
      {
        id: projectId,
        name: "Walls",
        shortCode: `PWA-${code()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        archivedAt: new Date(),
        id: archivedProjectId,
        name: "Archived",
        shortCode: `PWB-${code()}`,
        starterConfiguration: "Blank Project",
        workspaceId,
      },
      {
        id: otherProjectId,
        name: "Other",
        shortCode: `PWC-${code()}`,
        starterConfiguration: "Blank Project",
        workspaceId: otherWorkspaceId,
      },
    ]);
    await db.insert(work).values({
      id: workId,
      key: "PWA-1",
      number: 1,
      projectId,
      title: "Ship onboarding",
      type: "Task",
    });
    await db.insert(decision).values({
      decision: "Walls never nest.",
      id: decisionId,
      projectId,
      title: "Flat walls",
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

  test("live card identity equals the source id and the same record sits on many walls", async () => {
    const access = createDatabaseProjectWall(requireDatabase());
    const first = await access.create(accountId, { projectId, title: "One" });
    const second = await access.create(accountId, { projectId, title: "Two" });
    for (const wall of [first, second]) {
      await access.addCard(accountId, {
        projectId,
        sourceId: workId,
        sourceType: "Work",
        wallId: wall.id,
      });
    }
    for (const wall of [first, second]) {
      const view = await access.get(accountId, projectId, wall.id);
      expect(view.cards).toHaveLength(1);
      expect(view.cards[0]?.source).toMatchObject({
        broken: null,
        recordId: workId,
        status: "Not Started",
        title: "Ship onboarding",
      });
      expect(view.cards[0]?.fields.map(({ name }) => name)).toEqual([
        "Key",
        "Status",
        "Type",
      ]);
    }
    // No copy record: the Project still holds exactly the one Work.
    const works = await requireDatabase()
      .select({ id: work.id })
      .from(work)
      .where(eq(work.projectId, projectId));
    expect(works).toHaveLength(1);
    await expect(
      access.addCard(accountId, {
        projectId,
        sourceId: workId,
        sourceType: "Work",
        wallId: first.id,
      }),
    ).rejects.toBeInstanceOf(ProjectWallCardDuplicateError);
  });

  test("move, density and highlight write wall rows and never the source", async () => {
    const db = requireDatabase();
    const access = createDatabaseProjectWall(db);
    const wall = await access.create(accountId, { projectId, title: "Story" });
    const view = await access.addCard(accountId, {
      projectId,
      sourceId: workId,
      sourceType: "Work",
      wallId: wall.id,
    });
    const cardId = view.cards[0]?.id ?? "";
    const [before] = await db.select().from(work).where(eq(work.id, workId));

    await access.moveCards(accountId, {
      moves: [{ cardId, position: { x: 120.5, y: -40 } }],
      projectId,
      wallId: wall.id,
    });
    await access.setCardDensity(accountId, {
      cardId,
      density: "Detailed",
      projectId,
      wallId: wall.id,
    });
    await access.setCardHighlight(accountId, {
      cardId,
      highlight: "green",
      projectId,
      wallId: wall.id,
    });

    const [after] = await db.select().from(work).where(eq(work.id, workId));
    expect(after).toEqual(before);
    const [row] = await db
      .select()
      .from(projectWallItem)
      .where(eq(projectWallItem.id, cardId));
    expect(row).toMatchObject({
      density: "Detailed",
      highlight: "green",
      positionX: 120.5,
      positionY: -40,
      sourceId: workId,
    });
  });

  test("deleting a wall removes only wall rows", async () => {
    const db = requireDatabase();
    const access = createDatabaseProjectWall(db);
    const wall = await access.create(accountId, { projectId, title: "Gone" });
    await access.addCard(accountId, {
      projectId,
      sourceId: decisionId,
      sourceType: "Decision",
      wallId: wall.id,
    });
    await access.delete(accountId, projectId, wall.id);
    expect(await access.list(accountId, projectId)).toEqual([]);
    const sources = await db
      .select({ id: decision.id })
      .from(decision)
      .where(eq(decision.id, decisionId));
    expect(sources).toHaveLength(1);
  });

  test("another account and an archived Project cannot use a wall", async () => {
    const access = createDatabaseProjectWall(requireDatabase());
    const wall = await access.create(accountId, { projectId, title: "Mine" });
    await expect(
      access.get(otherAccountId, projectId, wall.id),
    ).rejects.toMatchObject({ code: "PROJECT_WALL_NOT_FOUND" });
    await expect(
      access.addCard(otherAccountId, {
        projectId: otherProjectId,
        sourceId: workId,
        sourceType: "Work",
        wallId: wall.id,
      }),
    ).rejects.toMatchObject({ code: "PROJECT_WALL_NOT_FOUND" });
    await expect(
      access.create(accountId, { projectId: archivedProjectId, title: "No" }),
    ).rejects.toBeInstanceOf(ProjectWallProjectReadOnlyError);
  });
});
