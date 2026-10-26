import {
  resolveUserFlowViewport,
  USER_FLOW_LINK_LIMIT,
  USER_FLOW_NODE_LIMIT,
  USER_FLOW_NODE_TONES,
  USER_FLOW_VISIBLE_ITEM_LIMIT,
  type UserFlowConvertPlan,
  type UserFlowViewport,
  userFlowCounts,
  userFlowExportContent,
  userFlowSearchableText,
} from "@cantiara/api/user-flow";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";
import {
  createUserFlow,
  UserFlowBindNotFoundError,
  UserFlowConversionStaleError,
  UserFlowNodeNotFoundError,
  UserFlowNodeNotPromotableError,
  UserFlowNotFoundError,
  UserFlowProjectNotFoundError,
  UserFlowRebindNotNeededError,
  UserFlowRebindStaleError,
  UserFlowRecordUnavailableError,
  UserFlowSceneLimitError,
  UserFlowScreenUnavailableError,
  UserFlowTemplateNotFoundError,
  UserFlowVersionConflictError,
} from "../user-flow";
import {
  ACCOUNT,
  createMemoryStore,
  PROJECT,
  PROJECT_B,
  timestamp,
} from "./user-flow-test-support";

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
      sectionId: null,
      style: "default",
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

describe("closed semantic set and node style", () => {
  const FOREIGN_KINDS = [
    "Lifeline",
    "Message",
    "Activation",
    "Fragment",
    "Participant",
    "Process",
    "Terminator",
    "Database",
    "Note",
    "Moodboard",
    "Wall",
    "State",
    "Transition",
    "screen",
    "",
  ];

  async function emptyFlow() {
    const ctx = setup();
    const created = await ctx.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Flow",
    });
    return { ...ctx, flowId: created.id };
  }

  test("a kind outside the set is rejected on save and never persisted", async () => {
    const ctx = await emptyFlow();
    const before = ctx.writes.length;
    await Promise.all(
      FOREIGN_KINDS.map((kind) =>
        expect(
          ctx.seam.save(ACCOUNT, {
            document: {
              links: [],
              nodes: [{ id: "a", kind: kind as "Action", text: "x" }],
            },
            expectedVersion: 1,
            projectId: PROJECT,
            userFlowId: ctx.flowId,
          }),
        ).rejects.toBeInstanceOf(ZodError),
      ),
    );
    expect(ctx.writes).toHaveLength(before);
    const flow = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(flow.version).toBe(1);
    expect(flow.nodes).toEqual([]);
  });

  test("a document mixing valid and foreign kinds is rejected as a whole", async () => {
    const ctx = await emptyFlow();
    await expect(
      ctx.seam.save(ACCOUNT, {
        document: {
          links: [],
          nodes: [
            { id: "a", kind: "Action" },
            { id: "b", kind: "Lifeline" as "Action" },
          ],
        },
        expectedVersion: 1,
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(ctx.writes).not.toContain("appendVersion");
  });

  test("the five set kinds are saved and read back unchanged", async () => {
    const ctx = await emptyFlow();
    const saved = await ctx.seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [
          { id: "a", kind: "Action" },
          { id: "d", kind: "Decision" },
          { id: "o", kind: "State/Outcome" },
          { id: "s", kind: "Section" },
          { id: "c", kind: "Screen", screenId: "screen-1" },
        ],
      },
      expectedVersion: 1,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(saved.nodes.map(({ kind }) => kind)).toEqual([
      "Action",
      "Decision",
      "State/Outcome",
      "Section",
      "Screen",
    ]);
  });

  test("shape, colour and free type fields are not accepted on a node", async () => {
    const ctx = await emptyFlow();
    const extras = [
      { shape: "diamond" },
      { color: "#ff0000" },
      { type: "Lifeline" },
      { style: { shape: "diamond" } },
      { style: { color: "#ff0000" } },
      { style: "hotpink" },
    ];
    await Promise.all(
      extras.map((extra) =>
        expect(
          ctx.seam.save(ACCOUNT, {
            document: {
              links: [],
              nodes: [{ id: "a", kind: "Action", ...extra }],
            },
            expectedVersion: 1,
            projectId: PROJECT,
            userFlowId: ctx.flowId,
          } as never),
        ).rejects.toBeInstanceOf(ZodError),
      ),
    );
    expect(ctx.writes).not.toContain("appendVersion");
  });

  test("a node style is a fixed palette tone and never changes the kind", async () => {
    const ctx = await emptyFlow();
    const saved = await ctx.seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: USER_FLOW_NODE_TONES.map((tone, index) => ({
          id: `n-${index}`,
          kind: "Decision" as const,
          style: tone,
        })),
      },
      expectedVersion: 1,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(saved.nodes.map(({ style }) => style)).toEqual([
      ...USER_FLOW_NODE_TONES,
    ]);
    expect(saved.nodes.every(({ kind }) => kind === "Decision")).toBe(true);
  });

  test("a node without a style reads as the default tone", async () => {
    const ctx = await emptyFlow();
    const saved = await ctx.seam.save(ACCOUNT, {
      document: { links: [], nodes: [{ id: "a", kind: "Action" }] },
      expectedVersion: 1,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(saved.nodes[0]?.style).toBe("default");
  });

  test("style does not enter search or counts", async () => {
    const ctx = await emptyFlow();
    const saved = await ctx.seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [{ id: "a", kind: "Action", style: "red", text: "Pay" }],
      },
      expectedVersion: 1,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(userFlowSearchableText(saved)).toEqual(["Flow", "Pay"]);
    expect(userFlowCounts(saved)).toEqual({ links: 0, nodes: 1, screens: 0 });
  });
});

function setupUserFlowConvert() {
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
  memory.addRecord("Work", "work-1", "Fix the pay button", {
    status: "Not Started",
  });
  memory.addRecord("Decision", "decision-1", "Use one-tap pay");
  memory.addRecord("Risk", "risk-1", "Payments provider outage");
  return { ...memory, seam };
}

