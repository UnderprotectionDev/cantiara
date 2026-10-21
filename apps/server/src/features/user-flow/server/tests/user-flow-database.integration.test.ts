import type { UserFlowConvertPlan } from "@cantiara/api/user-flow";
import { createDb } from "@cantiara/db";
import { user, workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { project } from "@cantiara/db/schema/project";
import { risk } from "@cantiara/db/schema/risk";
import { screen } from "@cantiara/db/schema/screen";
import {
  userFlowRecordBind,
  userFlowRecordBindRebind,
  userFlowTemplate,
  userFlowViewport,
} from "@cantiara/db/schema/user-flow";
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

import { UserFlowConversionStaleError } from "../user-flow";
import { createDatabaseUserFlow } from "../user-flow-database";

const databaseUrl = process.env.ACCOUNT_ACCESS_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase(
  "User Flow convert, promote and templates (PostgreSQL)",
  () => {
    const database = databaseUrl
      ? createDb({ DATABASE_URL: databaseUrl })
      : undefined;
    const accountId = `uf-${crypto.randomUUID()}`;
    const otherAccountId = `uf-other-${crypto.randomUUID()}`;
    const workspaceId = `workspace-${crypto.randomUUID()}`;
    const otherWorkspaceId = `workspace-${crypto.randomUUID()}`;
    const projectId = `project-${crypto.randomUUID()}`;
    const secondProjectId = `project-${crypto.randomUUID()}`;
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
        {
          email: `${accountId}@example.invalid`,
          id: accountId,
          name: "Founder",
        },
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
          name: "Flows",
          shortCode: `UFA-${code()}`,
          starterConfiguration: "Blank Project",
          workspaceId,
        },
        {
          id: secondProjectId,
          name: "Second",
          shortCode: `UFB-${code()}`,
          starterConfiguration: "Blank Project",
          workspaceId,
        },
        {
          id: otherProjectId,
          name: "Other",
          shortCode: `UFC-${code()}`,
          starterConfiguration: "Blank Project",
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

    async function seeded() {
      const db = requireDatabase();
      const access = createDatabaseUserFlow(db);
      const created = await access.create(accountId, {
        projectId,
        title: "Purchase path",
      });
      const saved = await access.save(accountId, {
        document: {
          links: [],
          nodes: [
            {
              id: "action",
              kind: "Action",
              position: { x: 0, y: 0 },
              text: "Tap Pay\nThe user confirms.",
            },
          ],
        },
        expectedVersion: 1,
        projectId,
        userFlowId: created.id,
      });
      return { access, db, flowId: created.id, saved };
    }

    function confirmation(plan: UserFlowConvertPlan) {
      const id = crypto.randomUUID();
      return {
        baseRevision: 0,
        clientIdempotencyKey: `key-${id}`,
        id,
        nodeId: plan.nodeId,
        plan,
        projectId: plan.projectId,
        recordId: crypto.randomUUID(),
        userFlowId: plan.userFlowId,
      };
    }

    test("Convert and Bind opens one Work with the Origin Location and one bind, and mints no Screen", async () => {
      const { access, db, flowId } = await seeded();
      const plan = await access.previewConvert(accountId, {
        nodeId: "action",
        projectId,
        target: "Work",
        userFlowId: flowId,
      });
      // The preview creates nothing.
      expect(
        await db.select().from(work).where(eq(work.projectId, projectId)),
      ).toEqual([]);

      const command = confirmation(plan);
      const bind = await access.convertNode(accountId, command);
      // A retry with the same identity returns the same record.
      await access.convertNode(accountId, command);

      const works = await db
        .select()
        .from(work)
        .where(eq(work.projectId, projectId));
      expect(works).toHaveLength(1);
      expect(works[0]).toMatchObject({
        description: "Tap Pay\nThe user confirms.",
        id: command.recordId,
        originComponentId: "action",
        originOwnerRecordId: flowId,
        originSourceVersion: "2",
        title: "Tap Pay",
      });
      expect(
        await db
          .select()
          .from(userFlowRecordBind)
          .where(eq(userFlowRecordBind.userFlowId, flowId)),
      ).toHaveLength(1);
      expect(
        await db.select().from(screen).where(eq(screen.projectId, projectId)),
      ).toEqual([]);
      expect(bind.origin).toMatchObject({ flowVersion: 2, nodeId: "action" });
      // The node stays: the flow is still on version 2.
      expect((await access.get(accountId, projectId, flowId)).version).toBe(2);
    });

    test.each([
      ["Decision", decision],
      ["Risk", risk],
      ["Open Question", openQuestion],
    ] as const)(
      "%s opens through the shared conversion insert",
      async (target, table) => {
        const { access, db, flowId } = await seeded();
        const plan = await access.previewConvert(accountId, {
          nodeId: "action",
          projectId,
          target,
          userFlowId: flowId,
        });
        const command = confirmation(plan);
        await access.convertNode(accountId, command);
        const rows = await db
          .select()
          .from(table)
          .where(eq(table.projectId, projectId));
        expect(rows).toHaveLength(1);
        expect(rows[0]?.id).toBe(command.recordId);
      },
    );

    test("a changed flow makes the previewed plan stale and creates nothing", async () => {
      const { access, db, flowId } = await seeded();
      const plan = await access.previewConvert(accountId, {
        nodeId: "action",
        projectId,
        target: "Work",
        userFlowId: flowId,
      });
      await access.save(accountId, {
        document: { links: [], nodes: [] },
        expectedVersion: 2,
        projectId,
        userFlowId: flowId,
      });
      await expect(
        access.convertNode(accountId, confirmation(plan)),
      ).rejects.toBeInstanceOf(UserFlowConversionStaleError);
      expect(
        await db.select().from(work).where(eq(work.projectId, projectId)),
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(userFlowRecordBind)
          .where(eq(userFlowRecordBind.userFlowId, flowId)),
      ).toEqual([]);
    });

    test("a new version never moves the bind; a previewed rebind moves only the bound version", async () => {
      const { access, db, flowId } = await seeded();
      const bind = await access.convertNode(
        accountId,
        confirmation(
          await access.previewConvert(accountId, {
            nodeId: "action",
            projectId,
            target: "Decision",
            userFlowId: flowId,
          }),
        ),
      );
      await access.save(accountId, {
        document: {
          links: [],
          nodes: [
            {
              id: "action",
              kind: "Action",
              position: { x: 0, y: 0 },
              text: "Reworded",
            },
          ],
        },
        expectedVersion: 2,
        projectId,
        userFlowId: flowId,
      });
      const [before] = await access.binds(accountId, projectId, flowId);
      expect(before).toMatchObject({
        boundVersion: 2,
        origin: { node: { text: "Tap Pay\nThe user confirms." } },
        rebindAvailable: true,
      });
      const plan = await access.previewRebind(accountId, {
        bindId: bind.id,
        projectId,
        userFlowId: flowId,
      });
      const moved = await access.rebind(accountId, {
        bindId: bind.id,
        plan,
        projectId,
        userFlowId: flowId,
      });
      expect(moved).toMatchObject({
        boundVersion: 3,
        origin: { flowVersion: 2 },
        rebindAvailable: false,
      });
      const [row] = await db
        .select()
        .from(userFlowRecordBind)
        .where(eq(userFlowRecordBind.id, bind.id));
      expect(row).toMatchObject({ boundVersion: 3, originVersion: 2 });
      expect(
        await db
          .select()
          .from(userFlowRecordBindRebind)
          .where(eq(userFlowRecordBindRebind.bindId, bind.id)),
      ).toHaveLength(1);
    });

    test("Promote to Screen creates one Screen master and links it live", async () => {
      const { access, db, flowId } = await seeded();
      const view = await access.promoteToScreen(accountId, {
        expectedVersion: 2,
        nodeId: "action",
        projectId,
        screen: { mode: "create", title: "Order summary" },
        userFlowId: flowId,
      });
      const screens = await db
        .select()
        .from(screen)
        .where(eq(screen.projectId, projectId));
      expect(screens).toHaveLength(1);
      expect(view.nodes[0]).toMatchObject({
        kind: "Screen",
        screen: { screenId: screens[0]?.id, title: "Order summary" },
      });
    });

    test("templates cross Projects of one Workspace and hold no source Project, Screen or record", async () => {
      const { access, db, flowId } = await seeded();
      const created = await access.promoteToScreen(accountId, {
        expectedVersion: 2,
        nodeId: "action",
        projectId,
        screen: { mode: "create", title: "Order summary" },
        userFlowId: flowId,
      });
      const template = await access.saveTemplate(accountId, {
        name: "Stamp",
        nodeIds: ["action"],
        projectId,
        userFlowId: flowId,
      });
      const [stored] = await db
        .select()
        .from(userFlowTemplate)
        .where(eq(userFlowTemplate.id, template.id));
      const serialized = JSON.stringify(stored);
      expect(serialized).not.toContain(projectId);
      expect(serialized).not.toContain(flowId);
      expect(serialized).not.toContain(
        created.nodes[0]?.screen?.screenId ?? "-",
      );

      const instance = await access.createFromTemplate(accountId, {
        projectId: secondProjectId,
        templateId: template.id,
        title: "Instance",
      });
      expect(instance.projectId).toBe(secondProjectId);
      expect(instance.id).not.toBe(flowId);
      expect(instance.nodes[0]?.id).not.toBe("action");
      expect(instance.nodes[0]?.screen).toBeNull();
      // Another account cannot see or use the template.
      await expect(
        access.createFromTemplate(otherAccountId, {
          projectId: otherProjectId,
          templateId: template.id,
          title: "Stolen",
        }),
      ).rejects.toThrow();
    });

    test("live cards resolve Work, Decision and Risk read-only and treat foreign records as No access", async () => {
      const { access, db, flowId, saved } = await seeded();
      const workId = crypto.randomUUID();
      await db.insert(work).values({
        id: workId,
        key: "UFA-1",
        number: 1,
        projectId,
        title: "Fix pay",
        type: "Task",
      });
      const placed = await access.placeCard(accountId, {
        expectedVersion: saved.version,
        kind: "Work",
        projectId,
        recordId: workId,
        userFlowId: flowId,
      });
      expect(placed.cards[0]?.record).toMatchObject({
        broken: null,
        status: "Not Started",
        title: "Fix pay",
      });
      const [untouched] = await db
        .select()
        .from(work)
        .where(eq(work.id, workId));
      // Moving and removing a card leaves the source Work as it was.
      await access.save(accountId, {
        document: {
          cards: [
            {
              id: placed.cards[0]?.id ?? "",
              kind: "Work",
              position: { x: 50, y: 60 },
              recordId: workId,
            },
          ],
          links: [],
          nodes: [],
        },
        expectedVersion: placed.version,
        projectId,
        userFlowId: flowId,
      });
      const afterMove = await access.get(accountId, projectId, flowId);
      await access.save(accountId, {
        document: { cards: [], links: [], nodes: [] },
        expectedVersion: afterMove.version,
        projectId,
        userFlowId: flowId,
      });
      const [after] = await db.select().from(work).where(eq(work.id, workId));
      expect(after).toEqual(untouched);
    });

    test("the personal viewport upserts per account, writes no version and leaves the flow document alone", async () => {
      const { access, db, flowId, saved } = await seeded();
      const viewport = {
        center: { x: 10, y: 20 },
        collapsed: [],
        zoom: 1.25,
      };
      expect(await access.viewport(accountId, projectId, flowId)).toBeNull();
      await access.saveViewport(accountId, {
        projectId,
        userFlowId: flowId,
        viewport,
      });
      await access.saveViewport(accountId, {
        projectId,
        userFlowId: flowId,
        viewport: { ...viewport, zoom: 2 },
      });
      expect(await access.viewport(accountId, projectId, flowId)).toEqual({
        ...viewport,
        zoom: 2,
      });
      const rows = await db
        .select()
        .from(userFlowViewport)
        .where(eq(userFlowViewport.userFlowId, flowId));
      expect(rows).toHaveLength(1);
      const after = await access.get(accountId, projectId, flowId);
      expect(after.version).toBe(saved.version);
      expect(after.nodes).toEqual(saved.nodes);
      // Another account cannot read or write this flow's viewport.
      await expect(
        access.viewport(otherAccountId, projectId, flowId),
      ).rejects.toThrow();
    });
  },
);
