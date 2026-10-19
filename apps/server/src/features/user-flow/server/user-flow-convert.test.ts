import type { UserFlowConvertPlan } from "@cantiara/api/user-flow";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  createUserFlow,
  UserFlowBindNotFoundError,
  UserFlowConversionStaleError,
  UserFlowNodeNotFoundError,
  UserFlowNodeNotPromotableError,
  UserFlowRebindNotNeededError,
  UserFlowRebindStaleError,
  UserFlowRecordUnavailableError,
  UserFlowScreenUnavailableError,
  UserFlowTemplateNotFoundError,
} from "./user-flow";
import {
  ACCOUNT,
  createMemoryStore,
  PROJECT,
  PROJECT_B,
  timestamp,
} from "./user-flow-memory-store";

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
  memory.addRecord("Work", "work-1", "Fix the pay button", {
    status: "Not Started",
  });
  memory.addRecord("Decision", "decision-1", "Use one-tap pay");
  memory.addRecord("Risk", "risk-1", "Payments provider outage");
  return { ...memory, seam };
}

/** A flow at version 2: a Screen node, an Action node and a link between them. */
async function seededFlow() {
  const ctx = setup();
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
