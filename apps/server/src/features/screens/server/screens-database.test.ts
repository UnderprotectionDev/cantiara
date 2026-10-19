import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
} from "@cantiara/api/wireframe-document";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { project } from "@cantiara/db/schema/project";
import {
  screen,
  screenViewport,
  screenWireframeVersion,
} from "@cantiara/db/schema/screen";
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
  ScreenNotFoundError,
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

  test("persists the WireframeDocument as version content and saves in place", async () => {
    const access = createDatabaseScreens(requireDatabase());
    const created = await access.create(accountId, {
      projectId,
      title: "Home",
    });
    const document = {
      ...createEmptyWireframeDocument(),
      blocks: [createWireframeBlock("Button", "b1", { x: 8, y: 8 })],
    };

    const first = await access.saveWireframe(accountId, {
      document,
      projectId,
      screenId: created.id,
    });
    const moved = await access.saveWireframe(accountId, {
      document: {
        ...document,
        blocks: [createWireframeBlock("Button", "b1", { x: 40, y: 8 })],
      },
      projectId,
      screenId: created.id,
    });

    expect(first.version).toBe(1);
    expect(moved.version).toBe(1);
    const reread = await access.wireframe(accountId, {
      projectId,
      screenId: created.id,
    });
    expect(reread.document.blocks[0]).toMatchObject({ x: 40 });
    // A geometry write adds no version and leaves the Screen row untouched.
    const list = await access.list(accountId, projectId);
    expect(list.screens[0]).toMatchObject({ revision: 1 });
    expect(list.screens[0]?.wireframeVersions).toHaveLength(1);
  });

  test("rejects Konva JSON and keeps nothing", async () => {
    const access = createDatabaseScreens(requireDatabase());
    const created = await access.create(accountId, {
      projectId,
      title: "Home",
    });

    await expect(
      access.saveWireframe(accountId, {
        document: { attrs: {}, children: [], className: "Stage" },
        projectId,
        screenId: created.id,
      }),
    ).rejects.toMatchObject({ code: "KONVA_JSON_REJECTED" });
    const rows = await requireDatabase()
      .select()
      .from(screenWireframeVersion)
      .where(eq(screenWireframeVersion.screenId, created.id));
    expect(rows).toHaveLength(0);
  });

  test("applies a linked block change to affected Screens as new versions", async () => {
    const access = createDatabaseScreens(requireDatabase());
    const content = {
      height: 56,
      kind: "Navigation" as const,
      label: "Header",
      props: { items: ["Home"] },
      width: 560,
    };
    const definition = await access.createLinkedBlock(accountId, {
      content,
      name: "Header",
      projectId,
    });
    const home = await access.create(accountId, { projectId, title: "Home" });
    const linked = applyWireframeTransaction(
      {
        ...createEmptyWireframeDocument(),
        blocks: [createWireframeBlock("Navigation", "nav", { x: 0, y: 0 })],
      },
      [
        {
          blockId: "nav",
          definition: {
            content: definition.content,
            id: definition.id,
            name: definition.name,
            revision: definition.revision,
          },
          type: "linkBlock",
        },
      ],
    );
    await access.saveWireframe(accountId, {
      document: linked,
      projectId,
      screenId: home.id,
    });

    const change = {
      content: { ...content, label: "Main" },
      definitionId: definition.id,
      projectId,
    };
    const preview = await access.previewLinkedBlockChange(accountId, change);
    expect(preview.affectedScreens.map(({ screenId }) => screenId)).toEqual([
      home.id,
    ]);
    expect(
      (await access.list(accountId, projectId)).screens[0]?.wireframeVersions,
    ).toHaveLength(1);

    await access.applyLinkedBlockChange(accountId, change);
    const [record] = (await access.list(accountId, projectId)).screens;
    expect(record?.wireframeVersions.map(({ version }) => version)).toEqual([
      1, 2,
    ]);
    await expect(
      access.applyLinkedBlockChange(accountId, {
        ...change,
        expectedRevision: 1,
      }),
    ).rejects.toBeInstanceOf(ScreenRevisionConflictError);
  });

  test("keeps a personal viewport per account and Screen without touching Wireframe versions", async () => {
    const db = requireDatabase();
    const access = createDatabaseScreens(db);
    const created = await access.create(accountId, {
      projectId,
      title: "Home",
    });
    await access.saveWireframe(accountId, {
      document: createEmptyWireframeDocument(),
      projectId,
      screenId: created.id,
    });
    const versionsBefore = await db
      .select()
      .from(screenWireframeVersion)
      .where(eq(screenWireframeVersion.screenId, created.id));
    const viewport = {
      centerX: 12.5,
      centerY: -40,
      collapsedGroups: ["Card"],
      zoom: 2,
    };

    expect(
      await access.viewport(accountId, { projectId, screenId: created.id }),
    ).toEqual({ viewport: null });
    await access.saveViewport(accountId, {
      projectId,
      screenId: created.id,
      viewport,
    });
    await access.saveViewport(accountId, {
      projectId,
      screenId: created.id,
      viewport: { ...viewport, zoom: 0.5 },
    });

    expect(
      await access.viewport(accountId, { projectId, screenId: created.id }),
    ).toEqual({ viewport: { ...viewport, zoom: 0.5 } });
    expect(
      await db
        .select()
        .from(screenViewport)
        .where(eq(screenViewport.screenId, created.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(screenWireframeVersion)
        .where(eq(screenWireframeVersion.screenId, created.id)),
    ).toEqual(versionsBefore);
    await expect(
      access.viewport(otherAccountId, { projectId, screenId: created.id }),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
    // The view follows the Screen: deleting the Project removes it with it.
    await db.delete(project).where(eq(project.id, projectId));
    expect(
      await db
        .select()
        .from(screenViewport)
        .where(eq(screenViewport.screenId, created.id)),
    ).toHaveLength(0);
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
