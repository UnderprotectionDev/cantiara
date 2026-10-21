import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createWireframeBlock,
  createWireframeMigrator,
  parseWireframeDocument,
  resolveBlock,
  seedFromId,
  WIREFRAME_COMPONENT_KINDS,
  type WireframeBlock,
  type WireframeBlockKind,
  type WireframeDocument,
  WireframeDocumentError,
  wireframeDocumentSchema,
} from "@cantiara/api/wireframe-document";
import { describe, expect, test } from "vitest";

import { ScreenRevisionConflictError } from "../screens";
import { accountId, createMemoryStore } from "../screens-memory-store";

const stageJson = JSON.stringify({
  attrs: { height: 800, width: 1280 },
  children: [{ attrs: {}, children: [], className: "Layer" }],
  className: "Stage",
});

function block(kind: WireframeBlockKind, id: string, at = { x: 10, y: 10 }) {
  return createWireframeBlock(kind, id, at);
}

function documentWith(...blocks: WireframeBlock[]): WireframeDocument {
  return { ...createEmptyWireframeDocument(), blocks };
}

function liveTextBlock(visibleText: string): WireframeBlock {
  return {
    ...block("Text", "t1"),
    text: {
      mode: "live",
      source: { documentId: "doc-1", sectionId: "intro" },
      visibleText,
    },
  } as WireframeBlock;
}

