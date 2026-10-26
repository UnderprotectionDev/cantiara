import {
  confirmConvertAndBindInputSchema,
  previewConvertAndBindInputSchema,
  SOURCE_ITEM_GONE_LABEL,
} from "@cantiara/api/screen-origins";
import {
  neutralViewport,
  type WireframeViewport,
} from "@cantiara/api/screen-viewport";
import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createLiveCardBlock,
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
  type WireframeLinkedDefinition,
  wireframeDocumentSchema,
} from "@cantiara/api/wireframe-document";
import { screen, screenWireframeVersion } from "@cantiara/db/schema/screen";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import {
  ScreenConversionStaleError,
  ScreenLifecycleInvalidError,
  ScreenNotFoundError,
  ScreenProjectNotFoundError,
  ScreenRevisionConflictError,
} from "../screens";
import { accountId, createMemoryStore } from "./screens-memory-store";

describe("Screens and Wireframes seam", () => {
  test("creates a Screen from a title alone, without any visual design", async () => {
    const { screens } = createMemoryStore();

    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "  Checkout  ",
    });

    expect(record).toMatchObject({
      lifecycle: "Active",
      projectId: "project-1",
      title: "Checkout",
      wireframeVersions: [],
    });
    expect((await screens.list(accountId, "project-1")).screens).toHaveLength(
      1,
    );
  });

  test("rejects an empty title, a Wireframe or design in create, and unknown Projects", async () => {
    const { screens } = createMemoryStore();

    await expect(
      screens.create(accountId, { projectId: "project-1", title: "   " }),
    ).rejects.toThrow("Title is required.");
    await expect(
      screens.create(accountId, {
        projectId: "project-1",
        title: "Home",
        wireframe: { blocks: [] },
      } as never),
    ).rejects.toThrow();
    await expect(
      screens.create(accountId, { projectId: "elsewhere", title: "Home" }),
    ).rejects.toBeInstanceOf(ScreenProjectNotFoundError);
    await expect(
      screens.create("stranger", { projectId: "project-1", title: "Home" }),
    ).rejects.toBeInstanceOf(ScreenProjectNotFoundError);
  });

  test("Wireframe has no identity, scope or lifecycle apart from its Screen", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });

    // The version table carries no Project scope and no archive or trash column.
    const versionColumns = Object.keys(getTableColumns(screenWireframeVersion));
    expect(versionColumns.sort()).toEqual(
      ["createdAt", "document", "id", "screenId", "version"].sort(),
    );
    expect(Object.keys(getTableColumns(screen))).toEqual(
      expect.arrayContaining(["archivedAt", "trashedAt", "projectId"]),
    );
    // A lifecycle command addresses a Screen; a Wireframe id is not accepted.
    await expect(
      screens.setLifecycle(accountId, {
        action: "archive",
        projectId: "project-1",
        screenId: record.id,
        wireframeId: "w1",
      } as never),
    ).rejects.toThrow();
  });

  test("exact Wireframe versions stay on the Screen through archive, trash and restore", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    await screens.attachWireframeVersion(accountId, "project-1", record.id);
    const withTwo = await screens.attachWireframeVersion(
      accountId,
      "project-1",
      record.id,
    );
    const versions = withTwo.wireframeVersions;
    expect(versions.map(({ version }) => version)).toEqual([1, 2]);

    const run = async (action: "archive" | "trash" | "restore" | "unarchive") =>
      (
        await screens.setLifecycle(accountId, {
          action,
          projectId: "project-1",
          screenId: record.id,
        })
      ).wireframeVersions;

    expect(await run("archive")).toEqual(versions);
    expect(await run("trash")).toEqual(versions);
    expect(await run("restore")).toEqual(versions);
    expect(await run("unarchive")).toEqual(versions);
  });

  test("archive, trash and restore follow the common master-record contract", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    const act = (
      action: "archive" | "unarchive" | "trash" | "restore",
      expectedRevision?: number,
    ) =>
      screens.setLifecycle(accountId, {
        action,
        expectedRevision,
        projectId: "project-1",
        screenId: record.id,
      });

    const archivedRecord = await act("archive");
    expect(archivedRecord).toMatchObject({
      lifecycle: "Archived",
      revision: 2,
    });
    // Repeating a command is a no-op and writes no revision.
    expect(await act("archive")).toMatchObject({ revision: 2 });

    // Move to Trash keeps the Archive; Restore returns the same Screen to it.
    expect(await act("trash")).toMatchObject({
      id: record.id,
      lifecycle: "In Trash",
      revision: 3,
    });
    await expect(act("unarchive")).rejects.toBeInstanceOf(
      ScreenLifecycleInvalidError,
    );
    await expect(act("archive")).rejects.toBeInstanceOf(
      ScreenLifecycleInvalidError,
    );
    expect(await act("restore")).toMatchObject({
      id: record.id,
      lifecycle: "Archived",
      revision: 4,
    });
    expect(await act("unarchive")).toMatchObject({
      id: record.id,
      lifecycle: "Active",
      revision: 5,
    });

    await expect(act("trash", 1)).rejects.toBeInstanceOf(
      ScreenRevisionConflictError,
    );
    await expect(
      screens.setLifecycle(accountId, {
        action: "trash",
        projectId: "project-1",
        screenId: "missing",
      }),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
  });

  test("a Screen in Trash is a broken target and is never retargeted", async () => {
    const { screens } = createMemoryStore();
    const first = await screens.create(accountId, {
      projectId: "project-1",
      title: "Settings",
    });
    const lookalike = await screens.create(accountId, {
      projectId: "project-1",
      title: "Settings",
    });

    expect(
      await screens.resolveTarget(accountId, {
        projectId: "project-1",
        screenId: first.id,
      }),
    ).toEqual({
      lifecycle: "Active",
      screenId: first.id,
      state: "resolved",
      title: "Settings",
    });

    await screens.setLifecycle(accountId, {
      action: "trash",
      projectId: "project-1",
      screenId: first.id,
    });
    const broken = await screens.resolveTarget(accountId, {
      projectId: "project-1",
      screenId: first.id,
    });
    expect(broken).toEqual({
      reason: "In Trash",
      screenId: first.id,
      state: "broken",
    });
    // Nothing of the lookalike or of the trashed Screen leaks into the target.
    expect(JSON.stringify(broken)).not.toContain(lookalike.id);
    expect(JSON.stringify(broken)).not.toContain("Settings");

    expect(
      await screens.resolveTarget(accountId, {
        projectId: "project-1",
        screenId: "unknown-screen",
      }),
    ).toEqual({
      reason: "No access",
      screenId: "unknown-screen",
      state: "broken",
    });

    await screens.setLifecycle(accountId, {
      action: "restore",
      projectId: "project-1",
      screenId: first.id,
    });
    expect(
      await screens.resolveTarget(accountId, {
        projectId: "project-1",
        screenId: first.id,
      }),
    ).toMatchObject({ screenId: first.id, state: "resolved" });
  });

  test("an Archived Screen still resolves and is marked Archived", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Profile",
    });
    await screens.setLifecycle(accountId, {
      action: "archive",
      projectId: "project-1",
      screenId: record.id,
    });

    expect(
      await screens.resolveTarget(accountId, {
        projectId: "project-1",
        screenId: record.id,
      }),
    ).toMatchObject({ lifecycle: "Archived", state: "resolved" });
  });

  test("a Screen in Trash accepts no new Wireframe version until restored", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    await screens.setLifecycle(accountId, {
      action: "trash",
      projectId: "project-1",
      screenId: record.id,
    });

    await expect(
      screens.attachWireframeVersion(accountId, "project-1", record.id),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
  });
});

