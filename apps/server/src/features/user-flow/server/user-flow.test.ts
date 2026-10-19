import {
  type ScreenLookup,
  type UserFlowRecord,
  type UserFlowStore,
  userFlowCounts,
  userFlowExportContent,
  userFlowSearchableText,
} from "@cantiara/api/user-flow";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  createUserFlow,
  UserFlowNotFoundError,
  UserFlowProjectNotFoundError,
  UserFlowScreenUnavailableError,
  UserFlowVersionConflictError,
} from "./user-flow";

const ACCOUNT = "account-1";
const PROJECT = "project-1";
const timestamp = "2026-10-01T09:00:00.000Z";

interface MemoryScreen {
  archivedAt: string | null;
  id: string;
  projectId: string;
  redactedAt: string | null;
  title: string;
  trashedAt: string | null;
}

/** In-memory store; records every call so the seam's reach is observable. */
function createMemoryStore() {
  const flows = new Map<string, UserFlowRecord>();
  const versions: Array<{ flowId: string; version: number }> = [];
  const screens = new Map<string, MemoryScreen>();
  const foreignScreens = new Set<string>();
  const writes: string[] = [];
  const store: UserFlowStore = {
    appendVersion: async (accountId, input) => {
      await Promise.resolve();
      const current = flows.get(input.userFlowId);
      if (
        !current ||
        accountId !== ACCOUNT ||
        current.projectId !== input.projectId
      ) {
        return null;
      }
      if (current.version !== input.expectedVersion) {
        throw new UserFlowVersionConflictError(current.id);
      }
      const next: UserFlowRecord = {
        ...current,
        document: input.document,
        updatedAt: timestamp,
        version: current.version + 1,
      };
      flows.set(next.id, next);
      versions.push({ flowId: next.id, version: next.version });
      writes.push("appendVersion");
      return next;
    },
    create: async (accountId, input) => {
      await Promise.resolve();
      if (accountId !== ACCOUNT || input.projectId !== PROJECT) {
        return null;
      }
      const record: UserFlowRecord = {
        createdAt: timestamp,
        document: input.document,
        id: input.id,
        projectId: input.projectId,
        title: input.title,
        updatedAt: timestamp,
        version: 1,
      };
      flows.set(record.id, record);
      versions.push({ flowId: record.id, version: 1 });
      writes.push("create");
      return record;
    },
    find: async (accountId, projectId, userFlowId) => {
      await Promise.resolve();
      const record = flows.get(userFlowId);
      return record && accountId === ACCOUNT && record.projectId === projectId
        ? record
        : null;
    },
    list: async (accountId, projectId) => {
      await Promise.resolve();
      return accountId === ACCOUNT && projectId === PROJECT
        ? [...flows.values()].filter((flow) => flow.projectId === projectId)
        : null;
    },
    listScreens: async (accountId, projectId) => {
      await Promise.resolve();
      if (accountId !== ACCOUNT || projectId !== PROJECT) {
        return null;
      }
      return [...screens.values()]
        .filter(
          (screen) =>
            screen.projectId === projectId &&
            !(screen.archivedAt || screen.trashedAt || screen.redactedAt),
        )
        .map(({ id, title }) => ({ id, title }));
    },
    lookupScreens: async (_accountId, screenIds) => {
      await Promise.resolve();
      const found = new Map<string, ScreenLookup>();
      for (const id of screenIds) {
        const screen = screens.get(id);
        if (foreignScreens.has(id)) {
          found.set(id, { kind: "inaccessible" });
        } else if (screen) {
          found.set(id, { ...screen, kind: "found" });
        }
      }
      return found;
    },
  };
  return {
    addScreen(id: string, title: string, patch: Partial<MemoryScreen> = {}) {
      screens.set(id, {
        archivedAt: null,
        id,
        projectId: PROJECT,
        redactedAt: null,
        title,
        trashedAt: null,
        ...patch,
      });
    },
    foreignScreens,
    screens,
    store,
    versions,
    writes,
  };
}

function setup() {
  const memory = createMemoryStore();
  let sequence = 0;
  const seam = createUserFlow(memory.store, {
    generateId: () => {
      sequence += 1;
      return `generated-${sequence}`;
    },
    now: () => new Date(timestamp),
  });
  memory.addScreen("screen-1", "Checkout");
  memory.addScreen("screen-2", "Receipt");
  return { ...memory, seam };
}