describe("Wireframe document persistence", () => {
  async function setup() {
    const harness = createMemoryStore();
    const record = await harness.screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    return { ...harness, record };
  }

  test("round-trips a versioned WireframeDocument as the content of a Wireframe version", async () => {
    const { record, screens } = await setup();
    const original: WireframeDocument = {
      ...documentWith(
        ...WIREFRAME_COMPONENT_KINDS.map((kind, index) =>
          block(kind, `b-${kind}`, { x: 20 + index * 5, y: 20 }),
        ),
        block("Text", "b-text"),
      ),
      animations: [
        {
          action: "show",
          id: "a1",
          kind: "show-hide",
          targetBlockId: "b-Card",
          triggerBlockId: "b-Button",
        },
        {
          durationMs: 300,
          id: "a2",
          kind: "screen-transition",
          targetScreenId: "other-screen",
          transition: "fade",
          triggerBlockId: "b-Button",
        },
      ],
    };

    const saved = await screens.saveWireframe(accountId, {
      document: original,
      projectId: "project-1",
      screenId: record.id,
    });
    const reread = await screens.wireframe(accountId, {
      projectId: "project-1",
      screenId: record.id,
    });

    expect(saved.version).toBe(1);
    expect(reread.document).toEqual(original);
    expect(reread.document).toMatchObject({
      format: "cantiara.wireframe-document",
      version: 1,
    });
    const list = await screens.list(accountId, "project-1");
    expect(list.screens[0]?.wireframeVersions).toHaveLength(1);
  });

  test("an archived Screen keeps its Wireframe editable: Archive is visibility, Trash is the broken target", async () => {
    const { record, screens } = await setup();
    await screens.setLifecycle(accountId, {
      action: "archive",
      projectId: "project-1",
      screenId: record.id,
    });
    const saved = await screens.saveWireframe(accountId, {
      document: documentWith(block("Card", "c1")),
      projectId: "project-1",
      screenId: record.id,
    });
    expect(saved.document.blocks).toHaveLength(1);
    const list = await screens.list(accountId, "project-1");
    expect(list.screens[0]?.lifecycle).toBe("Archived");

    await screens.setLifecycle(accountId, {
      action: "trash",
      projectId: "project-1",
      screenId: record.id,
    });
    await expect(
      screens.saveWireframe(accountId, {
        document: documentWith(),
        projectId: "project-1",
        screenId: record.id,
      }),
    ).rejects.toThrow();
  });

  test("a document migrates through a registered chain and refuses a newer version", () => {
    const migrate = createWireframeMigrator({
      current: 3,
      migrations: {
        1: (document) => ({ ...(document as object), seen1: true }),
        2: (document) => ({ ...(document as object), seen2: true }),
      },
    });

    expect(migrate({ version: 1 })).toEqual({
      seen1: true,
      seen2: true,
      version: 3,
    });
    expect(() => migrate({ version: 4 })).toThrow(WireframeDocumentError);
    expect(() => migrate({ version: 0 })).toThrow("No migration");
    expect(() => parseWireframeDocument({ version: 2 })).toThrow(
      WireframeDocumentError,
    );
  });

  test("Konva Stage JSON is rejected as a persist format, saved or as a version", async () => {
    const { record, screens } = await setup();

    const attempts = [stageJson, JSON.parse(stageJson)].flatMap((konva) => [
      screens.saveWireframe(accountId, {
        document: konva,
        projectId: "project-1",
        screenId: record.id,
      }),
      screens.attachWireframeVersion(accountId, "project-1", record.id, konva),
    ]);
    await Promise.all(
      attempts.map((attempt) =>
        expect(attempt).rejects.toMatchObject({ code: "KONVA_JSON_REJECTED" }),
      ),
    );
    expect(
      (await screens.list(accountId, "project-1")).screens[0]
        ?.wireframeVersions,
    ).toEqual([]);
  });

  test("a version keeps the then-visible live text with a path to the live source", async () => {
    const { record, screens, sections } = await setup();
    sections.set("doc-1#intro", "Welcome to Cantiara");

    await screens.attachWireframeVersion(
      accountId,
      "project-1",
      record.id,
      documentWith(liveTextBlock("")),
    );
    sections.set("doc-1#intro", "Rewritten later");
    const historical = await screens.wireframe(accountId, {
      projectId: "project-1",
      screenId: record.id,
      version: 1,
    });

    expect(historical.document.blocks[0]).toMatchObject({
      text: { mode: "live", visibleText: "Welcome to Cantiara" },
    });
    expect(historical.liveText.t1).toEqual({
      sourcePath: "/documents/doc-1#intro",
      state: "resolved",
      text: "Rewritten later",
    });
  });

  test("a broken live text reference shows as broken and keeps its last text", async () => {
    const { record, screens, sections } = await setup();
    sections.set("doc-1#intro", "Hello");
    await screens.saveWireframe(accountId, {
      document: documentWith(liveTextBlock("Hello")),
      projectId: "project-1",
      screenId: record.id,
    });

    sections.delete("doc-1#intro");
    const broken = await screens.wireframe(accountId, {
      projectId: "project-1",
      screenId: record.id,
    });

    expect(broken.liveText.t1).toEqual({
      sourcePath: "/documents/doc-1#intro",
      state: "broken",
      text: "Hello",
    });
    await screens.attachWireframeVersion(
      accountId,
      "project-1",
      record.id,
      broken.document,
    );
    const next = await screens.wireframe(accountId, {
      projectId: "project-1",
      screenId: record.id,
      version: 2,
    });
    expect(next.document.blocks[0]).toMatchObject({
      text: { visibleText: "Hello" },
    });
  });
});