const projectId = "project-1";

function documentWith(
  ...blocks: ReturnType<typeof createWireframeBlock>[]
): WireframeDocument {
  return { ...createEmptyWireframeDocument(), blocks };
}

async function setupConvertAndBind() {
  const harness = createMemoryStore();
  const record = await harness.screens.create(accountId, {
    projectId,
    title: "Pricing",
  });
  const button = createWireframeBlock("Button", "b-cta", { x: 20, y: 20 });
  const card = createWireframeBlock("Card", "b-card", { x: 20, y: 120 });
  const original = documentWith(
    { ...button, label: "Start trial" },
    { ...card, label: "Plans" },
  );
  const saved = await harness.screens.saveWireframe(accountId, {
    document: original,
    projectId,
    screenId: record.id,
  });
  return { ...harness, original, record, saved };
}

function toDefinition(record: {
  content: WireframeLinkedDefinition["content"];
  id: string;
  name: string;
  revision: number;
}): WireframeLinkedDefinition {
  return {
    content: record.content,
    id: record.id,
    name: record.name,
    revision: record.revision,
  };
}

function previewInput(
  screenId: string,
  extra: Partial<
    Parameters<typeof previewConvertAndBindInputSchema.parse>[0]
  > = {},
) {
  return {
    blockId: "b-cta",
    projectId,
    screenId,
    targetType: "Decision" as const,
    wireframeVersion: 1,
    ...extra,
  };
}

