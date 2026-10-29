import {
  MutationConflictError,
  MutationStaleBaseRevisionError,
} from "@cantiara/api/mutation-contract";
import {
  TrashDeleteBlockedError,
  TrashGrantRejectedError,
  TrashTypedNameMismatchError,
} from "@cantiara/api/trash-early-delete";
import { describe, expect, test, vi } from "vitest";

import { createTrash } from "../trash";
import { createTrashEarlyDelete } from "../trash-early-delete";
import { createMemoryTrash } from "./trash-memory-store";

const ACCOUNT = "account-1";
const PROJECT = "project-1";
const NOW = new Date("2026-03-01T10:00:00.000Z");

function setup(options: { failEraseCommit?: boolean } = {}) {
  const projects = new Map([
    [
      PROJECT,
      {
        records: new Map<
          string,
          {
            activeSurface?: boolean;
            keptSurface?: boolean;
            label: string;
            revision: number;
            sensitiveContent?: boolean;
          }
        >([
          ["Work:w1", { label: "Ship it", revision: 3 }],
          ["Document:d1", { label: "Notes", revision: 0 }],
          ["Risk:r1", { label: "Slip", revision: 1 }],
        ]),
        workspaceId: "workspace-1",
      },
    ],
  ]);
  const harness = createMemoryTrash({
    accountId: ACCOUNT,
    projects,
    ...options,
  });
  let counter = 0;
  const trash = createTrash(harness.store, {
    newId: () => {
      counter += 1;
      return `id-${counter}`;
    },
    now: () => NOW,
  });
  const early = createTrashEarlyDelete({
    events: harness.eventLog,
    expiry: harness.expiry,
    now: () => NOW,
    projectName: (accountId, projectId) =>
      Promise.resolve(
        accountId === ACCOUNT && projectId === PROJECT ? "Atlas" : null,
      ),
    store: harness.store,
  });
  const records = projects.get(PROJECT)?.records;
  return { ...harness, early, records, trash };
}

const body = (entryId: string, overrides: Record<string, unknown> = {}) =>
  ({
    baseRevision: 4,
    clientIdempotencyKey: "k1",
    entryId,
    grant: "grant-1",
    projectId: PROJECT,
    typedName: "Atlas",
    ...overrides,
  }) as never;

const accept = () => vi.fn(() => Promise.resolve(true));
const deny = () => vi.fn(() => Promise.resolve(false));

async function trashWork(env: ReturnType<typeof setup>) {
  const entry = await env.trash.move(ACCOUNT, {
    baseRevision: 3,
    clientIdempotencyKey: "m1",
    projectId: PROJECT,
    recordId: "w1",
    recordKind: "Work",
  });
  return entry?.id ?? "";
}

async function trashGroup(env: ReturnType<typeof setup>) {
  const entries = await env.trash.moveGroup(ACCOUNT, {
    clientIdempotencyKey: "g1",
    members: [
      { baseRevision: 3, recordId: "w1", recordKind: "Work" },
      { baseRevision: 0, recordId: "d1", recordKind: "Document" },
    ],
    projectId: PROJECT,
  });
  return entries ?? [];
}