describe("Linked blocks", () => {
  const navigation = {
    height: 56,
    kind: "Navigation" as const,
    label: "Header",
    props: { items: ["Home", "Docs"] },
    width: 560,
  };

  async function setup() {
    const harness = createMemoryStore();
    const create = (title: string) =>
      harness.screens.create(accountId, { projectId: "project-1", title });
    const home = await create("Home");
    const pricing = await create("Pricing");
    const trashedScreen = await create("Old");
    const definition = await harness.screens.createLinkedBlock(accountId, {
      content: navigation,
      name: "Header",
      projectId: "project-1",
    });
    const snapshot = {
      content: definition.content,
      id: definition.id,
      name: definition.name,
      revision: definition.revision,
    };
    const instanceOf = (id: string) =>
      applyWireframeTransaction(
        documentWith(block("Navigation", id, { x: 0, y: 0 })),
        [{ blockId: id, definition: snapshot, type: "linkBlock" }],
      );
    await Promise.all(
      [home, pricing, trashedScreen].map((screen) =>
        harness.screens.saveWireframe(accountId, {
          document: instanceOf(`nav-${screen.id}`),
          projectId: "project-1",
          screenId: screen.id,
        }),
      ),
    );
    await harness.screens.setLifecycle(accountId, {
      action: "trash",
      projectId: "project-1",
      screenId: trashedScreen.id,
    });
    return { ...harness, definition, home, instanceOf, pricing };
  }

  test("a source change previews affected Screens before anything is written", async () => {
    const { definition, home, pricing, screens, stored } = await setup();
    const versionsBefore = [...stored.values()].map((list) => list.length);

    const preview = await screens.previewLinkedBlockChange(accountId, {
      content: { ...navigation, label: "Main header" },
      definitionId: definition.id,
      projectId: "project-1",
    });

    expect(preview.applied).toBe(false);
    // A Screen in Trash is a broken target and is not previewed.
    expect(
      preview.affectedScreens.map(({ screenId }) => screenId).sort(),
    ).toEqual([home.id, pricing.id].sort());
    expect([...stored.values()].map((list) => list.length)).toEqual(
      versionsBefore,
    );
    expect(
      (await screens.linkedBlocks(accountId, "project-1"))[0],
    ).toMatchObject({ content: { label: "Header" }, revision: 1 });
  });

  test("applying a source change gives affected Screens a new version and keeps history", async () => {
    const { definition, home, screens } = await setup();

    const applied = await screens.applyLinkedBlockChange(accountId, {
      content: { ...navigation, label: "Main header" },
      definitionId: definition.id,
      expectedRevision: 1,
      projectId: "project-1",
    });

    expect(applied).toMatchObject({
      applied: true,
      definition: { revision: 2 },
    });
    const latest = await screens.wireframe(accountId, {
      projectId: "project-1",
      screenId: home.id,
    });
    expect(latest.version).toBe(2);
    expect(
      latest.document.linkedDefinitions[definition.id]?.content.label,
    ).toBe("Main header");
    const first = await screens.wireframe(accountId, {
      projectId: "project-1",
      screenId: home.id,
      version: 1,
    });
    expect(first.document.linkedDefinitions[definition.id]?.content.label).toBe(
      "Header",
    );
    await expect(
      screens.applyLinkedBlockChange(accountId, {
        content: navigation,
        definitionId: definition.id,
        expectedRevision: 1,
        projectId: "project-1",
      }),
    ).rejects.toBeInstanceOf(ScreenRevisionConflictError);
  });

  test("Detach Link freezes the current content into an independent block", async () => {
    const { definition, home, instanceOf, pricing, screens } = await setup();
    const detached = applyWireframeTransaction(instanceOf("nav-x"), [
      { blockId: "nav-x", type: "detachLink" },
    ]);

    expect(detached.blocks[0]).toMatchObject({
      kind: "Navigation",
      label: "Header",
    });
    expect(detached.blocks[0]?.link).toBeUndefined();
    expect(detached.linkedDefinitions).toEqual({});

    await screens.saveWireframe(accountId, {
      document: detached,
      projectId: "project-1",
      screenId: home.id,
    });
    const preview = await screens.previewLinkedBlockChange(accountId, {
      content: { ...navigation, label: "Main header" },
      definitionId: definition.id,
      projectId: "project-1",
    });
    expect(preview.affectedScreens.map(({ screenId }) => screenId)).toEqual([
      pricing.id,
    ]);
  });

  test("a linked instance takes content from the source and is not edited in place", async () => {
    const { instanceOf } = await setup();
    const document = instanceOf("nav-x");

    expect(() =>
      applyWireframeTransaction(document, [
        { blockId: "nav-x", label: "Local", type: "setLabel" },
      ]),
    ).toThrow(WireframeDocumentError);
    expect(
      resolveBlock(document, document.blocks[0] as WireframeBlock).label,
    ).toBe("Header");
    // Linked blocks are Project-scoped: another Project has no such source.
    await expect(
      createMemoryStore().screens.previewLinkedBlockChange("stranger", {
        content: navigation,
        definitionId: "missing",
        projectId: "project-1",
      }),
    ).rejects.toThrow();
  });
});