async function confirm(
  screens: Awaited<ReturnType<typeof setupConvertAndBind>>["screens"],
  screenId: string,
  extra = {},
  ids = { originId: "origin-1", recordId: "record-1" },
) {
  const plan = await screens.previewConvertAndBind(
    accountId,
    previewInput(screenId, extra),
  );
  return screens.convertAndBind(accountId, {
    ...ids,
    plan,
    projectId,
    screenId,
  });
}

describe("Convert and Bind preview", () => {
  test("previews exactly one record with Kökeni and Origin Location and creates nothing", async () => {
    const { createdRecords, origins, record, screens } =
      await setupConvertAndBind();

    const plan = await screens.previewConvertAndBind(
      accountId,
      previewInput(record.id, { title: "Offer a free trial" }),
    );

    expect(plan).toMatchObject({
      body: expect.stringContaining("Start trial"),
      originLocation: {
        blockId: "b-cta",
        ownerScreenId: record.id,
        wireframeVersion: 1,
      },
      recordCount: 1,
      relation: "Origin",
      targetProject: { id: projectId },
      targetType: "Decision",
      title: "Offer a free trial",
    });
    expect(createdRecords.size).toBe(0);
    expect(origins).toHaveLength(0);
    expect((await screens.list(accountId, projectId)).screens).toHaveLength(1);
  });

  test("the target set has no Screen and Work needs a Work type", () => {
    expect(
      previewConvertAndBindInputSchema.safeParse(
        previewInput("s", { targetType: "Screen" } as never),
      ).success,
    ).toBe(false);
    expect(
      previewConvertAndBindInputSchema.safeParse(
        previewInput("s", { targetType: "Work" }),
      ).success,
    ).toBe(false);
    expect(
      previewConvertAndBindInputSchema.safeParse(
        previewInput("s", { targetType: "Work", workType: "Task" }),
      ).success,
    ).toBe(true);
  });

  test("a plan cannot carry more than one record", () => {
    expect(
      confirmConvertAndBindInputSchema.safeParse({
        originId: "o",
        plan: { recordCount: 2 },
        projectId,
        recordId: "r",
        screenId: "s",
      }).success,
    ).toBe(false);
  });

  test("a block that is not on the exact version cannot be previewed", async () => {
    const { record, screens } = await setupConvertAndBind();
    await expect(
      screens.previewConvertAndBind(
        accountId,
        previewInput(record.id, { blockId: "missing" }),
      ),
    ).rejects.toBeInstanceOf(WireframeDocumentError);
    await expect(
      screens.previewConvertAndBind(
        accountId,
        previewInput(record.id, { wireframeVersion: 7 }),
      ),
    ).rejects.toMatchObject({ code: "SCREEN_VERSION_NOT_FOUND" });
  });

  test("a live card cannot be converted", async () => {
    const { record, screens } = await setupConvertAndBind();
    await screens.saveWireframe(accountId, {
      document: documentWith(
        createLiveCardBlock(
          "card-1",
          { x: 0, y: 0 },
          {
            recordId: "work-1",
            recordType: "Work",
          },
        ),
      ),
      projectId,
      screenId: record.id,
    });
    await expect(
      screens.previewConvertAndBind(
        accountId,
        previewInput(record.id, { blockId: "card-1" }),
      ),
    ).rejects.toBeInstanceOf(WireframeDocumentError);
  });
});