async function flowWithScreenNode(screenId = "screen-1") {
  const ctx = setup();
  const created = await ctx.seam.create(ACCOUNT, {
    projectId: PROJECT,
    title: "Purchase path",
  });
  const placed = await ctx.seam.placeNode(ACCOUNT, {
    expectedVersion: created.version,
    kind: "Screen",
    nodeId: "node-1",
    projectId: PROJECT,
    screenId,
    text: "User pays",
    userFlowId: created.id,
  });
  return { ...ctx, flowId: created.id, placed };
}

describe("User Flow record and versions", () => {
  test("creates a Project-scoped User Flow with an empty versioned document", async () => {
    const { seam, versions } = setup();
    const view = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "  Onboarding  ",
    });
    expect(view).toMatchObject({
      links: [],
      nodes: [],
      projectId: PROJECT,
      title: "Onboarding",
      version: 1,
    });
    expect(versions).toEqual([{ flowId: view.id, version: 1 }]);
  });

  test("an unavailable Project is not found and creates nothing", async () => {
    const { seam, writes } = setup();
    await expect(
      seam.create(ACCOUNT, { projectId: "elsewhere", title: "Flow" }),
    ).rejects.toBeInstanceOf(UserFlowProjectNotFoundError);
    expect(writes).toEqual([]);
  });

  test("saving appends a new version and a stale base is refused", async () => {
    const { seam, versions } = setup();
    const created = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Flow",
    });
    const saved = await seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [
          {
            id: "a",
            kind: "Action",
            position: { x: 1, y: 2 },
            text: "Tap Pay",
          },
        ],
      },
      expectedVersion: 1,
      projectId: PROJECT,
      userFlowId: created.id,
    });
    expect(saved.version).toBe(2);
    expect(versions.filter(({ flowId }) => flowId === created.id)).toEqual([
      { flowId: created.id, version: 1 },
      { flowId: created.id, version: 2 },
    ]);
    await expect(
      seam.save(ACCOUNT, {
        document: { links: [], nodes: [] },
        expectedVersion: 1,
        projectId: PROJECT,
        userFlowId: created.id,
      }),
    ).rejects.toBeInstanceOf(UserFlowVersionConflictError);
  });

  test("an unknown User Flow is not found", async () => {
    const { seam } = setup();
    await expect(seam.get(ACCOUNT, PROJECT, "missing")).rejects.toBeInstanceOf(
      UserFlowNotFoundError,
    );
  });
});