describe("Wireframe semantic components and the closed animation set", () => {
  test("each component carries canonical geometry, meaning and a fixed seed", () => {
    for (const kind of WIREFRAME_COMPONENT_KINDS) {
      const created = block(kind, `id-${kind}`, { x: 30, y: 40 });
      expect(created).toMatchObject({ kind, x: 30, y: 40 });
      expect(created.width).toBeGreaterThan(0);
      expect(created.height).toBeGreaterThan(0);
      expect(created.seed).toBe(seedFromId(`id-${kind}`));
      expect("props" in created).toBe(true);
    }
    expect(
      wireframeDocumentSchema.safeParse(
        documentWith(
          ...WIREFRAME_COMPONENT_KINDS.map((kind) => block(kind, kind)),
        ),
      ).success,
    ).toBe(true);
    // A bare primitive is not a semantic component.
    expect(
      wireframeDocumentSchema.safeParse({
        ...createEmptyWireframeDocument(),
        blocks: [{ height: 10, id: "r", kind: "Rect", width: 10, x: 0, y: 0 }],
      }).success,
    ).toBe(false);
  });

  const withBlocks = {
    ...createEmptyWireframeDocument(),
    blocks: [block("Button", "a"), block("Card", "b")],
  };

  test("accepts exactly the closed animation set with closed durations", () => {
    const animations = [
      {
        action: "hide",
        id: "1",
        kind: "show-hide",
        targetBlockId: "b",
        triggerBlockId: "a",
      },
      {
        durationMs: 500,
        id: "2",
        kind: "two-state",
        targetBlockId: "b",
        toState: { offsetX: 0, offsetY: 8, opacity: 0.5 },
        triggerBlockId: "a",
      },
      {
        effect: "highlight",
        id: "3",
        kind: "hover-press",
        state: "hover",
        targetBlockId: "a",
      },
      {
        id: "4",
        kind: "sequence",
        steps: [{ action: "show", blockId: "b", durationMs: 150 }],
        triggerBlockId: "a",
      },
      {
        durationMs: 800,
        id: "5",
        kind: "screen-transition",
        targetScreenId: "s2",
        transition: "slide-left",
        triggerBlockId: "a",
      },
    ];

    expect(
      wireframeDocumentSchema.safeParse({ ...withBlocks, animations }).success,
    ).toBe(true);
  });

  test.each([
    ["a duration outside the closed set", { durationMs: 250 }],
    ["keyframes", { keyframes: [{ at: 0 }] }],
    ["custom easing", { easing: "cubic-bezier(0,0,1,1)" }],
    ["a timeline", { timeline: [] }],
    ["physics", { physics: { spring: 1 } }],
  ])("rejects %s", (_name, extra) => {
    const animation = {
      durationMs: 300,
      id: "x",
      kind: "two-state",
      targetBlockId: "b",
      toState: { offsetX: 0, offsetY: 0, opacity: 1 },
      triggerBlockId: "a",
      ...extra,
    };
    expect(
      wireframeDocumentSchema.safeParse({
        ...withBlocks,
        animations: [animation],
      }).success,
    ).toBe(false);
  });

  test("rejects an animation kind outside the set and a dangling block", () => {
    expect(
      wireframeDocumentSchema.safeParse({
        ...withBlocks,
        animations: [{ id: "x", kind: "scroll-linked", targetBlockId: "b" }],
      }).success,
    ).toBe(false);
    expect(
      wireframeDocumentSchema.safeParse({
        ...withBlocks,
        animations: [
          {
            action: "show",
            id: "x",
            kind: "show-hide",
            targetBlockId: "gone",
            triggerBlockId: "a",
          },
        ],
      }).success,
    ).toBe(false);
  });

  test("a transaction is atomic: a failing command leaves the document unchanged", () => {
    const document = documentWith(block("Button", "a"));

    expect(() =>
      applyWireframeTransaction(document, [
        { blockId: "a", type: "moveBlock", x: 5, y: 5 },
        { blockId: "missing", type: "moveBlock", x: 1, y: 1 },
      ]),
    ).toThrow(WireframeDocumentError);
    expect(document.blocks[0]).toMatchObject({ x: 10, y: 10 });
  });
});