describe("Convert and Bind confirm", () => {
  test("creates exactly one record, no Screen, and leaves the canvas as it was", async () => {
    const { createdRecords, original, origins, record, screens } =
      await setupConvertAndBind();

    const view = await confirm(screens, record.id);

    expect(createdRecords.size).toBe(1);
    expect([...createdRecords.values()][0]).toMatchObject({
      origin: { blockId: "b-cta", screenId: record.id, version: 1 },
      type: "Decision",
    });
    expect(origins).toHaveLength(1);
    expect(view).toMatchObject({
      location: { blockId: "b-cta", state: "resolved", wireframeVersion: 1 },
      relation: "Origin",
      screen: { screenId: record.id, state: "resolved" },
      target: { recordId: "record-1", title: "Start trial", type: "Decision" },
    });
    // No Screen was minted and the canvas is exactly as it was: the source
    // block stayed, with no animation or relation endpoint added.
    expect((await screens.list(accountId, projectId)).screens).toHaveLength(1);
    const after = await screens.wireframe(accountId, {
      projectId,
      screenId: record.id,
    });
    expect(after.document).toEqual(original);
    expect(after.document.blocks.map(({ id }) => id)).toEqual([
      "b-cta",
      "b-card",
    ]);
  });

  test("a retry with the same identity creates no second record", async () => {
    const { createdRecords, origins, record, screens } =
      await setupConvertAndBind();
    await confirm(screens, record.id);
    await confirm(screens, record.id);
    expect(createdRecords.size).toBe(1);
    expect(origins).toHaveLength(1);
  });

  test("a plan edited after preview is stale and creates nothing", async () => {
    const { createdRecords, original, record, screens } =
      await setupConvertAndBind();
    const plan = await screens.previewConvertAndBind(
      accountId,
      previewInput(record.id),
    );
    await screens.saveWireframe(accountId, {
      document: applyWireframeTransaction(original, [
        { blockId: "b-cta", label: "Renamed", type: "setLabel" },
      ]),
      projectId,
      screenId: record.id,
    });
    await expect(
      screens.convertAndBind(accountId, {
        originId: "o",
        plan,
        projectId,
        recordId: "r",
        screenId: record.id,
      }),
    ).rejects.toBeInstanceOf(ScreenConversionStaleError);
    expect(createdRecords.size).toBe(0);
  });

  test("a plan for another Project or Screen is refused", async () => {
    const { record, screens } = await setupConvertAndBind();
    const plan = await screens.previewConvertAndBind(
      accountId,
      previewInput(record.id),
    );
    await expect(
      screens.convertAndBind(accountId, {
        originId: "o",
        plan: { ...plan, screenId: "other" },
        projectId,
        recordId: "r",
        screenId: record.id,
      }),
    ).rejects.toBeInstanceOf(ScreenConversionStaleError);
  });
});