/** A flow at version 2: a Screen node, an Action node and a link between them. */
async function seededFlow() {
  const ctx = setupUserFlowConvert();
  const created = await ctx.seam.create(ACCOUNT, {
    projectId: PROJECT,
    title: "Purchase path",
  });
  const saved = await ctx.seam.save(ACCOUNT, {
    document: {
      links: [{ from: "screen-node", id: "link-a", text: "pay", to: "action" }],
      nodes: [
        {
          id: "screen-node",
          kind: "Screen",
          position: { x: 0, y: 0 },
          screenId: "screen-1",
          text: "Cart is shown",
        },
        {
          id: "action",
          kind: "Action",
          position: { x: 300, y: 0 },
          text: "Tap Pay\nThe user confirms the order total.",
        },
      ],
    },
    expectedVersion: 1,
    projectId: PROJECT,
    userFlowId: created.id,
  });
  return { ...ctx, flow: saved, flowId: created.id };
}

let commandSequence = 0;
function confirmation(plan: UserFlowConvertPlan) {
  commandSequence += 1;
  return {
    baseRevision: 0,
    clientIdempotencyKey: `key-${commandSequence}`,
    id: `bind-${commandSequence}`,
    nodeId: plan.nodeId,
    plan,
    projectId: plan.projectId,
    recordId: `record-${commandSequence}`,
    userFlowId: plan.userFlowId,
  };
}

async function preview(
  ctx: Awaited<ReturnType<typeof seededFlow>>,
  target: "Decision" | "Open Question" | "Risk" | "Work" = "Work",
  nodeId = "action",
) {
  return await ctx.seam.previewConvert(ACCOUNT, {
    nodeId,
    projectId: PROJECT,
    target,
    userFlowId: ctx.flowId,
  });
}

