import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
} from "@cantiara/api/wireframe-document";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { project } from "@cantiara/db/schema/project";
import {
  screen,
  screenBlockOrigin,
  screenWireframeVersion,
} from "@cantiara/db/schema/screen";
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

import { ScreenConversionStaleError } from "./screens";
import { createDatabaseScreens } from "./screens-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("Convert and Bind PostgreSQL integration", () => {
  const database = databaseUrl
    ? createDb({ DATABASE_URL: databaseUrl })
    : undefined;
  const accountId = `origins-${crypto.randomUUID()}`;
  const workspaceId = `workspace-${crypto.randomUUID()}`;
  const projectId = `project-${crypto.randomUUID()}`;

  function requireDatabase() {
    if (!database) {
      throw new Error("ACCOUNT_ACCESS_DATABASE_URL is required");
    }
    return database;
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
      name: "Origins",
      shortCode: `ORG-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
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

  async function screenWithBlock() {
    const access = createDatabaseScreens(requireDatabase());
    const created = await access.create(accountId, {
      projectId,
      title: "Pricing",
    });
    const original = {
      ...createEmptyWireframeDocument(),
      blocks: [
        {
          ...createWireframeBlock("Button", "b-cta", { x: 20, y: 20 }),
          label: "Start trial",
        },
      ],
    };
    await access.saveWireframe(accountId, {
      document: original,
      projectId,
      screenId: created.id,
    });
    return { access, created, original };
  }

  test("a preview writes nothing and confirm creates one record and one origin", async () => {
    const db = requireDatabase();
    const { access, created } = await screenWithBlock();
    const input = {
      blockId: "b-cta",
      projectId,
      screenId: created.id,
      targetType: "Decision" as const,
      wireframeVersion: 1,
    };

    const plan = await access.previewConvertAndBind(accountId, input);
    expect(await db.select().from(decision)).toHaveLength(0);
    expect(await db.select().from(screenBlockOrigin)).toHaveLength(0);

    const view = await access.convertAndBind(accountId, {
      originId: crypto.randomUUID(),
      plan,
      projectId,
      recordId: crypto.randomUUID(),
      screenId: created.id,
    });

    expect(await db.select().from(decision)).toHaveLength(1);
    expect(await db.select().from(screen)).toHaveLength(1);
    expect(view.location).toMatchObject({
      blockId: "b-cta",
      ownerScreenId: created.id,
      state: "resolved",
      wireframeVersion: 1,
    });
  });

  test("Work gets Project key allocation and keeps owned-component provenance", async () => {
    const db = requireDatabase();
    const { access, created } = await screenWithBlock();
    const plan = await access.previewConvertAndBind(accountId, {
      blockId: "b-cta",
      projectId,
      screenId: created.id,
      targetType: "Work",
      wireframeVersion: 1,
      workType: "Task",
    });
    await access.convertAndBind(accountId, {
      originId: crypto.randomUUID(),
      plan,
      projectId,
      recordId: crypto.randomUUID(),
      screenId: created.id,
    });
    const [row] = await db.select().from(work);
    expect(row).toMatchObject({
      originComponentId: "b-cta",
      originOwnerRecordId: created.id,
      originSourceVersion: "1",
    });
  });

  test("deleting the source block keeps the record; the bound version stays exact", async () => {
    const db = requireDatabase();
    const { access, created, original } = await screenWithBlock();
    const plan = await access.previewConvertAndBind(accountId, {
      blockId: "b-cta",
      projectId,
      screenId: created.id,
      targetType: "Decision",
      wireframeVersion: 1,
    });
    await access.convertAndBind(accountId, {
      originId: crypto.randomUUID(),
      plan,
      projectId,
      recordId: crypto.randomUUID(),
      screenId: created.id,
    });

    // The geometry save opens version 2 because version 1 is named by an origin.
    const saved = await access.saveWireframe(accountId, {
      document: applyWireframeTransaction(original, [
        { blockId: "b-cta", type: "removeBlock" },
      ]),
      projectId,
      screenId: created.id,
    });
    expect(saved.version).toBe(2);
    const versions = await db.select().from(screenWireframeVersion);
    expect(versions.map(({ version }) => version).sort()).toEqual([1, 2]);

    expect(await db.select().from(decision)).toHaveLength(1);
    const [view] = await access.origins(accountId, {
      projectId,
      screenId: created.id,
    });
    expect(view?.location).toMatchObject({
      label: "Kaynak öğe artık yok",
      state: "gone",
      wireframeVersion: 1,
    });
    expect(view?.target.title).toBe("Start trial");
  });

  test("an edited block makes the preview stale and creates nothing", async () => {
    const db = requireDatabase();
    const { access, created, original } = await screenWithBlock();
    const plan = await access.previewConvertAndBind(accountId, {
      blockId: "b-cta",
      projectId,
      screenId: created.id,
      targetType: "Decision",
      wireframeVersion: 1,
    });
    await access.saveWireframe(accountId, {
      document: applyWireframeTransaction(original, [
        { blockId: "b-cta", label: "Renamed", type: "setLabel" },
      ]),
      projectId,
      screenId: created.id,
    });
    await expect(
      access.convertAndBind(accountId, {
        originId: crypto.randomUUID(),
        plan,
        projectId,
        recordId: crypto.randomUUID(),
        screenId: created.id,
      }),
    ).rejects.toBeInstanceOf(ScreenConversionStaleError);
    expect(await db.select().from(decision)).toHaveLength(0);
  });

  test("a retry with the same identity returns the same origin and one record", async () => {
    const db = requireDatabase();
    const { access, created } = await screenWithBlock();
    const plan = await access.previewConvertAndBind(accountId, {
      blockId: "b-cta",
      projectId,
      screenId: created.id,
      targetType: "Risk",
      wireframeVersion: 1,
    });
    const input = {
      originId: crypto.randomUUID(),
      plan,
      projectId,
      recordId: crypto.randomUUID(),
      screenId: created.id,
    };
    await access.convertAndBind(accountId, input);
    await access.convertAndBind(accountId, input);
    expect(await db.select().from(screenBlockOrigin)).toHaveLength(1);
  });
});
