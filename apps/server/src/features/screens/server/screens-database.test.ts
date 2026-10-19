import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import { screen, screenWireframeVersion } from "@cantiara/db/schema/screen";
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
  ScreenLifecycleInvalidError,
  ScreenProjectNotFoundError,
  ScreenProjectReadOnlyError,
  ScreenRevisionConflictError,
} from "./screens";
import { createDatabaseScreens } from "./screens-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Screens PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `screens-${crypto.randomUUID()}`;
  const otherAccountId = `screens-other-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;
  const archivedProjectId = `project-${crypto.randomUUID()}`;
  const otherProjectId = `project-${crypto.randomUUID()}`;

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
    const base = { starterConfiguration: "Blank Project" as const };
    await db.insert(project).values([
      {
        ...base,
        id: projectId,
        name: "Screens",
        shortCode: `SCR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        workspaceId,
      },
      {
        ...base,
        archivedAt: new Date(),
        id: archivedProjectId,
        name: "Archived",
        shortCode: `ARC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        workspaceId,
      },
      {
        ...base,
        id: otherProjectId,
        name: "Other",
        shortCode: `OTH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        workspaceId: otherWorkspaceId,
      },
    ]);
  });

  afterEach(async () => {
    const db = requireDatabase();
    await db.delete(user).where(eq(user.id, accountId));
    await db.delete(user).where(eq(user.id, otherAccountId));
  });

  afterAll(async () => {
    await database?.$client.end();
  });

  test("creates a Project-scoped Screen from a title alone", async () => {
    const access = createDatabaseScreens(requireDatabase());

    const created = await access.create(accountId, {
      projectId,
      title: "Checkout",
    });

    expect(created).toMatchObject({
      lifecycle: "Active",
      projectId,
      revision: 1,
      title: "Checkout",
      wireframeVersions: [],
    });
    const listed = await access.list(accountId, projectId);
    expect(listed).toMatchObject({ readOnly: false });
    expect(listed.screens.map(({ id }) => id)).toEqual([created.id]);
    await expect(access.list(otherAccountId, projectId)).rejects.toBeInstanceOf(
      ScreenProjectNotFoundError,
    );
    await expect(
      access.create(accountId, { projectId: archivedProjectId, title: "X" }),
    ).rejects.toBeInstanceOf(ScreenProjectReadOnlyError);
  });

  test("keeps exact Wireframe versions on the Screen across archive, trash and restore", async () => {
    const db = requireDatabase();
    const access = createDatabaseScreens(db);
    const created = await access.create(accountId, {
      projectId,
      title: "Home",
    });
    await access.attachWireframeVersion(accountId, projectId, created.id);
    const withVersions = await access.attachWireframeVersion(
      accountId,
      projectId,
      created.id,
    );
    expect(
      withVersions.wireframeVersions.map(({ version }) => version),
    ).toEqual([1, 2]);

    const act = async (
      action: "archive" | "unarchive" | "trash" | "restore",
    ) => {
      const next = await access.setLifecycle(accountId, {
        action,
        projectId,
        screenId: created.id,
      });
      expect(next.id).toBe(created.id);
      expect(next.wireframeVersions).toEqual(withVersions.wireframeVersions);
    };
    await act("archive");
    await act("trash");
    await act("restore");
    await act("unarchive");
    const rows = await db
      .select()
      .from(screenWireframeVersion)
      .where(eq(screenWireframeVersion.screenId, created.id));
    expect(rows).toHaveLength(2);
  });

  test("Move to Trash keeps Archive, Restore returns it, and repeats are no-ops", async () => {
    const access = createDatabaseScreens(requireDatabase());
    const created = await access.create(accountId, {
      projectId,
      title: "Home",
    });
    const act = (action: "archive" | "unarchive" | "trash" | "restore") =>
      access.setLifecycle(accountId, {
        action,
        projectId,
        screenId: created.id,
      });

    expect(await act("archive")).toMatchObject({
      lifecycle: "Archived",
      revision: 2,
    });
    expect(await act("archive")).toMatchObject({ revision: 2 });
    expect(await act("trash")).toMatchObject({
      lifecycle: "In Trash",
      revision: 3,
    });
    await expect(act("unarchive")).rejects.toBeInstanceOf(
      ScreenLifecycleInvalidError,
    );
    expect(await act("restore")).toMatchObject({
      lifecycle: "Archived",
      revision: 4,
    });
    await expect(
      access.setLifecycle(accountId, {
        action: "trash",
        expectedRevision: 1,
        projectId,
        screenId: created.id,
      }),
    ).rejects.toBeInstanceOf(ScreenRevisionConflictError);
  });

  test("a trashed Screen resolves as a broken target and no other Screen is substituted", async () => {
    const access = createDatabaseScreens(requireDatabase());
    const first = await access.create(accountId, { projectId, title: "Same" });
    const second = await access.create(accountId, { projectId, title: "Same" });
    await access.setLifecycle(accountId, {
      action: "trash",
      projectId,
      screenId: first.id,
    });

    expect(
      await access.resolveTarget(accountId, { projectId, screenId: first.id }),
    ).toEqual({ reason: "In Trash", screenId: first.id, state: "broken" });
    expect(
      await access.resolveTarget(accountId, { projectId, screenId: second.id }),
    ).toMatchObject({ screenId: second.id, state: "resolved" });
    // Another Account sees the same id as inaccessible, not as a title.
    expect(
      await access.resolveTarget(otherAccountId, {
        projectId,
        screenId: second.id,
      }),
    ).toEqual({ reason: "No access", screenId: second.id, state: "broken" });
  });

  test("deleting the Project removes Screens and their versions together", async () => {
    const db = requireDatabase();
    const access = createDatabaseScreens(db);
    const created = await access.create(accountId, {
      projectId,
      title: "Home",
    });
    await access.attachWireframeVersion(accountId, projectId, created.id);

    await db.delete(project).where(eq(project.id, projectId));

    expect(
      await db.select().from(screen).where(eq(screen.id, created.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(screenWireframeVersion)
        .where(eq(screenWireframeVersion.screenId, created.id)),
    ).toHaveLength(0);
  });
});