describe("Origin Location after the source changes", () => {
  test("deleting the source block keeps the record and reads Kaynak öğe artık yok", async () => {
    const { createdRecords, original, record, screens } =
      await setupConvertAndBind();
    await confirm(screens, record.id);

    await screens.saveWireframe(accountId, {
      document: applyWireframeTransaction(original, [
        { blockId: "b-cta", type: "removeBlock" },
      ]),
      projectId,
      screenId: record.id,
    });

    expect(createdRecords.size).toBe(1);
    const [view] = await screens.origins(accountId, {
      projectId,
      screenId: record.id,
    });
    // Kökeni to the owning Screen survives; the location is gone, not moved.
    expect(view?.screen).toMatchObject({
      screenId: record.id,
      state: "resolved",
    });
    expect(view?.target.title).toBe("Start trial");
    expect(view?.location).toMatchObject({
      blockId: "b-cta",
      label: SOURCE_ITEM_GONE_LABEL,
      state: "gone",
      wireframeVersion: 1,
    });
  });

  test("a similar block never takes over a deleted source block", async () => {
    const { original, record, screens } = await setupConvertAndBind();
    await confirm(screens, record.id);
    const lookalike = {
      ...createWireframeBlock("Button", "b-lookalike", { x: 20, y: 20 }),
      label: "Start trial",
    };
    await screens.saveWireframe(accountId, {
      document: {
        ...applyWireframeTransaction(original, [
          { blockId: "b-cta", type: "removeBlock" },
        ]),
        blocks: [
          ...applyWireframeTransaction(original, [
            { blockId: "b-cta", type: "removeBlock" },
          ]).blocks,
          lookalike,
        ],
      },
      projectId,
      screenId: record.id,
    });
    const [view] = await screens.origins(accountId, {
      projectId,
      screenId: record.id,
    });
    expect(view?.location).toMatchObject({
      blockId: "b-cta",
      state: "gone",
    });
  });

  test("the bound version stays exact: a geometry save opens a new version", async () => {
    const { original, record, screens } = await setupConvertAndBind();
    await confirm(screens, record.id);

    const moved = await screens.saveWireframe(accountId, {
      document: applyWireframeTransaction(original, [
        { blockId: "b-cta", type: "moveBlock", x: 400, y: 400 },
      ]),
      projectId,
      screenId: record.id,
    });

    expect(moved.version).toBe(2);
    const sealed = await screens.wireframe(accountId, {
      projectId,
      screenId: record.id,
      version: 1,
    });
    expect(sealed.document).toEqual(original);
    const [view] = await screens.origins(accountId, {
      projectId,
      screenId: record.id,
    });
    expect(view?.location).toMatchObject({
      state: "resolved",
      wireframeVersion: 1,
    });
  });

  test("a later saved version does not silently move the bind", async () => {
    const { original, record, screens } = await setupConvertAndBind();
    await confirm(screens, record.id);
    await screens.attachWireframeVersion(
      accountId,
      projectId,
      record.id,
      applyWireframeTransaction(original, [
        { blockId: "b-cta", type: "moveBlock", x: 300, y: 300 },
      ]),
    );
    const [view] = await screens.origins(accountId, {
      projectId,
      screenId: record.id,
    });
    expect(view?.location.wireframeVersion).toBe(1);
    const old = await screens.wireframe(accountId, {
      projectId,
      screenId: record.id,
      version: 1,
    });
    expect(old.document.blocks.find(({ id }) => id === "b-cta")).toMatchObject({
      x: 20,
      y: 20,
    });
  });

  test("rebinding is an explicit preview and keeps the old origin readable", async () => {
    const { origins, original, record, screens } = await setupConvertAndBind();
    await confirm(screens, record.id);
    const next = await screens.attachWireframeVersion(
      accountId,
      projectId,
      record.id,
      original,
    );
    expect(next.wireframeVersions).toHaveLength(2);

    const plan = await screens.previewRebind(accountId, {
      blockId: "b-card",
      originId: "origin-1",
      projectId,
      screenId: record.id,
      wireframeVersion: 2,
    });
    // The preview wrote nothing.
    expect(origins).toHaveLength(1);
    expect(origins[0]?.supersededAt).toBeNull();
    expect(plan).toMatchObject({
      from: { blockId: "b-cta", wireframeVersion: 1 },
      to: { blockId: "b-card", wireframeVersion: 2 },
    });

    const view = await screens.rebind(accountId, {
      newOriginId: "origin-2",
      plan,
      projectId,
    });
    expect(view.location).toMatchObject({
      blockId: "b-card",
      wireframeVersion: 2,
    });
    const all = await screens.origins(accountId, {
      projectId,
      screenId: record.id,
    });
    expect(
      all.map(({ id, supersededAt }) => [id, supersededAt !== null]),
    ).toEqual([
      ["origin-1", true],
      ["origin-2", false],
    ]);
    expect(all[0]?.location.blockId).toBe("b-cta");
  });

  test("a Screen in Trash is a broken target and the location is unavailable", async () => {
    const { record, screens } = await setupConvertAndBind();
    await confirm(screens, record.id);
    await screens.setLifecycle(accountId, {
      action: "trash",
      projectId,
      screenId: record.id,
    });
    const [view] = await screens.origins(accountId, {
      projectId,
      screenId: record.id,
    });
    expect(view?.screen).toMatchObject({ reason: "In Trash", state: "broken" });
    expect(view?.location.state).toBe("unavailable");
  });
});

