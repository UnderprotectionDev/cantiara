import type { Context } from "@cantiara/api/context";
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

const MOODBOARD_TABLE_NAME = /^moodboard/;
const PRODUCT_THEME_COLUMN =
  /theme|appearance|effect|token|css|custom_field|wall|highlight/;
const PRODUCT_THEME_KEY = /theme|token|css|wall|highlight/i;
const COLOR_ROUTE_NAME = /moodboard|swatch|palette|color|colour/i;
const FORBIDDEN_ROUTE_NAME =
  /stock|unsplash|pexels|(color|colour|palette|swatch).*(suggest|recommend|extract|generate)|(suggest|recommend|extract|generate).*(color|colour|palette|swatch)/i;

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
    updateVisualCaption: () => fakeContract,
  };
  const access: MoodboardsAccess = {
    get: async () => stored.moodboard,
    list: async (_account, requestedProjectId) =>
      requestedProjectId === projectId && stored.moodboard
        ? [stored.moodboard]
        : [],
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
  const context = {
    ...forbidden,
    auth: null,
    db: {} as Context["db"],
    fileAttachments,
    moodboardMutationContracts: contracts,
    moodboards: access,
    session: {
      session: { id: "session-1" },
      user: { id: accountId },
    } as Context["session"],
    usageLinkMutationContracts,
  } as unknown as Context;
  return {
    client: createRouterClient(appRouter, { context }),
    fileAttachments,
    forbidden,
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
      "moodboards",
      "updateMoodboardVisualCaption",
    ]);
  });
});
