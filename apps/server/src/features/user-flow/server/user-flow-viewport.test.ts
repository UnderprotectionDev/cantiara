import {
  USER_FLOW_LINK_LIMIT,
  USER_FLOW_NODE_LIMIT,
  USER_FLOW_VISIBLE_ITEM_LIMIT,
  type UserFlowViewport,
  userFlowCounts,
  userFlowExportContent,
  userFlowSearchableText,
} from "@cantiara/api/user-flow";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  createUserFlow,
  UserFlowNotFoundError,
  UserFlowSceneLimitError,
} from "./user-flow";
import {
  ACCOUNT,
  createMemoryStore,
  PROJECT,
  timestamp,
} from "./user-flow-test-support";

const OTHER_ACCOUNT = "account-2";

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
  return { ...memory, seam };
}

function node(id: string, x = 0, y = 0, kind = "Action") {
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
  const ctx = setup();
  const created = await ctx.seam.create(ACCOUNT, {
    projectId: PROJECT,
    title: "Purchase path",
  });
  const saved = await ctx.seam.save(ACCOUNT, {
    document: {
      links: [],
      nodes: Array.from({ length: count }, (_, index) =>
        node(`n${index}`, index * 300, 0),
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
    const { seam } = setup();
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
          node("s1", 0, 0, "Section"),
          { ...node("a1", 40, 120), sectionId: "s1" },
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
          node("s1", 0, 0, "Section"),
          { ...node("a1", 40, 120), sectionId: "s1" },
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
      [node("a0"), { ...node("a1"), sectionId: "a0" }],
      [{ ...node("s1", 0, 0, "Section"), sectionId: "s1" }],
      [
        node("s1", 0, 0, "Section"),
        { ...node("s2", 0, 0, "Section"), sectionId: "s1" },
      ],
      [{ ...node("a1"), sectionId: "missing" }],
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
      node(`n${index}`, (index % 25) * 260, Math.floor(index / 25) * 140),
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
