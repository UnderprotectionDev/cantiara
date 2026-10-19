import type { Context } from "@cantiara/api/context";
import type { MoodboardSnapshotsAccess } from "@cantiara/api/moodboard-snapshot";
import { presentationSequence } from "@cantiara/api/moodboard-view";
import {
  EMPTY_PERSONAL_VIEW,
  type PersonalMoodboardView,
  type PersonalMoodboardViewsAccess,
} from "@cantiara/api/moodboard-viewport";
import {
  type Moodboard,
  type MoodboardMutationContracts,
  type MoodboardMutationValue,
  type MoodboardsAccess,
  moodboardSchema,
} from "@cantiara/api/moodboards";
import type {
  MutationApply,
  MutationCommand,
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import { appRouter } from "@cantiara/api/routers/index";
import {
  moodboardColorSwatch,
  moodboardPaletteGroup,
} from "@cantiara/db/schema/moodboard";
import { createRouterClient } from "@orpc/server";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, test, vi } from "vitest";

import {
  buildMoodboardSnapshotOutput,
  previewMoodboardSnapshot,
} from "./moodboard-snapshots-database";

const MOODBOARD_TABLE_NAME = /^moodboard/;
const PRODUCT_THEME_COLUMN =
  /theme|appearance|effect|token|css|custom_field|wall|highlight/;
const PRODUCT_THEME_KEY = /theme|token|css|wall|highlight/i;
const COLOR_ROUTE_NAME = /moodboard|swatch|palette|color|colour/i;
const FORBIDDEN_ROUTE_NAME =
  /stock|unsplash|pexels|(color|colour|palette|swatch).*(suggest|recommend|extract|generate)|(suggest|recommend|extract|generate).*(color|colour|palette|swatch)/i;

const PERSONAL_VIEW_LEAK = /9876\.5|1234\.5|centerX|viewport|collapsed/;
const SHARING_COPY = /share link|Build in Public/;

const accountId = "account-1";
const projectId = "project-1";