describe("Convert and Bind preview", () => {
  test("previews exactly one record with the title/body map, Origin and Origin Location, and writes nothing", async () => {
    const ctx = await seededFlow();
    const writesBefore = [...ctx.writes];
    const plan = await preview(ctx);
    expect(plan).toEqual({
      createsScreen: false,
      nodeId: "action",
      originLocation: {
        flowVersion: 2,
        nodeId: "action",
        userFlowId: ctx.flowId,
      },
      projectId: PROJECT,
      record: {
        body: "Tap Pay\nThe user confirms the order total.",
        title: "Tap Pay",
        type: "Work",
        workType: "Task",
      },
      recordCount: 1,
      relation: "Origin",
      targetProject: { id: PROJECT, name: "Cantiara" },
      userFlowId: ctx.flowId,
    });
    expect(ctx.writes).toEqual(writesBefore);
    expect(ctx.created).toEqual([]);
    expect(ctx.binds.size).toBe(0);
  });

  test("a node without text still maps to a titled record", async () => {
    const ctx = await seededFlow();
    const placed = await ctx.seam.placeNode(ACCOUNT, {
      expectedVersion: 2,
      nodeId: "blank",
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    const plan = await ctx.seam.previewConvert(ACCOUNT, {
      nodeId: "blank",
      projectId: PROJECT,
      target: "Risk",
      userFlowId: placed.id,
    });
    expect(plan.record).toEqual({
      body: "Action node of Purchase path",
      title: "Action node of Purchase path",
      type: "Risk",
      workType: null,
    });
  });

  test("a node outside the exact current version has no preview", async () => {
    const ctx = await seededFlow();
    await expect(preview(ctx, "Work", "missing")).rejects.toBeInstanceOf(
      UserFlowNodeNotFoundError,
    );
  });

  test("Screen and every other target are rejected", async () => {
    const ctx = await seededFlow();
    await Promise.all(
      ["Screen", "Assumption", "Milestone", "Wireframe"].map((target) =>
        expect(
          ctx.seam.previewConvert(ACCOUNT, {
            nodeId: "action",
            projectId: PROJECT,
            target: target as "Work",
            userFlowId: ctx.flowId,
          }),
        ).rejects.toBeInstanceOf(ZodError),
      ),
    );
    const plan = await preview(ctx);
    await expect(
      ctx.seam.convertNode(ACCOUNT, {
        ...confirmation(plan),
        plan: {
          ...plan,
          record: { ...plan.record, type: "Screen" as "Work" },
        },
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(ctx.created).toEqual([]);
    expect(ctx.calls).not.toContain("createScreen");
  });
});

describe("Convert and Bind confirmation", () => {
  test("confirming creates exactly one record, keeps the node and never mints a Screen", async () => {
    const ctx = await seededFlow();
    const screensBefore = [...ctx.screens.keys()];
    const documentBefore = structuredClone(ctx.flows.get(ctx.flowId));
    const plan = await preview(ctx);
    const bind = await ctx.seam.convertNode(ACCOUNT, confirmation(plan));

    expect(ctx.created).toHaveLength(1);
    expect(ctx.created[0]).toMatchObject({
      body: "Tap Pay\nThe user confirms the order total.",
      origin: {
        componentId: "action",
        ownerRecordId: ctx.flowId,
        sourceVersion: "2",
      },
      title: "Tap Pay",
      type: "Work",
      workType: "Task",
    });
    // The node stays as it was, is not a relation endpoint and keeps its semantics.
    expect(ctx.flows.get(ctx.flowId)).toEqual(documentBefore);
    expect(ctx.flows.get(ctx.flowId)?.document.links).toHaveLength(1);
    expect(
      ctx.versions.filter(({ flowId }) => flowId === ctx.flowId),
    ).toHaveLength(2);
    // No Screen is minted.
    expect([...ctx.screens.keys()]).toEqual(screensBefore);
    expect(ctx.calls).not.toContain("createScreen");
    expect(bind).toMatchObject({
      boundVersion: 2,
      origin: {
        flowVersion: 2,
        node: { kind: "Action" },
        nodeId: "action",
        userFlowId: ctx.flowId,
      },
      rebindAvailable: false,
      record: { broken: null, kind: "Work", title: "Tap Pay" },
    });
  });

  test("a Screen node can be converted; it stays a Screen node with its live reference", async () => {
    const ctx = await seededFlow();
    const plan = await preview(ctx, "Decision", "screen-node");
    await ctx.seam.convertNode(ACCOUNT, confirmation(plan));
    const view = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(view.nodes.find(({ id }) => id === "screen-node")).toMatchObject({
      kind: "Screen",
      screen: { screenId: "screen-1" },
    });
    expect(ctx.created.map(({ type }) => type)).toEqual(["Decision"]);
  });

  test.each(["Decision", "Risk", "Open Question"] as const)(
    "%s binds stay on the exact node version when a new flow version is saved",
    async (target) => {
      const ctx = await seededFlow();
      const plan = await preview(ctx, target);
      await ctx.seam.convertNode(ACCOUNT, confirmation(plan));
      await ctx.seam.save(ACCOUNT, {
        document: {
          links: [],
          nodes: [
            {
              id: "action",
              kind: "Action",
              position: { x: 0, y: 0 },
              text: "Tap Pay, reworded",
            },
          ],
        },
        expectedVersion: 2,
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      });
      const [bind] = await ctx.seam.binds(ACCOUNT, PROJECT, ctx.flowId);
      expect(bind).toMatchObject({
        boundVersion: 2,
        node: { text: "Tap Pay\nThe user confirms the order total." },
        origin: { flowVersion: 2, nodeId: "action" },
        rebindAvailable: true,
      });
      expect(ctx.rebinds).toEqual([]);
    },
  );

  test("a changed node makes the previewed plan stale and creates nothing", async () => {
    const ctx = await seededFlow();
    const plan = await preview(ctx);
    await ctx.seam.save(ACCOUNT, {
      document: { links: [], nodes: [] },
      expectedVersion: 2,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    await expect(
      ctx.seam.convertNode(ACCOUNT, confirmation(plan)),
    ).rejects.toBeInstanceOf(UserFlowConversionStaleError);
    expect(ctx.created).toEqual([]);
    expect(ctx.recordWrites).toEqual([]);
  });

  test("a hand-edited plan is not the previewed plan", async () => {
    const ctx = await seededFlow();
    const plan = await preview(ctx);
    await expect(
      ctx.seam.convertNode(
        ACCOUNT,
        confirmation({
          ...plan,
          record: { ...plan.record, title: "Something else" },
        }),
      ),
    ).rejects.toBeInstanceOf(UserFlowConversionStaleError);
    expect(ctx.created).toEqual([]);
  });

  test("retrying one confirmation creates the record once", async () => {
    const ctx = await seededFlow();
    const command = confirmation(await preview(ctx));
    await ctx.seam.convertNode(ACCOUNT, command);
    await ctx.seam.convertNode(ACCOUNT, command);
    expect(ctx.created).toHaveLength(1);
  });
});

describe("Origin Location and rebind", () => {
  async function boundAtVersionTwo() {
    const ctx = await seededFlow();
    const bind = await ctx.seam.convertNode(
      ACCOUNT,
      confirmation(await preview(ctx, "Decision")),
    );
    await ctx.seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [
          {
            id: "action",
            kind: "Action",
            position: { x: 0, y: 0 },
            text: "Tap Pay, reworded",
          },
        ],
      },
      expectedVersion: 2,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    return { ...ctx, bind };
  }

  test("a new flow version never moves the bind and the old origin stays readable", async () => {
    const ctx = await boundAtVersionTwo();
    const [bind] = await ctx.seam.binds(ACCOUNT, PROJECT, ctx.flowId);
    expect(bind?.boundVersion).toBe(2);
    expect(bind?.origin).toEqual({
      flowVersion: 2,
      node: {
        kind: "Action",
        text: "Tap Pay\nThe user confirms the order total.",
      },
      nodeId: "action",
      userFlowId: ctx.flowId,
    });
  });

  test("rebind needs a preview and moves only the bound version; the Origin Location stays", async () => {
    const ctx = await boundAtVersionTwo();
    const plan = await ctx.seam.previewRebind(ACCOUNT, {
      bindId: ctx.bind.id,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(plan).toMatchObject({
      fromVersion: 2,
      originLocation: { flowVersion: 2, nodeId: "action" },
      toVersion: 3,
    });
    // The preview itself writes nothing.
    expect(ctx.rebinds).toEqual([]);
    const moved = await ctx.seam.rebind(ACCOUNT, {
      bindId: ctx.bind.id,
      plan,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(moved).toMatchObject({
      boundVersion: 3,
      node: { text: "Tap Pay, reworded" },
      origin: { flowVersion: 2 },
      rebindAvailable: false,
    });
    expect(ctx.binds.get(ctx.bind.id)?.originVersion).toBe(2);
    expect(ctx.rebinds).toEqual([{ bindId: ctx.bind.id, from: 2, to: 3 }]);
  });

  test("an invented or outdated rebind plan is refused", async () => {
    const ctx = await boundAtVersionTwo();
    const plan = await ctx.seam.previewRebind(ACCOUNT, {
      bindId: ctx.bind.id,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    await expect(
      ctx.seam.rebind(ACCOUNT, {
        bindId: ctx.bind.id,
        plan: { ...plan, toVersion: 9 },
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(UserFlowRebindStaleError);
    await ctx.seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [
          {
            id: "action",
            kind: "Action",
            position: { x: 0, y: 0 },
            text: "Newest",
          },
        ],
      },
      expectedVersion: 3,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    await expect(
      ctx.seam.rebind(ACCOUNT, {
        bindId: ctx.bind.id,
        plan,
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(UserFlowRebindStaleError);
    expect(ctx.rebinds).toEqual([]);
  });

  test("a bind already on the current version has nothing to rebind", async () => {
    const ctx = await seededFlow();
    const bind = await ctx.seam.convertNode(
      ACCOUNT,
      confirmation(await preview(ctx)),
    );
    await expect(
      ctx.seam.previewRebind(ACCOUNT, {
        bindId: bind.id,
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(UserFlowRebindNotNeededError);
    await expect(
      ctx.seam.previewRebind(ACCOUNT, {
        bindId: "missing",
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(UserFlowBindNotFoundError);
  });

  test("a bind whose node left the new version cannot be rebound", async () => {
    const ctx = await seededFlow();
    const bind = await ctx.seam.convertNode(
      ACCOUNT,
      confirmation(await preview(ctx)),
    );
    await ctx.seam.save(ACCOUNT, {
      document: { links: [], nodes: [] },
      expectedVersion: 2,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    const [view] = await ctx.seam.binds(ACCOUNT, PROJECT, ctx.flowId);
    expect(view).toMatchObject({
      node: { kind: "Action" },
      rebindAvailable: false,
    });
    await expect(
      ctx.seam.previewRebind(ACCOUNT, {
        bindId: bind.id,
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(UserFlowRebindNotNeededError);
  });
});

describe("Promote to Screen", () => {
  test("links an existing Screen as a live reference and creates no Screen", async () => {
    const ctx = await seededFlow();
    const view = await ctx.seam.promoteToScreen(ACCOUNT, {
      expectedVersion: 2,
      nodeId: "action",
      projectId: PROJECT,
      screen: { mode: "link", screenId: "screen-2" },
      userFlowId: ctx.flowId,
    });
    expect(view.nodes.find(({ id }) => id === "action")).toMatchObject({
      kind: "Screen",
      screen: { screenId: "screen-2", title: "Receipt" },
      text: "Tap Pay\nThe user confirms the order total.",
    });
    expect(ctx.calls).not.toContain("createScreen");
    expect([...ctx.screens.keys()]).toEqual(["screen-1", "screen-2"]);
    // The node holds the id only; no title or body of the Screen is copied.
    expect(
      JSON.stringify(ctx.flows.get(ctx.flowId)?.document.nodes[1]),
    ).not.toContain("Receipt");
  });

  test("creates exactly one Screen master when asked to, and links it live", async () => {
    const ctx = await seededFlow();
    const view = await ctx.seam.promoteToScreen(ACCOUNT, {
      expectedVersion: 2,
      nodeId: "action",
      projectId: PROJECT,
      screen: { mode: "create", title: "Order summary" },
      userFlowId: ctx.flowId,
    });
    expect(ctx.writes.filter((write) => write === "createScreen")).toHaveLength(
      1,
    );
    expect(ctx.screens.size).toBe(3);
    const node = view.nodes.find(({ id }) => id === "action");
    expect(node?.kind).toBe("Screen");
    expect(node?.screen?.title).toBe("Order summary");
    expect(ctx.screens.has(node?.screen?.screenId ?? "")).toBe(true);
  });

  test("a node that already references a Screen is not promoted again, and a trashed Screen is not linked", async () => {
    const ctx = await seededFlow();
    await expect(
      ctx.seam.promoteToScreen(ACCOUNT, {
        expectedVersion: 2,
        nodeId: "screen-node",
        projectId: PROJECT,
        screen: { mode: "create", title: "A copy" },
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(UserFlowNodeNotPromotableError);
    ctx.addScreen("screen-trash", "Gone", { trashedAt: timestamp });
    await expect(
      ctx.seam.promoteToScreen(ACCOUNT, {
        expectedVersion: 2,
        nodeId: "action",
        projectId: PROJECT,
        screen: { mode: "link", screenId: "screen-trash" },
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(UserFlowScreenUnavailableError);
    expect(ctx.calls).not.toContain("createScreen");
  });
});

describe("read-only live cards", () => {
  async function withCard() {
    const ctx = await seededFlow();
    const placed = await ctx.seam.placeCard(ACCOUNT, {
      expectedVersion: 2,
      kind: "Work",
      projectId: PROJECT,
      recordId: "work-1",
      userFlowId: ctx.flowId,
    });
    return { ...ctx, placed };
  }

  test("a card shows the live record and stores only its id", async () => {
    const { placed, flows, flowId } = await withCard();
    expect(placed.cards).toHaveLength(1);
    expect(placed.cards[0]?.record).toMatchObject({
      broken: null,
      kind: "Work",
      recordId: "work-1",
      status: "Not Started",
      title: "Fix the pay button",
    });
    expect(JSON.stringify(flows.get(flowId)?.document.cards)).not.toContain(
      "Fix the pay button",
    );
  });

  test("moving and removing a card never writes the source record", async () => {
    const ctx = await withCard();
    const recordsBefore = structuredClone([...ctx.records.entries()]);
    const callsBefore = ctx.calls.length;
    const [card] = ctx.placed.cards;
    const nodes = ctx.placed.nodes.map((node) => ({
      id: node.id,
      kind: node.kind,
      position: node.position,
      screenId: node.screen?.screenId ?? null,
      text: node.text,
    }));
    const moved = await ctx.seam.save(ACCOUNT, {
      document: {
        cards: [
          {
            id: card?.id ?? "",
            kind: "Work",
            position: { x: 640, y: 320 },
            recordId: "work-1",
          },
        ],
        links: ctx.placed.links,
        nodes,
      },
      expectedVersion: ctx.placed.version,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(moved.cards[0]?.position).toEqual({ x: 640, y: 320 });
    const removed = await ctx.seam.save(ACCOUNT, {
      document: { cards: [], links: moved.links, nodes },
      expectedVersion: moved.version,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(removed.cards).toEqual([]);

    expect(ctx.recordWrites).toEqual([]);
    expect([...ctx.records.entries()]).toEqual(recordsBefore);
    // Only the flow's own versions are written; the only record access is a read.
    const used = new Set(ctx.calls.slice(callsBefore));
    expect([...used].sort()).toEqual(
      ["appendVersion", "find", "lookupRecords", "lookupScreens"].filter(
        (call) => used.has(call),
      ),
    );
    for (const forbidden of ["convertNode", "createScreen", "createTemplate"]) {
      expect(used.has(forbidden)).toBe(false);
    }
  });

  test("a save that omits cards keeps them", async () => {
    const ctx = await withCard();
    const kept = await ctx.seam.save(ACCOUNT, {
      document: { links: [], nodes: [] },
      expectedVersion: ctx.placed.version,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(kept.cards).toHaveLength(1);
  });

  test("a deleted or foreign record is a broken target without a title", async () => {
    const ctx = await withCard();
    ctx.records.delete("Work:work-1");
    const view = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(view.cards[0]?.record).toMatchObject({
      broken: { reason: "Permanently deleted" },
      openPath: null,
      status: null,
      title: null,
    });
    ctx.addRecord("Work", "work-1", "Elsewhere", { projectId: PROJECT_B });
    const foreign = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(foreign.cards[0]?.record).toMatchObject({
      broken: { reason: "No access" },
      title: null,
    });
  });

  test("an archived record is shown as Archived and still opens", async () => {
    const ctx = await withCard();
    ctx.addRecord("Work", "work-1", "Fix the pay button", { archived: true });
    const view = await ctx.seam.get(ACCOUNT, PROJECT, ctx.flowId);
    expect(view.cards[0]?.record).toMatchObject({
      broken: { canOpenSourceRecord: true, reason: "Archived" },
      title: "Fix the pay button",
    });
    expect(view.cards[0]?.record.openPath).toContain("work-work-1");
  });

  test("a card needs an active record of this Project", async () => {
    const ctx = await seededFlow();
    ctx.addRecord("Risk", "risk-other", "Other", { projectId: PROJECT_B });
    ctx.addRecord("Risk", "risk-archived", "Old", { archived: true });
    await Promise.all(
      ["risk-other", "risk-archived", "risk-missing"].map((recordId) =>
        expect(
          ctx.seam.placeCard(ACCOUNT, {
            expectedVersion: 2,
            kind: "Risk",
            projectId: PROJECT,
            recordId,
            userFlowId: ctx.flowId,
          }),
        ).rejects.toBeInstanceOf(UserFlowRecordUnavailableError),
      ),
    );
    await expect(
      ctx.seam.placeCard(ACCOUNT, {
        expectedVersion: 2,
        kind: "Milestone" as "Risk",
        projectId: PROJECT,
        recordId: "risk-1",
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });

  test("the picker lists active Work, Decision and Risk", async () => {
    const ctx = await seededFlow();
    const options = await ctx.seam.cardRecords(ACCOUNT, PROJECT);
    expect(options.map(({ id }) => id).sort()).toEqual([
      "decision-1",
      "risk-1",
      "work-1",
    ]);
  });
});

describe("custom templates", () => {
  async function savedTemplate() {
    const ctx = await seededFlow();
    // A bind and a card exist on the source; the template must carry neither.
    await ctx.seam.convertNode(ACCOUNT, confirmation(await preview(ctx)));
    await ctx.seam.placeCard(ACCOUNT, {
      expectedVersion: 2,
      kind: "Work",
      projectId: PROJECT,
      recordId: "work-1",
      userFlowId: ctx.flowId,
    });
    const template = await ctx.seam.saveTemplate(ACCOUNT, {
      name: "Checkout skeleton",
      nodeIds: ["screen-node", "action"],
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    return { ...ctx, template };
  }

  test("saves selected structure and placeholders only", async () => {
    const { template, flowId } = await savedTemplate();
    expect(template.structure).toEqual({
      links: [{ from: "node-1", id: "link-1", text: "pay", to: "node-2" }],
      nodes: [
        {
          id: "node-1",
          kind: "Screen",
          position: { x: 0, y: 0 },
          style: "default",
          text: "Cart is shown",
        },
        {
          id: "node-2",
          kind: "Action",
          position: { x: 300, y: 0 },
          style: "default",
          text: "Tap Pay\nThe user confirms the order total.",
        },
      ],
    });
    const serialized = JSON.stringify(template);
    for (const forbidden of [
      "screen-1",
      "screenId",
      PROJECT,
      flowId,
      "screen-node",
      "work-1",
      "decision-1",
      "cards",
      "bind",
      "version",
      "placedAt",
      "record",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test("only the selected nodes and the links between them are kept", async () => {
    const ctx = await seededFlow();
    const template = await ctx.seam.saveTemplate(ACCOUNT, {
      name: "One step",
      nodeIds: ["action"],
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(template.structure.nodes).toHaveLength(1);
    expect(template.structure.links).toEqual([]);
    await expect(
      ctx.seam.saveTemplate(ACCOUNT, {
        name: "Nothing",
        nodeIds: [],
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      ctx.seam.saveTemplate(ACCOUNT, {
        name: "Ghost",
        nodeIds: ["ghost"],
        projectId: PROJECT,
        userFlowId: ctx.flowId,
      }),
    ).rejects.toBeInstanceOf(UserFlowNodeNotFoundError);
  });

  test("instantiating in another Project makes an independent flow with fresh ids and no live bind", async () => {
    const ctx = await savedTemplate();
    const bindsBefore = ctx.binds.size;
    const first = await ctx.seam.createFromTemplate(ACCOUNT, {
      projectId: PROJECT_B,
      templateId: ctx.template.id,
      title: "Second checkout",
    });
    const second = await ctx.seam.createFromTemplate(ACCOUNT, {
      projectId: PROJECT_B,
      templateId: ctx.template.id,
      title: "Third checkout",
    });
    expect(first).toMatchObject({ projectId: PROJECT_B, version: 1 });
    expect(first.id).not.toBe(ctx.flowId);
    expect(first.cards).toEqual([]);
    expect(first.nodes).toHaveLength(2);
    expect(first.links).toHaveLength(1);

    const sourceIds = new Set(
      (ctx.flows.get(ctx.flowId)?.document.nodes ?? []).map(({ id }) => id),
    );
    const ids = [...first.nodes, ...second.nodes].map(({ id }) => id);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) {
      expect(sourceIds.has(id)).toBe(false);
      expect(id.startsWith("node-")).toBe(false);
    }
    // The link joins the fresh node ids, not the source or template ids.
    expect(new Set(first.nodes.map(({ id }) => id))).toEqual(
      new Set([first.links[0]?.from, first.links[0]?.to]),
    );
    // No Screen is linked, no bind or record is created, no source Project reference is stored.
    expect(first.nodes.every(({ screen }) => screen === null)).toBe(true);
    expect(ctx.binds.size).toBe(bindsBefore);
    expect(ctx.created).toHaveLength(1);
    expect(JSON.stringify(ctx.flows.get(first.id))).not.toContain(ctx.flowId);
  });

  test("editing the source flow later does not change the template or its instances", async () => {
    const ctx = await savedTemplate();
    const instance = await ctx.seam.createFromTemplate(ACCOUNT, {
      projectId: PROJECT_B,
      templateId: ctx.template.id,
      title: "Instance",
    });
    await ctx.seam.save(ACCOUNT, {
      document: { links: [], nodes: [] },
      expectedVersion: ctx.flows.get(ctx.flowId)?.version ?? 0,
      projectId: PROJECT,
      userFlowId: ctx.flowId,
    });
    expect(ctx.templates.get(ctx.template.id)).toEqual(ctx.template);
    const reread = await ctx.seam.get(ACCOUNT, PROJECT_B, instance.id);
    expect(reread.nodes).toHaveLength(2);
    expect(reread.version).toBe(1);
  });

  test("re-linking a Screen in the target is explicit only", async () => {
    const ctx = await savedTemplate();
    const instance = await ctx.seam.createFromTemplate(ACCOUNT, {
      projectId: PROJECT_B,
      templateId: ctx.template.id,
      title: "Instance",
    });
    const placeholder = instance.nodes.find(({ kind }) => kind === "Screen");
    expect(placeholder?.screen).toBeNull();
    // Saving the placeholder as it is keeps it unlinked.
    const resaved = await ctx.seam.save(ACCOUNT, {
      document: {
        links: instance.links,
        nodes: instance.nodes.map((node) => ({
          id: node.id,
          kind: node.kind,
          position: node.position,
          screenId: null,
          text: node.text,
        })),
      },
      expectedVersion: 1,
      projectId: PROJECT_B,
      userFlowId: instance.id,
    });
    expect(
      resaved.nodes.find(({ id }) => id === placeholder?.id)?.screen,
    ).toBeNull();
    // A save cannot introduce a new unlinked Screen node.
    await expect(
      ctx.seam.save(ACCOUNT, {
        document: {
          links: [],
          nodes: [
            {
              id: "invented",
              kind: "Screen",
              position: { x: 0, y: 0 },
              screenId: null,
              text: "",
            },
          ],
        },
        expectedVersion: 2,
        projectId: PROJECT_B,
        userFlowId: instance.id,
      }),
    ).rejects.toBeInstanceOf(UserFlowScreenUnavailableError);
  });

  test("an unknown template is not found", async () => {
    const ctx = await seededFlow();
    await expect(
      ctx.seam.createFromTemplate(ACCOUNT, {
        projectId: PROJECT_B,
        templateId: "ghost",
        title: "Nope",
      }),
    ).rejects.toBeInstanceOf(UserFlowTemplateNotFoundError);
    expect(await ctx.seam.templates(ACCOUNT, PROJECT_B)).toEqual([]);
  });
});

const OTHER_ACCOUNT = "account-2";

function setupUserFlowViewport() {
  const memory = createMemoryStore();
  let sequence = 0;
  const seam = createUserFlow(memory.store, {
    generateId: () => {
      sequence += 1;
      return `generated-${sequence}`;
    },
    now: () => new Date(timestamp),
  });
  return { ...memory, seam };
}

function nodeFixture(id: string, x = 0, y = 0, kind = "Action") {
  return {
    id,
    kind: kind as "Action",
    position: { x, y },
    screenId: null,
    style: "default" as const,
    text: id,
  };
}

async function flowWithNodes(count = 3) {
  const ctx = setupUserFlowViewport();
  const created = await ctx.seam.create(ACCOUNT, {
    projectId: PROJECT,
    title: "Purchase path",
  });
  const saved = await ctx.seam.save(ACCOUNT, {
    document: {
      links: [],
      nodes: Array.from({ length: count }, (_, index) =>
        nodeFixture(`n${index}`, index * 300, 0),
      ),
    },
    expectedVersion: created.version,
    projectId: PROJECT,
    userFlowId: created.id,
  });
  return { ...ctx, flow: saved };
}

const viewport: UserFlowViewport = {
  center: { x: 300, y: 40 },
  collapsed: [],
  zoom: 1.5,
};

describe("personal viewport", () => {
  test("is restored for the account that saved it", async () => {
    const { flow, seam } = await flowWithNodes();
    await seam.saveViewport(ACCOUNT, {
      projectId: PROJECT,
      userFlowId: flow.id,
      viewport,
    });
    expect(await seam.viewport(ACCOUNT, PROJECT, flow.id)).toEqual(viewport);
  });

  test("is empty before anything was saved", async () => {
    const { flow, seam } = await flowWithNodes();
    expect(await seam.viewport(ACCOUNT, PROJECT, flow.id)).toBeNull();
  });

  test("is not another user's view", async () => {
    const { flow, seam } = await flowWithNodes();
    await seam.saveViewport(ACCOUNT, {
      projectId: PROJECT,
      userFlowId: flow.id,
      viewport,
    });
    // The memory store scopes flows to one account, so a second account is
    // refused outright; its own record would be a separate row either way.
    await expect(
      seam.viewport(OTHER_ACCOUNT, PROJECT, flow.id),
    ).rejects.toBeInstanceOf(UserFlowNotFoundError);
  });

  test("keeps one viewport per account in the store", async () => {
    const { flow, store } = await flowWithNodes();
    await store.saveViewport(ACCOUNT, flow.id, viewport);
    await store.saveViewport(OTHER_ACCOUNT, flow.id, {
      ...viewport,
      zoom: 0.5,
    });
    expect((await store.findViewport(ACCOUNT, flow.id))?.zoom).toBe(1.5);
    expect((await store.findViewport(OTHER_ACCOUNT, flow.id))?.zoom).toBe(0.5);
  });

  test("is not content: saving it writes no version and leaves the document, view, search, counts and export unchanged", async () => {
    const { flow, seam, versions, writes } = await flowWithNodes();
    const before = await seam.get(ACCOUNT, PROJECT, flow.id);
    const versionsBefore = versions.length;
    await seam.saveViewport(ACCOUNT, {
      projectId: PROJECT,
      userFlowId: flow.id,
      viewport: { ...viewport, collapsed: [] },
    });
    const after = await seam.get(ACCOUNT, PROJECT, flow.id);
    expect(after).toEqual(before);
    expect(versions).toHaveLength(versionsBefore);
    expect(writes.at(-1)).toBe("saveViewport");
    expect(JSON.stringify(after)).not.toContain("zoom");
    expect(userFlowSearchableText(after)).toEqual(
      userFlowSearchableText(before),
    );
    expect(userFlowCounts(after)).toEqual(userFlowCounts(before));
    expect(userFlowExportContent(after)).toEqual(userFlowExportContent(before));
    expect(JSON.stringify(userFlowExportContent(after))).not.toContain("zoom");
  });

  test("carries no selection, inspector, edit mode or unsaved operations", async () => {
    const { flow, seam } = await flowWithNodes();
    await expect(
      seam.saveViewport(ACCOUNT, {
        projectId: PROJECT,
        userFlowId: flow.id,
        viewport: { ...viewport, selection: ["n0"] } as never,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await seam.viewport(ACCOUNT, PROJECT, flow.id)).toBeNull();
  });

  test("rejects a zoom outside the canvas range and a non-finite center", async () => {
    const { flow, seam } = await flowWithNodes();
    const bad = [
      { ...viewport, zoom: 0 },
      { ...viewport, zoom: 99 },
      { ...viewport, center: { x: Number.NaN, y: 0 } },
    ];
    await Promise.all(
      bad.map((candidate) =>
        expect(
          seam.saveViewport(ACCOUNT, {
            projectId: PROJECT,
            userFlowId: flow.id,
            viewport: candidate,
          }),
        ).rejects.toBeInstanceOf(ZodError),
      ),
    );
  });

  test("is refused for a User Flow that does not exist", async () => {
    const { seam } = setupUserFlowViewport();
    await expect(
      seam.saveViewport(ACCOUNT, {
        projectId: PROJECT,
        userFlowId: "missing",
        viewport,
      }),
    ).rejects.toBeInstanceOf(UserFlowNotFoundError);
  });

  test("drops a collapse of a Section that no longer exists", async () => {
    const ctx = await flowWithNodes(0);
    const saved = await ctx.seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [
          nodeFixture("s1", 0, 0, "Section"),
          { ...nodeFixture("a1", 40, 120), sectionId: "s1" },
        ],
      },
      expectedVersion: ctx.flow.version,
      projectId: PROJECT,
      userFlowId: ctx.flow.id,
    });
    await ctx.seam.saveViewport(ACCOUNT, {
      projectId: PROJECT,
      userFlowId: saved.id,
      viewport: { ...viewport, collapsed: ["s1", "ghost", "a1"] },
    });
    expect(
      (await ctx.seam.viewport(ACCOUNT, PROJECT, saved.id))?.collapsed,
    ).toEqual(["s1"]);
  });
});

describe("Section grouping", () => {
  test("a node can be grouped under a Section and the view reports it", async () => {
    const ctx = await flowWithNodes(0);
    const saved = await ctx.seam.save(ACCOUNT, {
      document: {
        links: [],
        nodes: [
          nodeFixture("s1", 0, 0, "Section"),
          { ...nodeFixture("a1", 40, 120), sectionId: "s1" },
        ],
      },
      expectedVersion: ctx.flow.version,
      projectId: PROJECT,
      userFlowId: ctx.flow.id,
    });
    expect(saved.nodes.map(({ sectionId }) => sectionId)).toEqual([null, "s1"]);
  });

  test("rejects a group under a non-Section, under itself, or of a Section", async () => {
    const ctx = await flowWithNodes(0);
    const invalid = [
      [nodeFixture("a0"), { ...nodeFixture("a1"), sectionId: "a0" }],
      [{ ...nodeFixture("s1", 0, 0, "Section"), sectionId: "s1" }],
      [
        nodeFixture("s1", 0, 0, "Section"),
        { ...nodeFixture("s2", 0, 0, "Section"), sectionId: "s1" },
      ],
      [{ ...nodeFixture("a1"), sectionId: "missing" }],
    ];
    await Promise.all(
      invalid.map((nodes) =>
        expect(
          ctx.seam.save(ACCOUNT, {
            document: { links: [], nodes },
            expectedVersion: ctx.flow.version,
            projectId: PROJECT,
            userFlowId: ctx.flow.id,
          }),
        ).rejects.toBeInstanceOf(ZodError),
      ),
    );
  });
});

describe("500 visible / 750 link hard scene", () => {
  test("is the contract limit of the document", () => {
    expect(USER_FLOW_NODE_LIMIT).toBe(500);
    expect(USER_FLOW_VISIBLE_ITEM_LIMIT).toBe(500);
    expect(USER_FLOW_LINK_LIMIT).toBe(750);
  });

  function scene(nodeCount: number, linkCount: number) {
    const nodes = Array.from({ length: nodeCount }, (_, index) =>
      nodeFixture(
        `n${index}`,
        (index % 25) * 260,
        Math.floor(index / 25) * 140,
      ),
    );
    const links = Array.from({ length: linkCount }, (_, index) => ({
      from: `n${index % nodeCount}`,
      id: `l${index}`,
      text: "",
      to: `n${(index * 7 + 1) % nodeCount}`,
    }));
    return { links, nodes };
  }

  test("accepts exactly 500 nodes and 750 links", async () => {
    const ctx = await flowWithNodes(0);
    const saved = await ctx.seam.save(ACCOUNT, {
      document: scene(500, 750),
      expectedVersion: ctx.flow.version,
      projectId: PROJECT,
      userFlowId: ctx.flow.id,
    });
    expect(saved.nodes).toHaveLength(500);
    expect(saved.links).toHaveLength(750);
  });

  test("rejects the 501st node and the 751st link", async () => {
    const ctx = await flowWithNodes(0);
    await Promise.all(
      [scene(501, 10), scene(500, 751)].map((document) =>
        expect(
          ctx.seam.save(ACCOUNT, {
            document,
            expectedVersion: ctx.flow.version,
            projectId: PROJECT,
            userFlowId: ctx.flow.id,
          }),
        ).rejects.toBeInstanceOf(ZodError),
      ),
    );
  });

  test("Place node cannot exceed the scene either", async () => {
    const ctx = await flowWithNodes(0);
    const full = await ctx.seam.save(ACCOUNT, {
      document: scene(500, 0),
      expectedVersion: ctx.flow.version,
      projectId: PROJECT,
      userFlowId: ctx.flow.id,
    });
    await expect(
      ctx.seam.placeNode(ACCOUNT, {
        expectedVersion: full.version,
        kind: "Action",
        projectId: PROJECT,
        text: "one too many",
        userFlowId: full.id,
      }),
    ).rejects.toBeInstanceOf(UserFlowSceneLimitError);
  });

  test("nodes and live cards share the 500 visible items", async () => {
    const ctx = await flowWithNodes(0);
    ctx.addRecord("Work", "work-1", "Ship checkout");
    await expect(
      ctx.seam.save(ACCOUNT, {
        document: {
          ...scene(500, 0),
          cards: [
            {
              id: "c1",
              kind: "Work",
              position: { x: 0, y: 0 },
              recordId: "work-1",
            },
          ],
        },
        expectedVersion: ctx.flow.version,
        projectId: PROJECT,
        userFlowId: ctx.flow.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

const frame = { height: 400, width: 800 };
const content = {
  cards: [],
  nodes: [
    { id: "a", kind: "Action", position: { x: 0, y: 0 } },
    { id: "b", kind: "Action", position: { x: 2000, y: 0 } },
  ],
};

describe("meaningful restore and Fit View", () => {
  test("restores a position that still shows content", () => {
    const saved = { center: { x: 100, y: 40 }, collapsed: [], zoom: 1 };
    expect(resolveUserFlowViewport({ content, frame, saved })).toEqual({
      collapsed: [],
      mode: "restore",
      viewport: { center: saved.center, zoom: 1 },
    });
  });

  test("fits visible content when nothing was saved", () => {
    expect(resolveUserFlowViewport({ content, frame, saved: null }).mode).toBe(
      "fit",
    );
  });

  test("fits instead of opening on a region outside the content bounds", () => {
    const saved = { center: { x: 90_000, y: -40_000 }, collapsed: [], zoom: 1 };
    expect(resolveUserFlowViewport({ content, frame, saved }).mode).toBe("fit");
  });

  test("fits instead of opening on an empty gap between content", () => {
    const saved = { center: { x: 1000, y: 40 }, collapsed: [], zoom: 1 };
    expect(resolveUserFlowViewport({ content, frame, saved }).mode).toBe("fit");
  });

  test("fits when the content the position showed was deleted", () => {
    const saved = { center: { x: 2100, y: 40 }, collapsed: [], zoom: 1 };
    const remaining = {
      cards: [],
      nodes: [{ id: "a", kind: "Action", position: { x: 0, y: 0 } }],
    };
    expect(resolveUserFlowViewport({ content, frame, saved }).mode).toBe(
      "restore",
    );
    expect(
      resolveUserFlowViewport({ content: remaining, frame, saved }).mode,
    ).toBe("fit");
  });

  test("fits an empty canvas and a degenerate frame", () => {
    const saved = { center: { x: 0, y: 0 }, collapsed: [], zoom: 1 };
    expect(
      resolveUserFlowViewport({
        content: { cards: [], nodes: [] },
        frame,
        saved,
      }).mode,
    ).toBe("fit");
    expect(
      resolveUserFlowViewport({
        content,
        frame: { height: 0, width: 0 },
        saved,
      }).mode,
    ).toBe("fit");
  });

  test("content hidden by a collapsed Section does not make a position meaningful", () => {
    const grouped = {
      cards: [],
      nodes: [
        { id: "s", kind: "Section", position: { x: 0, y: 0 } },
        {
          id: "m",
          kind: "Action",
          position: { x: 3000, y: 0 },
          sectionId: "s",
        },
      ],
    };
    const saved = { center: { x: 3100, y: 40 }, collapsed: ["s"], zoom: 1 };
    expect(resolveUserFlowViewport({ content: grouped, frame, saved })).toEqual(
      { collapsed: ["s"], mode: "fit" },
    );
    expect(
      resolveUserFlowViewport({
        content: grouped,
        frame,
        saved: { ...saved, collapsed: [] },
      }).mode,
    ).toBe("restore");
  });
});
