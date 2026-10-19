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
import { createRouterClient } from "@orpc/server";
import { describe, expect, test, vi } from "vitest";

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
    addVisual: () => fakeContract,
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
  const context = {
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
      withLink.items.map(({ id, origin, caption, position }) => ({
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