describe("Live record cards", () => {
  test("moving a live card writes no source record field, status or relation", async () => {
    const { createdRecords, record, screens } = await setupConvertAndBind();
    await confirm(screens, record.id);
    const recordBefore = structuredClone([...createdRecords.entries()]);
    const cardDocument = documentWith(
      createLiveCardBlock("card-1", { x: 10, y: 10 }, {
        recordId: "record-1",
        recordType: "Decision",
      } as never),
    );
    await screens.saveWireframe(accountId, {
      document: cardDocument,
      projectId,
      screenId: record.id,
    });

    const moved = await screens.saveWireframe(accountId, {
      document: applyWireframeTransaction(cardDocument, [
        { blockId: "card-1", type: "moveBlock", x: 300, y: 200 },
      ]),
      projectId,
      screenId: record.id,
    });

    expect(moved.document.blocks[0]).toMatchObject({ x: 300, y: 200 });
    expect(moved.liveCards?.["card-1"]).toMatchObject({
      state: "resolved",
      title: "Start trial",
    });
    expect([...createdRecords.entries()]).toEqual(recordBefore);
  });

  test("a live card is read-only: its label cannot be edited and a gone record reads broken", async () => {
    const { record, screens } = await setupConvertAndBind();
    const cardDocument = documentWith(
      createLiveCardBlock(
        "card-1",
        { x: 0, y: 0 },
        {
          recordId: "gone",
          recordType: "Risk",
        },
      ),
    );
    expect(() =>
      applyWireframeTransaction(cardDocument, [
        { blockId: "card-1", label: "Edited", type: "setLabel" },
      ]),
    ).toThrow(WireframeDocumentError);
    const saved = await screens.saveWireframe(accountId, {
      document: cardDocument,
      projectId,
      screenId: record.id,
    });
    expect(saved.liveCards?.["card-1"]).toMatchObject({
      state: "broken",
      title: null,
    });
  });
});

describe("Wireframe templates", () => {
  test("a template keeps structure and placeholders but nothing of the source Project", async () => {
    const { record, screens, templates } = await setupConvertAndBind();
    const definition = await screens.createLinkedBlock(accountId, {
      content: {
        height: 44,
        kind: "Button",
        label: "Shared CTA",
        props: { variant: "primary" },
        width: 140,
      },
      name: "Shared CTA",
      projectId,
    });
    const base = createWireframeBlock("Button", "b-link", { x: 0, y: 300 });
    const live = {
      ...createWireframeBlock("Text", "t-live", { x: 0, y: 360 }),
      label: "Source copy",
      text: {
        mode: "live",
        source: { documentId: "doc-secret", sectionId: "s" },
        visibleText: "Source copy",
      },
    };
    const withLinks = applyWireframeTransaction(
      {
        ...documentWith(
          base,
          live as never,
          createLiveCardBlock(
            "card-1",
            { x: 0, y: 400 },
            {
              recordId: "work-77",
              recordType: "Work",
            },
          ),
        ),
        animations: [
          {
            durationMs: 300,
            id: "a-nav",
            kind: "screen-transition",
            targetScreenId: record.id,
            transition: "fade",
            triggerBlockId: "b-link",
          },
        ],
      },
      [
        {
          blockId: "b-link",
          definition: toDefinition(definition),
          type: "linkBlock",
        },
      ],
    );
    await screens.attachWireframeVersion(
      accountId,
      projectId,
      record.id,
      withLinks,
    );

    const saved = await screens.saveTemplate(accountId, {
      name: "Pricing page",
      projectId,
      screenId: record.id,
      wireframeVersion: 2,
    });
    const stored = JSON.stringify(templates.get(saved.id));

    expect(stored).not.toContain("work-77");
    expect(stored).not.toContain("doc-secret");
    expect(stored).not.toContain("Source copy");
    expect(stored).not.toContain(record.id);
    expect(stored).not.toContain('"screen-transition"');
    expect(stored).toContain(definition.id);
  });

  test("a Screen from a template is new and shares no definition with the source", async () => {
    const { record, screens } = await setupConvertAndBind();
    const definition = await screens.createLinkedBlock(accountId, {
      content: {
        height: 44,
        kind: "Button",
        label: "Shared CTA",
        props: { variant: "primary" },
        width: 140,
      },
      name: "Shared CTA",
      projectId,
    });
    const linked = applyWireframeTransaction(
      documentWith(createWireframeBlock("Button", "b-link", { x: 0, y: 0 })),
      [
        {
          blockId: "b-link",
          definition: toDefinition(definition),
          type: "linkBlock",
        },
      ],
    );
    await screens.attachWireframeVersion(
      accountId,
      projectId,
      record.id,
      linked,
    );
    const template = await screens.saveTemplate(accountId, {
      name: "Linked",
      projectId,
      screenId: record.id,
      wireframeVersion: 2,
    });
    expect(await screens.templates(accountId, projectId)).toHaveLength(1);

    const created = await screens.createScreenFromTemplate(accountId, {
      projectId,
      templateId: template.id,
      title: "Pricing copy",
    });

    expect(created.id).not.toBe(record.id);
    const wireframe = await screens.wireframe(accountId, {
      projectId,
      screenId: created.id,
    });
    const link = wireframe.document.blocks[0]?.link;
    expect(link?.definitionId).toBeDefined();
    expect(link?.definitionId).not.toBe(definition.id);
    const definitions = await screens.linkedBlocks(accountId, projectId);
    expect(definitions.map(({ id }) => id)).toContain(link?.definitionId);
    // Changing the source definition does not reach the new Screen.
    const preview = await screens.previewLinkedBlockChange(accountId, {
      content: { ...definition.content, label: "Changed" },
      definitionId: definition.id,
      projectId,
    });
    expect(
      preview.affectedScreens.map(({ screenId }) => screenId),
    ).not.toContain(created.id);
  });
});