describe("Place node", () => {
  test("defaults to Action so a node lands without a Screen id", async () => {
    const { seam } = setup();
    const created = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Flow",
    });
    const view = await seam.placeNode(ACCOUNT, {
      expectedVersion: 1,
      projectId: PROJECT,
      userFlowId: created.id,
    });
    expect(view.nodes).toHaveLength(1);
    expect(view.nodes[0]).toMatchObject({ kind: "Action", screen: null });
  });

  test("a Screen node requires a Screen id", async () => {
    const { seam } = setup();
    const created = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Flow",
    });
    await expect(
      seam.placeNode(ACCOUNT, {
        expectedVersion: 1,
        kind: "Screen",
        projectId: PROJECT,
        userFlowId: created.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  test("only the closed semantic set is accepted", async () => {
    const { seam } = setup();
    const created = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Flow",
    });
    await Promise.all(
      ["Lifeline", "Process", "Database"].map((kind) =>
        expect(
          seam.placeNode(ACCOUNT, {
            expectedVersion: 1,
            kind: kind as "Action",
            projectId: PROJECT,
            userFlowId: created.id,
          }),
        ).rejects.toBeInstanceOf(ZodError),
      ),
    );
  });

  test("a non-Screen node cannot carry a Screen id", async () => {
    const { seam } = setup();
    const created = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Flow",
    });
    await expect(
      seam.placeNode(ACCOUNT, {
        expectedVersion: 1,
        kind: "Decision",
        projectId: PROJECT,
        screenId: "screen-1",
        userFlowId: created.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  test("a node cannot carry copied Screen content", async () => {
    const { seam } = setup();
    const created = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Flow",
    });
    await expect(
      seam.save(ACCOUNT, {
        document: {
          links: [],
          nodes: [
            {
              id: "a",
              kind: "Screen",
              position: { x: 0, y: 0 },
              screenId: "screen-1",
              screenTitle: "Checkout",
              text: "",
            },
          ],
        },
        expectedVersion: 1,
        projectId: PROJECT,
        userFlowId: created.id,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
  });

  test("placing a Screen node refuses an unavailable, archived or trashed Screen", async () => {
    const ctx = setup();
    ctx.addScreen("screen-archived", "Old", { archivedAt: timestamp });
    ctx.addScreen("screen-trashed", "Gone", { trashedAt: timestamp });
    ctx.addScreen("screen-other-project", "Other", { projectId: "project-2" });
    ctx.foreignScreens.add("screen-foreign");
    const created = await ctx.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Flow",
    });
    await Promise.all(
      [
        "screen-missing",
        "screen-archived",
        "screen-trashed",
        "screen-other-project",
        "screen-foreign",
      ].map((screenId) =>
        expect(
          ctx.seam.placeNode(ACCOUNT, {
            expectedVersion: 1,
            kind: "Screen",
            projectId: PROJECT,
            screenId,
            userFlowId: created.id,
          }),
        ).rejects.toBeInstanceOf(UserFlowScreenUnavailableError),
      ),
    );
    expect((await ctx.seam.get(ACCOUNT, PROJECT, created.id)).version).toBe(1);
  });

  test("the picker lists only active Screens of the Project", async () => {
    const ctx = setup();
    ctx.addScreen("screen-archived", "Old", { archivedAt: timestamp });
    expect(await ctx.seam.screens(ACCOUNT, PROJECT)).toEqual([
      { id: "screen-1", title: "Checkout" },
      { id: "screen-2", title: "Receipt" },
    ]);
  });
});

describe("live Screen references", () => {
  test("a Screen node stores the Screen id as a live reference and copies nothing", async () => {
    const { placed, screens, store, flowId } = await flowWithScreenNode();
    const [node] = placed.nodes;
    expect(node).toMatchObject({
      id: "node-1",
      kind: "Screen",
      screen: {
        broken: null,
        openPath: `/projects/${PROJECT}#screen-screen-1`,
        screenId: "screen-1",
        title: "Checkout",
      },
      text: "User pays",
    });
    expect(screens.size).toBe(2);
    const stored = await store.find(ACCOUNT, PROJECT, flowId);
    expect(stored?.document.nodes[0]).toEqual({
      id: "node-1",
      kind: "Screen",
      placedAt: timestamp,
      position: { x: 0, y: 0 },
      screenId: "screen-1",
      text: "User pays",
    });
  });

  test("flow-specific text stays on the node and never writes the Screen", async () => {
    const { screens, seam, flowId } = await flowWithScreenNode();
    const before = JSON.stringify([...screens.values()]);
    await seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [
          {
            id: "node-1",
            kind: "Screen",
            position: { x: 5, y: 6 },
            screenId: "screen-1",
            text: "If card declined, show the retry state",
          },
        ],
      },
      expectedVersion: 2,
      projectId: PROJECT,
      userFlowId: flowId,
    });
    expect(JSON.stringify([...screens.values()])).toBe(before);
  });

  test("renaming the Screen is seen live; the node stores no title", async () => {
    const { addScreen, seam, flowId } = await flowWithScreenNode();
    addScreen("screen-1", "Checkout v2");
    const view = await seam.get(ACCOUNT, PROJECT, flowId);
    expect(view.nodes[0]?.screen?.title).toBe("Checkout v2");
  });

  test("an Archived Screen shows Archived and still opens its source", async () => {
    const { addScreen, seam, flowId } = await flowWithScreenNode();
    addScreen("screen-1", "Checkout", { archivedAt: timestamp });
    const view = await seam.get(ACCOUNT, PROJECT, flowId);
    expect(view.nodes[0]?.screen).toEqual({
      broken: {
        canOpenSourceRecord: true,
        establishedAt: timestamp,
        reason: "Archived",
      },
      openPath: `/projects/${PROJECT}#screen-screen-1`,
      screenId: "screen-1",
      title: "Checkout",
    });
  });

  test("a trashed Screen is a broken target with no title and can still open its source", async () => {
    const { addScreen, seam, flowId } = await flowWithScreenNode();
    addScreen("screen-1", "Secret title", { trashedAt: timestamp });
    const view = await seam.get(ACCOUNT, PROJECT, flowId);
    expect(view.nodes[0]?.screen).toEqual({
      broken: {
        canOpenSourceRecord: true,
        establishedAt: timestamp,
        reason: "In Trash",
      },
      openPath: `/projects/${PROJECT}#screen-screen-1`,
      screenId: "screen-1",
      title: null,
    });
    expect(JSON.stringify(view)).not.toContain("Secret title");
  });

  test("a permanently deleted Screen is a tombstone and is never retargeted", async () => {
    const { screens, seam, flowId } = await flowWithScreenNode();
    screens.delete("screen-1");
    const view = await seam.get(ACCOUNT, PROJECT, flowId);
    expect(view.nodes[0]?.screen).toEqual({
      broken: {
        canOpenSourceRecord: false,
        establishedAt: timestamp,
        reason: "Permanently deleted",
      },
      openPath: null,
      screenId: "screen-1",
      title: null,
    });
    // The other Screen in the Project is not offered as a replacement.
    expect(JSON.stringify(view)).not.toContain("Receipt");
    expect(view.nodes[0]?.screen?.screenId).toBe("screen-1");
  });

  test("an inaccessible or cross-Project Screen shows No access without a name", async () => {
    const ctx = await flowWithScreenNode();
    ctx.foreignScreens.add("screen-1");
    const foreign = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(foreign.nodes[0]?.screen).toMatchObject({
      broken: { canOpenSourceRecord: false, reason: "No access" },
      openPath: null,
      title: null,
    });
    ctx.foreignScreens.clear();
    ctx.addScreen("screen-1", "Leaky", { projectId: "project-2" });
    const crossProject = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(crossProject.nodes[0]?.screen).toMatchObject({
      broken: { reason: "No access" },
      title: null,
    });
    expect(JSON.stringify(crossProject)).not.toContain("Leaky");
  });

  test("a redacted Screen shows only the redaction reason", async () => {
    const { addScreen, seam, flowId } = await flowWithScreenNode();
    addScreen("screen-1", "Sensitive", { redactedAt: timestamp });
    const view = await seam.get(ACCOUNT, PROJECT, flowId);
    expect(view.nodes[0]?.screen).toMatchObject({
      broken: { canOpenSourceRecord: false, reason: "Redacted for security" },
      openPath: null,
      title: null,
    });
  });

  test("restoring the Screen resolves the same id again", async () => {
    const { addScreen, seam, flowId } = await flowWithScreenNode();
    addScreen("screen-1", "Checkout", { trashedAt: timestamp });
    expect(
      (await seam.get(ACCOUNT, PROJECT, flowId)).nodes[0]?.screen?.broken,
    ).not.toBeNull();
    addScreen("screen-1", "Checkout");
    const restored = await seam.get(ACCOUNT, PROJECT, flowId);
    expect(restored.nodes[0]?.screen).toMatchObject({
      broken: null,
      screenId: "screen-1",
      title: "Checkout",
    });
  });

  test("a flow with a broken target can still be saved without retargeting it", async () => {
    const { addScreen, seam, flowId } = await flowWithScreenNode();
    addScreen("screen-1", "Checkout", { trashedAt: timestamp });
    const saved = await seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [
          {
            id: "node-1",
            kind: "Screen",
            position: { x: 9, y: 9 },
            screenId: "screen-1",
            text: "Still the same path",
          },
        ],
      },
      expectedVersion: 2,
      projectId: PROJECT,
      userFlowId: flowId,
    });
    expect(saved.nodes[0]?.screen?.screenId).toBe("screen-1");
    expect(saved.nodes[0]?.screen?.broken?.reason).toBe("In Trash");
    expect(saved.nodes[0]?.screen?.broken?.establishedAt).toBe(timestamp);
  });
});

