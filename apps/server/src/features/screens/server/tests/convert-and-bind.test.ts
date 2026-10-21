import {
  confirmConvertAndBindInputSchema,
  previewConvertAndBindInputSchema,
  SOURCE_ITEM_GONE_LABEL,
} from "@cantiara/api/screen-origins";
import { applyWireframeTransaction } from "@cantiara/api/wireframe-commands";
import {
  createEmptyWireframeDocument,
  createLiveCardBlock,
  createWireframeBlock,
  type WireframeDocument,
  WireframeDocumentError,
  type WireframeLinkedDefinition,
} from "@cantiara/api/wireframe-document";
import { describe, expect, test } from "vitest";

import { ScreenConversionStaleError } from "../screens";
import { accountId, createMemoryStore } from "../screens-memory-store";

const projectId = "project-1";

function documentWith(
  ...blocks: ReturnType<typeof createWireframeBlock>[]
): WireframeDocument {
  return { ...createEmptyWireframeDocument(), blocks };
}

async function setup() {
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
  screens: Awaited<ReturnType<typeof setup>>["screens"],
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
    const { createdRecords, origins, record, screens } = await setup();

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
    const { record, screens } = await setup();
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
    const { record, screens } = await setup();
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
      await setup();

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
    const { createdRecords, origins, record, screens } = await setup();
    await confirm(screens, record.id);
    await confirm(screens, record.id);
    expect(createdRecords.size).toBe(1);
    expect(origins).toHaveLength(1);
  });

  test("a plan edited after preview is stale and creates nothing", async () => {
    const { createdRecords, original, record, screens } = await setup();
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
    const { record, screens } = await setup();
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
    const { createdRecords, original, record, screens } = await setup();
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
    const { original, record, screens } = await setup();
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
    const { original, record, screens } = await setup();
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
    const { original, record, screens } = await setup();
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
    const { origins, original, record, screens } = await setup();
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
    const { record, screens } = await setup();
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
    const { createdRecords, record, screens } = await setup();
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
    const { record, screens } = await setup();
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
    const { record, screens, templates } = await setup();
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
    const { record, screens } = await setup();
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