describe("Trash seam: early Permanently Delete", () => {
  test("previews the effect, names the Project to type, never offers Keep approved surface", async () => {
    const env = setup();
    const id = await trashWork(env);

    const preview = await env.early.preview(ACCOUNT, {
      entryId: id,
      projectId: PROJECT,
    });

    expect(preview).toMatchObject({
      blockers: [],
      keepApprovedSurface: { available: false },
      members: [{ recordId: "w1", recordKind: "Work", revision: 4 }],
      typedNameTarget: { kind: "Project", name: "Atlas" },
    });
  });

  test("consumes the grant once and deletes before day 30, leaving only content-free marks", async () => {
    const env = setup();
    const id = await trashWork(env);
    const consume = accept();

    const result = await env.early.permanentlyDelete(
      ACCOUNT,
      body(id),
      consume,
    );

    expect(consume).toHaveBeenCalledTimes(1);
    expect(consume).toHaveBeenCalledWith("grant-1");
    expect(result?.records).toEqual([{ recordId: "w1", recordKind: "Work" }]);
    expect(env.records?.has("Work:w1")).toBe(false);
    expect(env.entries).toHaveLength(0);
    expect(env.events).toHaveLength(1);
    expect(env.events[0]).toMatchObject({
      targetAlias: "Work:w1",
      type: "trash.permanently-deleted",
    });
    expect(env.audit).toHaveLength(1);
    expect(env.deletedMarks.has("Work:w1")).toBe(true);
    expect(JSON.stringify([env.events, env.audit])).not.toContain("Ship it");
  });

  test("a missing, expired, wrong-operation or replayed grant (consume false) writes nothing", async () => {
    const env = setup();
    const id = await trashWork(env);
    const consume = deny();

    await expect(
      env.early.permanentlyDelete(ACCOUNT, body(id), consume),
    ).rejects.toBeInstanceOf(TrashGrantRejectedError);

    expect(consume).toHaveBeenCalledTimes(1);
    expect(env.records?.has("Work:w1")).toBe(true);
    expect(env.entries).toHaveLength(1);
    expect(env.events).toHaveLength(0);
    expect(env.audit).toHaveLength(0);
  });

  test("a typed-name mismatch writes nothing and does not consume the grant", async () => {
    const env = setup();
    const id = await trashWork(env);
    const consume = accept();

    await expect(
      env.early.permanentlyDelete(
        ACCOUNT,
        body(id, { typedName: "atlas" }),
        consume,
      ),
    ).rejects.toBeInstanceOf(TrashTypedNameMismatchError);

    expect(consume).not.toHaveBeenCalled();
    expect(env.records?.has("Work:w1")).toBe(true);
    expect(env.events).toHaveLength(0);
  });

  test("the same idempotency key replays without consuming again; another payload conflicts", async () => {
    const env = setup();
    const id = await trashWork(env);
    const consume = accept();

    const first = await env.early.permanentlyDelete(ACCOUNT, body(id), consume);
    const again = await env.early.permanentlyDelete(ACCOUNT, body(id), consume);

    expect(again).toEqual(first);
    expect(consume).toHaveBeenCalledTimes(1);
    expect(env.events).toHaveLength(1);
    await expect(
      env.early.permanentlyDelete(
        ACCOUNT,
        body(id, { baseRevision: 9 }),
        consume,
      ),
    ).rejects.toBeInstanceOf(MutationConflictError);
  });

  test("a Project delete group is one unit: every member goes or none", async () => {
    const env = setup();
    const [first] = await trashGroup(env);
    const consume = accept();

    const result = await env.early.permanentlyDelete(
      ACCOUNT,
      body(first?.id ?? "", { baseRevision: first?.revision }),
      consume,
    );

    expect(result?.records).toHaveLength(2);
    expect(consume).toHaveBeenCalledTimes(1);
    expect(env.records?.has("Work:w1")).toBe(false);
    expect(env.records?.has("Document:d1")).toBe(false);
    expect(env.events).toHaveLength(2);
  });

  test("a blocked group member leaves the whole group intact and the grant unconsumed", async () => {
    const env = setup();
    const [first] = await trashGroup(env);
    const document = env.records?.get("Document:d1");
    if (document) {
      document.sensitiveContent = true;
    }
    const consume = accept();

    await expect(
      env.early.permanentlyDelete(
        ACCOUNT,
        body(first?.id ?? "", { baseRevision: first?.revision }),
        consume,
      ),
    ).rejects.toMatchObject({ blockers: ["sensitive-content"] });

    expect(consume).not.toHaveBeenCalled();
    expect(env.entries).toHaveLength(2);
    expect(env.records?.has("Work:w1")).toBe(true);
    expect(env.events).toHaveLength(0);
  });

  test("an active External Surface blocks the delete and shows in the preview", async () => {
    const env = setup();
    const id = await trashWork(env);
    const work = env.records?.get("Work:w1");
    if (work) {
      work.activeSurface = true;
    }
    const consume = accept();

    const preview = await env.early.preview(ACCOUNT, {
      entryId: id,
      projectId: PROJECT,
    });
    await expect(
      env.early.permanentlyDelete(ACCOUNT, body(id), consume),
    ).rejects.toBeInstanceOf(TrashDeleteBlockedError);

    expect(preview?.blockers).toEqual(["active-surface"]);
    expect(consume).not.toHaveBeenCalled();
    expect(env.records?.has("Work:w1")).toBe(true);
  });

  test("a stale base revision, another account or an unknown entry writes nothing", async () => {
    const env = setup();
    const id = await trashWork(env);
    const consume = accept();

    await expect(
      env.early.permanentlyDelete(
        ACCOUNT,
        body(id, { baseRevision: 1 }),
        consume,
      ),
    ).rejects.toBeInstanceOf(MutationStaleBaseRevisionError);
    expect(
      await env.early.permanentlyDelete("other", body(id), consume),
    ).toBeNull();
    expect(
      await env.early.permanentlyDelete(ACCOUNT, body("missing"), consume),
    ).toBeNull();

    expect(consume).not.toHaveBeenCalled();
    expect(env.records?.has("Work:w1")).toBe(true);
  });

  test("a Kept (frozen) surface still serves visitors, so it blocks the delete until it is revoked", async () => {
    const env = setup();
    const id = await trashWork(env);
    const work = env.records?.get("Work:w1");
    if (work) {
      work.keptSurface = true;
    }
    const consume = accept();

    await expect(
      env.early.permanentlyDelete(ACCOUNT, body(id), consume),
    ).rejects.toMatchObject({ blockers: ["active-surface"] });

    expect(consume).not.toHaveBeenCalled();
    expect(env.records?.has("Work:w1")).toBe(true);
    expect(env.events).toHaveLength(0);
  });

  test("a commit that fails leaves no security event behind, so a live record is never erased by replay", async () => {
    const env = setup({ failEraseCommit: true });
    const id = await trashWork(env);

    await expect(
      env.early.permanentlyDelete(ACCOUNT, body(id), accept()),
    ).rejects.toThrow("commit failed");

    expect(env.events).toHaveLength(0);
    expect(env.records?.has("Work:w1")).toBe(true);
    expect(env.entries).toHaveLength(1);
  });

  test("a unit restored after the checks is not erased and writes no event; the grant is already consumed", async () => {
    const env = setup();
    const id = await trashWork(env);
    // The founder restores in the window between the checks and the erase.
    const consume = vi.fn(async () => {
      await env.trash.restore(ACCOUNT, {
        baseRevision: 4,
        clientIdempotencyKey: "r1",
        entryId: id,
        projectId: PROJECT,
      });
      return true;
    });

    const result = await env.early.permanentlyDelete(
      ACCOUNT,
      body(id),
      consume,
    );

    expect(result).toBeNull();
    expect(consume).toHaveBeenCalledTimes(1);
    expect(env.events).toHaveLength(0);
    expect(env.records?.has("Work:w1")).toBe(true);
  });
});
