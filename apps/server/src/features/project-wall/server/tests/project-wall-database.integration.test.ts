// biome-ignore-all lint/performance/noAwaitInLoops: Seam calls are sequential by design.
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { project } from "@cantiara/db/schema/project";
import {
  projectWall,
  projectWallFocusStep,
  projectWallGroup,
  projectWallItem,
  projectWallLink,
  projectWallViewport,
} from "@cantiara/db/schema/project-wall";
import { workRelation } from "@cantiara/db/schema/relation";
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
import { createDatabaseRelations } from "../../../relations/server/relations";
import {
  ProjectWallCardDuplicateError,
  ProjectWallProjectReadOnlyError,
  ProjectWallSkeletonNotSelectedError,
} from "../project-wall";
import { createDatabaseProjectWall } from "../project-wall-database";

function wallAccess(db: ReturnType<typeof createDb>) {
  return createDatabaseProjectWall(db, createDatabaseRelations(db));
}

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
    const access = wallAccess(requireDatabase());
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
    const access = wallAccess(db);
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
    const access = wallAccess(db);
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
    const access = wallAccess(requireDatabase());
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

  test("a Visual link, group and Lock Position write wall rows and no relation row", async () => {
    const db = requireDatabase();
    const access = wallAccess(db);
    const wall = await access.create(accountId, { projectId, title: "Story" });
    await access.addCard(accountId, {
      projectId,
      sourceId: workId,
      sourceType: "Work",
      wallId: wall.id,
    });
    const placed = await access.addCard(accountId, {
      position: { x: 10, y: 10 },
      projectId,
      sourceId: decisionId,
      sourceType: "Decision",
      wallId: wall.id,
    });
    const [from, to] = placed.cards;
    const base = { projectId, wallId: wall.id };
    const [workBefore] = await db
      .select()
      .from(work)
      .where(eq(work.id, workId));

    await access.drawLink(accountId, {
      ...base,
      fromCardId: from?.id ?? "",
      label: "informs",
      toCardId: to?.id ?? "",
    });
    const grouped = await access.createGroup(accountId, {
      ...base,
      title: "Onboarding",
    });
    await access.setCardGroup(accountId, {
      ...base,
      cardId: from?.id ?? "",
      groupId: grouped.groups[0]?.id ?? "",
    });
    await access.setCardLock(accountId, {
      ...base,
      cardId: from?.id ?? "",
      locked: true,
    });
    const moved = await access.moveCards(accountId, {
      ...base,
      moves: [{ cardId: from?.id ?? "", position: { x: 999, y: 999 } }],
    });

    expect(moved.cards[0]?.position).toEqual({ x: 0, y: 0 });
    expect(moved.cards[0]?.locked).toBe(true);
    expect(moved.links).toHaveLength(1);
    expect(await db.select().from(projectWallLink)).not.toHaveLength(0);
    expect(
      await db
        .select()
        .from(workRelation)
        .where(eq(workRelation.sourceWorkId, workId)),
    ).toEqual([]);
    const [workAfter] = await db.select().from(work).where(eq(work.id, workId));
    expect(workAfter).toEqual(workBefore);

    // Deleting a group keeps its cards; the group row is gone.
    await access.deleteGroup(accountId, {
      ...base,
      groupId: grouped.groups[0]?.id ?? "",
    });
    const after = await access.get(accountId, projectId, wall.id);
    expect(after.cards).toHaveLength(2);
    expect(after.cards[0]?.groupId).toBeNull();
    expect(
      await db
        .select()
        .from(projectWallGroup)
        .where(eq(projectWallGroup.wallId, wall.id)),
    ).toEqual([]);
  });
  test("materializes a selected skeleton as an empty ordinary wall", async () => {
    const db = requireDatabase();
    const access = wallAccess(db);
    const solo = `project-${crypto.randomUUID()}`;
    await db.insert(project).values({
      id: solo,
      name: "Solo",
      shortCode: `PWS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      starterConfiguration: "Solo SaaS",
      workspaceId,
    });

    // The shell records the selection but creates no wall.
    expect(await access.skeletons(accountId, solo)).toEqual([
      "Sitemap",
      "Customer Journey",
    ]);
    expect(await access.list(accountId, solo)).toEqual([]);
    expect(await access.skeletons(accountId, projectId)).toEqual([]);

    const wall = await access.createFromSkeleton(accountId, {
      projectId: solo,
      skeleton: "Customer Journey",
    });
    expect(wall.groups.map(({ title }) => title)).toEqual([
      "Awareness",
      "Consideration",
      "Onboarding",
      "Core Use",
      "Retention",
    ]);
    expect(
      (await access.get(accountId, solo, wall.id)).groups.map(
        ({ title }) => title,
      ),
    ).toEqual(wall.groups.map(({ title }) => title));
    expect(wall.cards).toEqual([]);
    expect(wall.links).toEqual([]);
    expect(
      await db
        .select()
        .from(projectWallItem)
        .where(eq(projectWallItem.wallId, wall.id)),
    ).toEqual([]);

    await expect(
      access.createFromSkeleton(accountId, {
        projectId,
        skeleton: "Sitemap",
      }),
    ).rejects.toBeInstanceOf(ProjectWallSkeletonNotSelectedError);
    expect(await access.list(accountId, projectId)).toEqual([]);
  });

  test("Focus order is wall metadata and a snapshot writes nothing", async () => {
    const db = requireDatabase();
    const access = createDatabaseProjectWall(db, createDatabaseRelations(db), {
      renderer: {
        pdf: () => Promise.resolve(new Uint8Array([1])),
        png: () => Promise.resolve(new Uint8Array([1])),
      },
    });
    const wall = await access.create(accountId, { projectId, title: "Story" });
    await access.addCard(accountId, {
      projectId,
      sourceId: workId,
      sourceType: "Work",
      wallId: wall.id,
    });
    const placed = await access.addCard(accountId, {
      projectId,
      sourceId: decisionId,
      sourceType: "Decision",
      wallId: wall.id,
    });
    const ids = placed.cards.map(({ id }) => id).reverse();
    const [workBefore] = await db
      .select()
      .from(work)
      .where(eq(work.id, workId));

    const ordered = await access.setFocusOrder(accountId, {
      cardIds: ids,
      projectId,
      wallId: wall.id,
    });
    expect(ordered.focusOrder).toEqual(ids);
    expect(
      await db
        .select()
        .from(projectWallFocusStep)
        .where(eq(projectWallFocusStep.wallId, wall.id)),
    ).toHaveLength(2);

    const itemsBefore = await db
      .select()
      .from(projectWallItem)
      .where(eq(projectWallItem.wallId, wall.id));
    await access.exportSnapshot(accountId, {
      cardIds: ids,
      format: "PNG",
      projectId,
      wallId: wall.id,
    });
    expect(
      await db
        .select()
        .from(projectWallItem)
        .where(eq(projectWallItem.wallId, wall.id)),
    ).toEqual(itemsBefore);
    const [workAfter] = await db.select().from(work).where(eq(work.id, workId));
    expect(workAfter).toEqual(workBefore);

    // Removing a card drops its step; clearing leaves no step rows.
    const removed = await access.removeCard(accountId, {
      cardId: ids[0] ?? "",
      projectId,
      wallId: wall.id,
    });
    expect(removed.focusOrder).toEqual([ids[1]]);
    const cleared = await access.setFocusOrder(accountId, {
      cardIds: [],
      projectId,
      wallId: wall.id,
    });
    expect(cleared.focusOrder).toEqual([]);
  });

  test("personal viewport and card order are wall rows outside the wall and sources", async () => {
    const db = requireDatabase();
    const access = wallAccess(db);
    const wall = await access.create(accountId, { projectId, title: "Story" });
    await access.addCard(accountId, {
      projectId,
      sourceId: workId,
      sourceType: "Work",
      wallId: wall.id,
    });
    const view = await access.addCard(accountId, {
      projectId,
      sourceId: decisionId,
      sourceType: "Decision",
      wallId: wall.id,
    });
    const ids = view.cards.map(({ id }) => id);
    // A new card lands on top; reordering rewrites the order only.
    const reordered = await access.reorderCards(accountId, {
      cardIds: [...ids].reverse(),
      projectId,
      wallId: wall.id,
    });
    expect(reordered.cards.map(({ id }) => id)).toEqual([...ids].reverse());

    const [workBefore] = await db
      .select()
      .from(work)
      .where(eq(work.id, workId));
    const [wallBefore] = await db
      .select()
      .from(projectWall)
      .where(eq(projectWall.id, wall.id));
    const saved = {
      center: { x: 10, y: 20 },
      collapsed: [],
      zoom: 0.75,
    };
    await access.saveViewport(accountId, {
      projectId,
      viewport: saved,
      wallId: wall.id,
    });
    expect(await access.viewport(accountId, projectId, wall.id)).toEqual(saved);
    // Not another account's view, not part of the wall or the source.
    await expect(
      access.viewport(otherAccountId, projectId, wall.id),
    ).rejects.toThrow();
    const rows = await db
      .select()
      .from(projectWallViewport)
      .where(eq(projectWallViewport.wallId, wall.id));
    expect(rows.map((row) => row.accountId)).toEqual([accountId]);
    const [wallAfter] = await db
      .select()
      .from(projectWall)
      .where(eq(projectWall.id, wall.id));
    expect(wallAfter).toEqual(wallBefore);
    const [workAfter] = await db.select().from(work).where(eq(work.id, workId));
    expect(workAfter).toEqual(workBefore);

    // Deleting the wall removes the personal viewport with it.
    await access.delete(accountId, projectId, wall.id);
    expect(
      await db
        .select()
        .from(projectWallViewport)
        .where(eq(projectWallViewport.wallId, wall.id)),
    ).toEqual([]);
  });
});