/** Minimal in-memory Moodboard store honouring the mutation contract's revision rule. */
function createFixture() {
  let stored: MoodboardMutationValue = { moodboard: null };
  let revision = 0;
  const fakeContract: MutationContract<MoodboardMutationValue> = {
    mutate: async <TPayload extends MutationPayload>(
      command: MutationCommand<TPayload>,
      apply: MutationApply<MoodboardMutationValue, TPayload>,
    ) => {
      if (command.kind !== "human" || command.baseRevision !== revision) {
        throw Object.assign(new Error("stale"), { code: "CONFLICT" });
      }
      const previousValue = stored;
      const nextValue = await apply({
        currentRevision: revision,
        currentValue: stored,
        payload: command.payload,
      } as Parameters<typeof apply>[0]);
      stored = nextValue;
      revision += 1;
      return {
        actor: command.actor,
        committedAt: "2026-10-19T09:00:00.000Z",
        id: crypto.randomUUID(),
        nextValue,
        origin: {
          clientIdempotencyKey: command.clientIdempotencyKey,
          kind: "human" as const,
        },
        payloadFingerprint: "0".repeat(64),
        previousValue,
        revision,
        targetId: command.targetId,
      };
    },
    replay: () => Promise.resolve(null),
  };
  const contracts: MoodboardMutationContracts = {
    addColorSwatch: () => fakeContract,
    addPaletteGroup: () => fakeContract,
    addVisual: () => fakeContract,
    assignColorSwatchPaletteGroup: () => fakeContract,
    create: () => fakeContract,
    reorderItems: () => fakeContract,
    setFocusOrder: () => fakeContract,
    setVisualView: () => fakeContract,
    updateVisualCaption: () => fakeContract,
  };
  const access: MoodboardsAccess = {
    get: async () => stored.moodboard,
    list: async (_account, requestedProjectId) =>
      requestedProjectId === projectId && stored.moodboard
        ? [stored.moodboard]
        : [],
  };
  // Snapshot service over the same in-memory Moodboard: the real builder with a
  // fake renderer and an object store that can only read.
  const originalReads = vi.fn(() => Promise.resolve<Uint8Array | null>(null));
  const rendered = { pages: [] as { tiles: unknown[] }[][] };
  const snapshots: MoodboardSnapshotsAccess = {
    export(_account, input) {
      const board = stored.moodboard;
      if (!board || board.id !== input.moodboardId) {
        return Promise.resolve(null);
      }
      return buildMoodboardSnapshotOutput(board, input, {
        loadOriginalBytes: originalReads,
        now: () => new Date("2026-10-19T10:00:00.000Z"),
        renderer: {
          pdf: (pages) => {
            rendered.pages.push([...pages]);
            return Promise.resolve(new Uint8Array([37, 80, 68, 70]));
          },
          png: (pages) => {
            rendered.pages.push([...pages]);
            return Promise.resolve(pages.map(() => new Uint8Array([137, 80])));
          },
        },
      });
    },
    preview(_account, input) {
      const board = stored.moodboard;
      return Promise.resolve(
        board && board.id === input.moodboardId
          ? previewMoodboardSnapshot(
              board,
              input.itemIds,
              new Date("2026-10-19T10:00:00.000Z"),
            )
          : null,
      );
    },
  };
  // Counterparts a Moodboard edit must never touch.
  const usageLinkMutationContracts = {
    create: vi.fn(),
    delete: vi.fn(),
  };
  const fileAttachments = {
    updateDescription: vi.fn(),
    upload: vi.fn(),
  };
  // Account theme/Appearance, Completion effect, custom field, and design-token
  // access: a Color Swatch must never reach any of them.
  const forbidden = {
    accountPreferences: { save: vi.fn(), saveAppearance: vi.fn() },
    completionEffectsPreferences: { get: vi.fn(), save: vi.fn() },
    completionEffectsPreferencesMutationContract: { mutate: vi.fn() },
    customFieldMutationContracts: {
      create: vi.fn(),
      update: vi.fn(),
    },
    customFields: { list: vi.fn() },
  };
  // Personal viewport store keyed by Account and Moodboard; it is separate from
  // the Moodboard record on purpose.
  const personalViews = new Map<string, PersonalMoodboardView>();
  const moodboardPersonalViews: PersonalMoodboardViewsAccess = {
    get: (account, moodboardId) =>
      Promise.resolve(
        stored.moodboard?.id === moodboardId && account === accountId
          ? (personalViews.get(`${account}:${moodboardId}`) ??
              EMPTY_PERSONAL_VIEW)
          : null,
      ),
    save: (account, moodboardId, view) => {
      if (stored.moodboard?.id !== moodboardId || account !== accountId) {
        return Promise.resolve(null);
      }
      personalViews.set(`${account}:${moodboardId}`, view);
      return Promise.resolve(view);
    },
  };
  const context = {
    ...forbidden,
    auth: null,
    db: {} as Context["db"],
    fileAttachments,
    moodboardMutationContracts: contracts,
    moodboardPersonalViews,
    moodboardSnapshots: snapshots,
    moodboards: access,
    session: {
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"],
    usageLinkMutationContracts,
  } as unknown as Context;
  const otherAccountContext = {
    ...context,
    session: {
      session: { id: "session-2" },
      user: { id: "account-2" },
    } as Context["session"],
  } as Context;
  return {
    client: createRouterClient(appRouter, { context }),
    otherAccountClient: createRouterClient(appRouter, {
      context: otherAccountContext,
    }),
    fileAttachments,
    forbidden,
    originalReads,
    rendered,
    snapshotted: () => stored.moodboard,
    usageLinkMutationContracts,
  };
}

function createMoodboard(client: ReturnType<typeof createFixture>["client"]) {
  return client.createMoodboard({
    baseRevision: 0,
    clientIdempotencyKey: crypto.randomUUID(),
    projectId,
    title: "  Launch direction  ",
  });
}

describe("Moodboards", () => {
  test("creates a Project-scoped Moodboard with a trimmed title and no items", async () => {
    const { client } = createFixture();

    const created = await createMoodboard(client);

    expect(moodboardSchema.parse(created)).toMatchObject({
      items: [],
      projectId,
      revision: 1,
      title: "Launch direction",
    });
    await expect(client.moodboards({ projectId })).resolves.toEqual([created]);
  });

  test("keeps the exact File Attachment version or external-link origin and caption", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);

    const withFile = await client.addMoodboardVisual({
      baseRevision: board.revision,
      caption: "  Warm, grainy light  ",
      clientIdempotencyKey: "visual-file",
      moodboardId: board.id,
      origin: {
        attachmentVersionId: "attachment-version-2",
        kind: "File Attachment version",
      },
    });
    const withLink = await client.addMoodboardVisual({
      baseRevision: withFile.revision,
      clientIdempotencyKey: "visual-link",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/ref.png?x=1" },
    });

    expect(
      withLink.items
        .filter((item) => item.kind === "Visual")
        .map(({ id, origin, caption, position }) => ({
          caption,
          id,
          origin,
          position,
        })),
    ).toEqual([
      {
        caption: "Warm, grainy light",
        id: "visual-file",
        origin: {
          attachmentVersionId: "attachment-version-2",
          kind: "File Attachment version",
        },
        position: 0,
      },
      {
        caption: null,
        id: "visual-link",
        origin: {
          kind: "External link",
          url: "https://example.com/ref.png?x=1",
        },
        position: 1,
      },
    ]);
  });

  test("editing a caption never changes the origin and clearing it stores null", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);
    const added = await client.addMoodboardVisual({
      baseRevision: board.revision,
      caption: "First",
      clientIdempotencyKey: "visual-1",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/a" },
    });

    const edited = await client.updateMoodboardVisualCaption({
      baseRevision: added.revision,
      caption: "Second",
      clientIdempotencyKey: crypto.randomUUID(),
      itemId: "visual-1",
      moodboardId: board.id,
    });
    const cleared = await client.updateMoodboardVisualCaption({
      baseRevision: edited.revision,
      caption: null,
      clientIdempotencyKey: crypto.randomUUID(),
      itemId: "visual-1",
      moodboardId: board.id,
    });

    expect(edited.items[0]).toMatchObject({
      caption: "Second",
      origin: { kind: "External link", url: "https://example.com/a" },
    });
    expect(cleared.items[0]).toMatchObject({
      caption: null,
      origin: { kind: "External link", url: "https://example.com/a" },
    });
  });

  test("rejects an origin that is neither a File Attachment version nor an http(s) link, and over-long captions", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);
    const base = {
      baseRevision: board.revision,
      clientIdempotencyKey: "visual-bad",
      moodboardId: board.id,
    };

    await expect(
      client.addMoodboardVisual({
        ...base,
        origin: { kind: "External link", url: "javascript:alert(1)" },
      }),
    ).rejects.toThrow();
    await expect(
      client.addMoodboardVisual({
        ...base,
        origin: { kind: "External link", url: "not a url" },
      }),
    ).rejects.toThrow();
    await expect(
      client.addMoodboardVisual({
        ...base,
        // @ts-expect-error a visual must name a File Attachment version or link
        origin: { kind: "Screen", screenId: "screen-1" },
      }),
    ).rejects.toThrow();
    await expect(
      client.addMoodboardVisual({
        ...base,
        caption: "x".repeat(281),
        origin: { kind: "External link", url: "https://example.com/a" },
      }),
    ).rejects.toThrow();
  });

  test("a stale Moodboard revision conflicts instead of overwriting", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);
    await client.addMoodboardVisual({
      baseRevision: board.revision,
      clientIdempotencyKey: "visual-1",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/a" },
    });

    await expect(
      client.addMoodboardVisual({
        baseRevision: board.revision,
        clientIdempotencyKey: "visual-2",
        moodboardId: board.id,
        origin: { kind: "External link", url: "https://example.com/b" },
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("placing and editing a reference creates no Project Wall card and no second file description", async () => {
    const { client, fileAttachments, usageLinkMutationContracts } =
      createFixture();
    const board = await createMoodboard(client);
    const added = await client.addMoodboardVisual({
      baseRevision: board.revision,
      caption: "Why this one",
      clientIdempotencyKey: "visual-1",
      moodboardId: board.id,
      origin: {
        attachmentVersionId: "attachment-version-1",
        kind: "File Attachment version",
      },
    });
    await client.updateMoodboardVisualCaption({
      baseRevision: added.revision,
      caption: "Changed reason",
      clientIdempotencyKey: crypto.randomUUID(),
      itemId: "visual-1",
      moodboardId: board.id,
    });

    expect(usageLinkMutationContracts.create).not.toHaveBeenCalled();
    expect(fileAttachments.updateDescription).not.toHaveBeenCalled();
    expect(fileAttachments.upload).not.toHaveBeenCalled();
  });

  test("a reference carries no Screen, production-asset, thread, reaction, task, or mention identity", async () => {
    const { client } = createFixture();
    const board: Moodboard = await createMoodboard(client);
    const withVisual = await client.addMoodboardVisual({
      baseRevision: board.revision,
      caption: "Mood",
      clientIdempotencyKey: "visual-1",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/a" },
    });

    expect(Object.keys(withVisual.items[0] ?? {}).sort()).toEqual([
      "caption",
      "createdAt",
      "id",
      "kind",
      "origin",
      "position",
      "updatedAt",
      "view",
    ]);
    expect(withVisual.items[0]?.kind).toBe("Visual");
    // A strict schema rejects attempts to smuggle extra identity onto a visual.
    expect(
      moodboardSchema.safeParse({
        ...withVisual,
        items: [{ ...withVisual.items[0], screenId: "screen-1" }],
      }).success,
    ).toBe(false);
  });
});

describe("Moodboards Color Swatch", () => {
  const redInputs = ["#f00", "rgb(255, 0, 0)", "hsl(0, 100%, 50%)"];

  test.each(redInputs)(
    "stores %s as one normalized HEX with a trimmed note",
    async (entry) => {
      const { client } = createFixture();
      const board = await createMoodboard(client);

      const withSwatch = await client.addColorSwatch({
        baseRevision: board.revision,
        clientIdempotencyKey: "swatch-1",
        color: entry,
        moodboardId: board.id,
        note: "  Warning accent  ",
      });

      expect(withSwatch.items).toEqual([
        {
          color: "#FF0000",
          createdAt: expect.any(String),
          id: "swatch-1",
          kind: "Color Swatch",
          note: "Warning accent",
          paletteGroupId: null,
          position: 0,
          updatedAt: expect.any(String),
        },
      ]);
    },
  );

  test("rejects a value that is not HEX, RGB, or HSL and an over-long note", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);
    const base = {
      baseRevision: board.revision,
      clientIdempotencyKey: "swatch-bad",
      moodboardId: board.id,
    };

    await expect(
      client.addColorSwatch({ ...base, color: "tomato" }),
    ).rejects.toThrow();
    await expect(
      client.addColorSwatch({ ...base, color: "rgb(300, 0, 0)" }),
    ).rejects.toThrow();
    await expect(
      client.addColorSwatch({
        ...base,
        color: "#fff",
        note: "x".repeat(141),
      }),
    ).rejects.toThrow();
  });

  test("palette group membership: swatches join, move between, and leave groups", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);
    const withGroup = await client.addPaletteGroup({
      baseRevision: board.revision,
      clientIdempotencyKey: "group-warm",
      moodboardId: board.id,
      name: "  Warm  ",
    });
    const withSecondGroup = await client.addPaletteGroup({
      baseRevision: withGroup.revision,
      clientIdempotencyKey: "group-cool",
      moodboardId: board.id,
      name: "Cool",
    });
    const grouped = await client.addColorSwatch({
      baseRevision: withSecondGroup.revision,
      clientIdempotencyKey: "swatch-1",
      color: "#ff8800",
      moodboardId: board.id,
      paletteGroupId: "group-warm",
    });
    const moved = await client.assignColorSwatchPaletteGroup({
      baseRevision: grouped.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      itemId: "swatch-1",
      moodboardId: board.id,
      paletteGroupId: "group-cool",
    });
    const left = await client.assignColorSwatchPaletteGroup({
      baseRevision: moved.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      itemId: "swatch-1",
      moodboardId: board.id,
      paletteGroupId: null,
    });

    expect(withSecondGroup.paletteGroups).toEqual([
      { id: "group-warm", name: "Warm", position: 0 },
      { id: "group-cool", name: "Cool", position: 1 },
    ]);
    expect(grouped.items[0]).toMatchObject({ paletteGroupId: "group-warm" });
    expect(moved.items[0]).toMatchObject({ paletteGroupId: "group-cool" });
    expect(left.items[0]).toMatchObject({ paletteGroupId: null });
    expect(left.paletteGroups).toHaveLength(2);
  });

  test("swatches and visuals share one ordered item list", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);
    const withVisual = await client.addMoodboardVisual({
      baseRevision: board.revision,
      clientIdempotencyKey: "visual-1",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/a" },
    });
    const withSwatch = await client.addColorSwatch({
      baseRevision: withVisual.revision,
      clientIdempotencyKey: "swatch-1",
      color: "#123456",
      moodboardId: board.id,
    });
    const captioned = await client.updateMoodboardVisualCaption({
      baseRevision: withSwatch.revision,
      caption: "Still works",
      clientIdempotencyKey: crypto.randomUUID(),
      itemId: "visual-1",
      moodboardId: board.id,
    });

    expect(
      captioned.items.map(({ id, kind, position }) => [id, kind, position]),
    ).toEqual([
      ["visual-1", "Visual", 0],
      ["swatch-1", "Color Swatch", 1],
    ]);
    expect(captioned.items[1]).toMatchObject({ color: "#123456" });
  });

  test("a swatch writes no Account theme, Completion effect, token, custom field, or Project Wall highlight", async () => {
    const { client, forbidden, usageLinkMutationContracts } = createFixture();
    const board = await createMoodboard(client);
    const withGroup = await client.addPaletteGroup({
      baseRevision: board.revision,
      clientIdempotencyKey: "group-1",
      moodboardId: board.id,
      name: "Brand",
    });
    const withSwatch = await client.addColorSwatch({
      baseRevision: withGroup.revision,
      clientIdempotencyKey: "swatch-1",
      color: "#0a84ff",
      moodboardId: board.id,
      paletteGroupId: "group-1",
    });
    await client.assignColorSwatchPaletteGroup({
      baseRevision: withSwatch.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      itemId: "swatch-1",
      moodboardId: board.id,
      paletteGroupId: null,
    });

    for (const access of Object.values(forbidden)) {
      for (const method of Object.values(access)) {
        expect(method).not.toHaveBeenCalled();
      }
    }
    expect(usageLinkMutationContracts.create).not.toHaveBeenCalled();
  });

  test("swatch and palette tables reference only Moodboard tables, never theme, effect, token, custom field, or wall tables", () => {
    for (const table of [moodboardColorSwatch, moodboardPaletteGroup]) {
      const { foreignKeys, columns } = getTableConfig(table);
      for (const foreignKey of foreignKeys) {
        expect(
          getTableConfig(foreignKey.reference().foreignTable).name,
        ).toMatch(MOODBOARD_TABLE_NAME);
      }
      expect(columns.map(({ name }) => name).join(",")).not.toMatch(
        PRODUCT_THEME_COLUMN,
      );
    }
    expect(
      Object.keys(moodboardColorSwatch).filter((key) =>
        PRODUCT_THEME_KEY.test(key),
      ),
    ).toEqual([]);
  });

  test("the router has no stock-image search or automatic color suggestion path", () => {
    const names = Object.keys(appRouter).filter((name) =>
      COLOR_ROUTE_NAME.test(name),
    );

    expect(names.length).toBeGreaterThan(0);
    expect(
      Object.keys(appRouter).filter((name) => FORBIDDEN_ROUTE_NAME.test(name)),
    ).toEqual([]);
    expect(names.sort()).toEqual([
      "addColorSwatch",
      "addMoodboardVisual",
      "addPaletteGroup",
      "assignColorSwatchPaletteGroup",
      "createMoodboard",
      "exportMoodboardSnapshot",
      "moodboardPersonalView",
      "moodboardSnapshotPreview",
      "moodboards",
      "reorderMoodboardItems",
      "saveMoodboardPersonalView",
      "setMoodboardFocusOrder",
      "setMoodboardVisualView",
      "updateMoodboardVisualCaption",
    ]);
  });

  test("Crop and Rotate 90° change only the targeted visual's view and are reversible with Reset view", async () => {
    const { client, fileAttachments } = createFixture();
    const board = await createMoodboard(client);
    const attachment = {
      attachmentVersionId: "attachment-version-1",
      kind: "File Attachment version",
    } as const;
    const first = await client.addMoodboardVisual({
      baseRevision: board.revision,
      clientIdempotencyKey: "visual-a",
      moodboardId: board.id,
      origin: attachment,
    });
    const both = await client.addMoodboardVisual({
      baseRevision: first.revision,
      clientIdempotencyKey: "visual-b",
      moodboardId: board.id,
      origin: attachment,
    });

    const edited = await client.setMoodboardVisualView({
      baseRevision: both.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      crop: { height: 5000, left: 1000, top: 2000, width: 6000 },
      itemId: "visual-a",
      moodboardId: board.id,
      rotation: 90,
    });
    const reset = await client.setMoodboardVisualView({
      baseRevision: edited.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      crop: null,
      itemId: "visual-a",
      moodboardId: board.id,
      rotation: 0,
    });

    expect(edited.items[0]).toMatchObject({
      origin: attachment,
      view: {
        crop: { height: 5000, left: 1000, top: 2000, width: 6000 },
        rotation: 90,
      },
    });
    // The same exact attachment version on the other visual stays unedited.
    expect(edited.items[1]).toMatchObject({
      origin: attachment,
      view: { crop: null, rotation: 0 },
    });
    expect(reset.items[0]).toMatchObject({ view: { crop: null, rotation: 0 } });
    expect(fileAttachments.updateDescription).not.toHaveBeenCalled();
    expect(fileAttachments.upload).not.toHaveBeenCalled();
  });

  test("rejects a crop outside the image and a rotation that is not a quarter turn", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);
    const added = await client.addMoodboardVisual({
      baseRevision: board.revision,
      clientIdempotencyKey: "visual-a",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/a" },
    });
    const base = {
      baseRevision: added.revision,
      clientIdempotencyKey: "view",
      itemId: "visual-a",
      moodboardId: board.id,
    };

    await expect(
      client.setMoodboardVisualView({
        ...base,
        crop: { height: 5000, left: 6000, top: 0, width: 6000 },
        rotation: 0,
      }),
    ).rejects.toThrow();
    await expect(
      client.setMoodboardVisualView({
        ...base,
        crop: null,
        // @ts-expect-error only quarter turns are valid
        rotation: 45,
      }),
    ).rejects.toThrow();
  });

  test("Presentation Mode reads the same items in Focus order and copies no content", async () => {
    const { client, fileAttachments } = createFixture();
    const board = await createMoodboard(client);
    const one = await client.addMoodboardVisual({
      baseRevision: board.revision,
      clientIdempotencyKey: "visual-1",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/a" },
    });
    const two = await client.addColorSwatch({
      baseRevision: one.revision,
      clientIdempotencyKey: "swatch-1",
      color: "#112233",
      moodboardId: board.id,
    });

    const ordered = await client.setMoodboardFocusOrder({
      baseRevision: two.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      itemIds: ["swatch-1", "visual-1"],
      moodboardId: board.id,
    });
    const [stored] = await client.moodboards({ projectId });

    expect(ordered.focusOrder).toEqual(["swatch-1", "visual-1"]);
    expect(ordered.items).toEqual(two.items);
    expect(
      presentationSequence(ordered.items, ordered.focusOrder).map(
        ({ id }) => id,
      ),
    ).toEqual(["swatch-1", "visual-1"]);
    // The sequence yields the board's own item objects, not copies.
    expect(presentationSequence(ordered.items, ordered.focusOrder)[1]).toBe(
      ordered.items[0],
    );
    expect(presentationSequence(two.items, []).map(({ id }) => id)).toEqual([
      "visual-1",
      "swatch-1",
    ]);
    expect(stored?.items).toEqual(two.items);
    expect(fileAttachments.upload).not.toHaveBeenCalled();
    await expect(
      client.setMoodboardFocusOrder({
        baseRevision: ordered.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        itemIds: ["visual-1", "visual-1"],
        moodboardId: board.id,
      }),
    ).rejects.toThrow();
  });

  test("Snapshot preview states no live links, the moment, and the applied Crop or Rotate 90°, and writes nothing", async () => {
    const { client, forbidden, snapshotted, usageLinkMutationContracts } =
      createFixture();
    const board = await createMoodboard(client);
    const added = await client.addMoodboardVisual({
      baseRevision: board.revision,
      caption: "Hero",
      clientIdempotencyKey: "visual-1",
      moodboardId: board.id,
      origin: {
        attachmentVersionId: "attachment-version-1",
        kind: "File Attachment version",
      },
    });
    const rotated = await client.setMoodboardVisualView({
      baseRevision: added.revision,
      clientIdempotencyKey: crypto.randomUUID(),
      crop: null,
      itemId: "visual-1",
      moodboardId: board.id,
      rotation: 270,
    });
    const before = structuredClone(snapshotted());

    const preview = await client.moodboardSnapshotPreview({
      itemIds: ["visual-1"],
      moodboardId: board.id,
    });

    expect(preview.notices.join(" ")).toContain("no live source links");
    expect(preview.moment).toContain("2026-10-19");
    expect(preview.moment).toContain(`revision ${rotated.revision}`);
    expect(preview.transforms).toEqual([
      { caption: "Hero", crop: false, itemId: "visual-1", rotation: 270 },
    ]);
    expect(preview.notices.join(" ")).toContain("Rotate 90°");
    expect(preview.notices.join(" ")).not.toMatch(SHARING_COPY);
    expect(snapshotted()).toEqual(before);
    expect(usageLinkMutationContracts.create).not.toHaveBeenCalled();
    for (const access of Object.values(forbidden)) {
      for (const method of Object.values(access)) {
        expect(method).not.toHaveBeenCalled();
      }
    }
  });

  test("Snapshot export leaves the source visuals identical, groups PDF pages per section, and PNG as separate images", async () => {
    const { client, originalReads, rendered, snapshotted, fileAttachments } =
      createFixture();
    let board = await createMoodboard(client);
    board = await client.addPaletteGroup({
      baseRevision: board.revision,
      clientIdempotencyKey: "group-1",
      moodboardId: board.id,
      name: "Warm",
    });
    for (const [index, key] of [
      "v1",
      "v2",
      "v3",
      "v4",
      "v5",
      "v6",
      "v7",
    ].entries()) {
      // biome-ignore lint/performance/noAwaitInLoops: Each revision builds on the previous one.
      board = await client.addMoodboardVisual({
        baseRevision: board.revision,
        clientIdempotencyKey: key,
        moodboardId: board.id,
        origin: { kind: "External link", url: `https://example.com/${index}` },
      });
    }
    board = await client.addColorSwatch({
      baseRevision: board.revision,
      clientIdempotencyKey: "s1",
      color: "#AA0000",
      moodboardId: board.id,
      paletteGroupId: "group-1",
    });
    const itemIds = board.items.map(({ id }) => id);
    const sourcesBefore = structuredClone(snapshotted());

    const pdf = await client.exportMoodboardSnapshot({
      format: "PDF",
      itemIds,
      moodboardId: board.id,
    });
    const png = await client.exportMoodboardSnapshot({
      format: "PNG",
      itemIds,
      moodboardId: board.id,
    });

    // Visuals: 7 -> 2 pages (6 + 1); Palette group Warm: 1 page. Never one page.
    expect(pdf.preview.pageCount).toBe(3);
    expect(pdf.files).toHaveLength(1);
    expect(pdf.files[0]).toMatchObject({ mimeType: "application/pdf" });
    expect(pdf.files[0]?.fileName).toContain("2026-10-19");
    expect(rendered.pages[0]?.map(({ tiles }) => tiles.length)).toEqual([
      6, 1, 1,
    ]);
    expect(png.files).toHaveLength(3);
    expect(new Set(png.files.map(({ fileName }) => fileName)).size).toBe(3);
    expect(png.files.every(({ mimeType }) => mimeType === "image/png")).toBe(
      true,
    );
    // Source visuals and the File Attachment boundary are identical after.
    expect(snapshotted()).toEqual(sourcesBefore);
    expect(fileAttachments.updateDescription).not.toHaveBeenCalled();
    expect(fileAttachments.upload).not.toHaveBeenCalled();
    expect(originalReads).not.toHaveBeenCalled();
  });

  test("Snapshot refuses an empty selection and items that are not on the Moodboard", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);

    await expect(
      client.moodboardSnapshotPreview({ itemIds: [], moodboardId: board.id }),
    ).rejects.toThrow();
    await expect(
      client.moodboardSnapshotPreview({
        itemIds: ["missing"],
        moodboardId: board.id,
      }),
    ).rejects.toThrow();
  });
  test("reorders existing items as a permutation and refuses to drop or invent items", async () => {
    const { client } = createFixture();
    const board = await createMoodboard(client);
    const first = await client.addColorSwatch({
      baseRevision: board.revision,
      clientIdempotencyKey: "swatch-a",
      color: "#112233",
      moodboardId: board.id,
    });
    const second = await client.addMoodboardVisual({
      baseRevision: first.revision,
      clientIdempotencyKey: "visual-b",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/b.png" },
    });

    const reordered = await client.reorderMoodboardItems({
      baseRevision: second.revision,
      clientIdempotencyKey: "reorder-1",
      itemIds: ["visual-b", "swatch-a"],
      moodboardId: board.id,
    });

    expect(reordered.items.map(({ id, position }) => [id, position])).toEqual([
      ["visual-b", 0],
      ["swatch-a", 1],
    ]);
    expect(moodboardSchema.parse(reordered).revision).toBe(second.revision + 1);
    await expect(
      client.reorderMoodboardItems({
        baseRevision: reordered.revision,
        clientIdempotencyKey: "reorder-2",
        itemIds: ["visual-b", "swatch-a", "swatch-a"],
        moodboardId: board.id,
      }),
    ).rejects.toThrow();
  });

  test("personal viewport and collapse are saved per Account and Moodboard, never in the Moodboard record", async () => {
    const { client, otherAccountClient, snapshotted } = createFixture();
    const board = await createMoodboard(client);
    const recordBefore = JSON.stringify(snapshotted());

    await expect(
      client.moodboardPersonalView({ moodboardId: board.id }),
    ).resolves.toEqual({ collapsed: [], viewport: null });
    const saved = await client.saveMoodboardPersonalView({
      moodboardId: board.id,
      view: {
        collapsed: ["visuals"],
        viewport: { centerX: 120.5, centerY: -40, zoom: 0.75 },
      },
    });

    expect(saved).toEqual({
      collapsed: ["visuals"],
      viewport: { centerX: 120.5, centerY: -40, zoom: 0.75 },
    });
    // Restored in a later session.
    await expect(
      client.moodboardPersonalView({ moodboardId: board.id }),
    ).resolves.toEqual(saved);
    // The Moodboard record and its revision are untouched.
    expect(JSON.stringify(snapshotted())).toBe(recordBefore);
    // Another Account neither reads nor writes this view.
    await expect(
      otherAccountClient.moodboardPersonalView({ moodboardId: board.id }),
    ).rejects.toThrow();
    await expect(
      otherAccountClient.saveMoodboardPersonalView({
        moodboardId: board.id,
        view: { collapsed: [], viewport: null },
      }),
    ).rejects.toThrow();
    // Selection, inspector, and unsaved operations are not accepted fields.
    await expect(
      client.saveMoodboardPersonalView({
        moodboardId: board.id,
        view: {
          collapsed: [],
          selection: ["x"],
          viewport: null,
        } as never,
      }),
    ).rejects.toThrow();
    // Out-of-range zoom and non-finite centers are refused.
    await expect(
      client.saveMoodboardPersonalView({
        moodboardId: board.id,
        view: {
          collapsed: [],
          viewport: { centerX: 0, centerY: 0, zoom: 100 },
        },
      }),
    ).rejects.toThrow();
  });

  test("the personal viewport is absent from the Moodboard record and Snapshot output", async () => {
    const { client, snapshotted } = createFixture();
    const board = await createMoodboard(client);
    const withVisual = await client.addMoodboardVisual({
      baseRevision: board.revision,
      clientIdempotencyKey: "visual-1",
      moodboardId: board.id,
      origin: { kind: "External link", url: "https://example.com/a.png" },
    });
    await client.saveMoodboardPersonalView({
      moodboardId: board.id,
      view: {
        collapsed: ["visuals"],
        viewport: { centerX: 9876.5, centerY: 1234.5, zoom: 2 },
      },
    });

    const preview = await client.moodboardSnapshotPreview({
      itemIds: ["visual-1"],
      moodboardId: board.id,
    });
    const exported = JSON.stringify([snapshotted(), preview, withVisual]);

    expect(exported).not.toMatch(PERSONAL_VIEW_LEAK);
    expect(Object.keys(moodboardSchema.shape)).not.toContain("viewport");
  });
});