describe("broken targets are excluded from derived surfaces", () => {
  test("search text, counts and export carry resolved Screens only", async () => {
    const ctx = await flowWithScreenNode();
    await ctx.seam.placeNode(ACCOUNT, {
      expectedVersion: 2,
      kind: "Screen",
      nodeId: "node-2",
      projectId: PROJECT,
      screenId: "screen-2",
      text: "Receipt shown",
      userFlowId: ctx.flowId,
    });
    const live = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(userFlowSearchableText(live)).toEqual([
      "Purchase path",
      "User pays",
      "Checkout",
      "Receipt shown",
      "Receipt",
    ]);
    expect(userFlowCounts(live)).toEqual({ links: 0, nodes: 2, screens: 2 });

    ctx.addScreen("screen-1", "Checkout", { archivedAt: timestamp });
    ctx.addScreen("screen-2", "Receipt", { trashedAt: timestamp });
    const broken = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(userFlowSearchableText(broken)).toEqual([
      "Purchase path",
      "User pays",
      "Receipt shown",
    ]);
    expect(userFlowCounts(broken)).toEqual({ links: 0, nodes: 2, screens: 0 });
    const exported = JSON.stringify(userFlowExportContent(broken));
    expect(exported).not.toContain("Checkout");
    expect(exported).not.toContain('Receipt"');
    expect(exported).not.toContain("screen-1");
    expect(exported).not.toContain("screen-2");
    expect(exported).toContain("User pays");
  });
});