const savedFixture: WireframeViewport = {
  centerX: 640,
  centerY: 400,
  collapsedGroups: ["Card"],
  zoom: 1.5,
};
const otherAccountId = "account-2";

describe("Personal viewport on a Screen's Wireframe canvas", () => {
  async function setup() {
    const harness = createMemoryStore();
    const record = await harness.screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    return { ...harness, record };
  }

  function address(screenId: string) {
    return { projectId: "project-1", screenId };
  }

  test("restores the last centre, zoom and view-local collapse across sessions", async () => {
    const { record, screens } = await setup();

    expect(await screens.viewport(accountId, address(record.id))).toEqual({
      viewport: null,
    });
    await screens.saveViewport(accountId, {
      ...address(record.id),
      viewport: savedFixture,
    });

    expect(await screens.viewport(accountId, address(record.id))).toEqual({
      viewport: savedFixture,
    });
  });

  test("belongs to this account and this Screen only", async () => {
    const { record, screens } = await setup();
    const second = await screens.create(accountId, {
      projectId: "project-1",
      title: "Settings",
    });
    await screens.saveViewport(accountId, {
      ...address(record.id),
      viewport: savedFixture,
    });

    expect(await screens.viewport(accountId, address(second.id))).toEqual({
      viewport: null,
    });
    // Another account has no project access and never reads this view.
    await expect(
      screens.viewport(otherAccountId, address(record.id)),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
  });

  test("is not written into the Wireframe document, versions or the Screen record", async () => {
    const { record, screens, stored } = await setup();
    const document = {
      ...createEmptyWireframeDocument(),
      blocks: [createWireframeBlock("Card", "c1", { x: 0, y: 0 })],
    };
    await screens.saveWireframe(accountId, {
      ...address(record.id),
      document,
    });
    const before = structuredClone(stored.get(record.id));
    const listBefore = JSON.stringify(
      await screens.list(accountId, "project-1"),
    );

    await screens.saveViewport(accountId, {
      ...address(record.id),
      viewport: savedFixture,
    });

    expect(stored.get(record.id)).toEqual(before);
    expect(JSON.stringify(await screens.list(accountId, "project-1"))).toBe(
      listBefore,
    );
    const wireframe = await screens.wireframe(accountId, address(record.id));
    expect(JSON.stringify(wireframe)).not.toContain("collapsedGroups");
    expect(Object.keys(wireframe)).not.toContain("viewport");
  });

  test("the document schema refuses a viewport, selection or any view state", () => {
    const document = createEmptyWireframeDocument();
    for (const smuggled of [
      { viewport: savedFixture },
      { selection: ["c1"] },
      { collapsedGroups: ["Card"] },
    ]) {
      expect(
        wireframeDocumentSchema.safeParse({ ...document, ...smuggled }).success,
      ).toBe(false);
    }
  });

  test("only centre, zoom and collapse are accepted; selection and edit state are not", async () => {
    const { record, screens } = await setup();

    const extras = [
      { selection: ["c1"] },
      { inspectorOpen: true },
      { editing: "c1" },
      { hover: "c1" },
      { unsavedOps: [] },
    ];
    await Promise.all(
      extras.map((extra) =>
        expect(
          screens.saveViewport(accountId, {
            ...address(record.id),
            viewport: { ...savedFixture, ...extra } as WireframeViewport,
          }),
        ).rejects.toThrow(),
      ),
    );
    expect(await screens.viewport(accountId, address(record.id))).toEqual({
      viewport: null,
    });
  });

  test("rejects NaN, infinite and absurd positions at the boundary", async () => {
    const { record, screens } = await setup();

    const broken = [
      { ...savedFixture, centerX: Number.NaN },
      { ...savedFixture, centerY: Number.POSITIVE_INFINITY },
      { ...savedFixture, zoom: 0 },
      { ...savedFixture, zoom: 40 },
    ];
    await Promise.all(
      broken.map((viewport) =>
        expect(
          screens.saveViewport(accountId, { ...address(record.id), viewport }),
        ).rejects.toThrow(),
      ),
    );
  });

  test("a Screen in Trash has no readable or writable viewport", async () => {
    const { record, screens } = await setup();
    await screens.saveViewport(accountId, {
      ...address(record.id),
      viewport: neutralViewport({ height: 800, width: 1280 }),
    });
    await screens.setLifecycle(accountId, {
      action: "trash",
      expectedRevision: record.revision,
      projectId: "project-1",
      screenId: record.id,
    });

    await expect(
      screens.viewport(accountId, address(record.id)),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
    await expect(
      screens.saveViewport(accountId, {
        ...address(record.id),
        viewport: savedFixture,
      }),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
  });
});

const stageJson = JSON.stringify({
  attrs: { height: 800, width: 1280 },
  children: [{ attrs: {}, children: [], className: "Layer" }],
  className: "Stage",
});

function block(kind: WireframeBlockKind, id: string, at = { x: 10, y: 10 }) {
  return createWireframeBlock(kind, id, at);
}

function documentWithWireframes(
  ...blocks: WireframeBlock[]
): WireframeDocument {
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
      ...documentWithWireframes(
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
      document: documentWithWireframes(block("Card", "c1")),
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
        document: documentWithWireframes(),
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
      documentWithWireframes(liveTextBlock("")),
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
      document: documentWithWireframes(liveTextBlock("Hello")),
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
        documentWithWireframes(block("Navigation", id, { x: 0, y: 0 })),
        [{ blockId: id, definition: snapshot, type: "linkBlock" }],
      );
    await Promise.all(
      [home, pricing, trashedScreen].map((wireframeScreen) =>
        harness.screens.saveWireframe(accountId, {
          document: instanceOf(`nav-${wireframeScreen.id}`),
          projectId: "project-1",
          screenId: wireframeScreen.id,
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
        documentWithWireframes(
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
    const document = documentWithWireframes(block("Button", "a"));

    expect(() =>
      applyWireframeTransaction(document, [
        { blockId: "a", type: "moveBlock", x: 5, y: 5 },
        { blockId: "missing", type: "moveBlock", x: 1, y: 1 },
      ]),
    ).toThrow(WireframeDocumentError);
    expect(document.blocks[0]).toMatchObject({ x: 10, y: 10 });
  });
});
