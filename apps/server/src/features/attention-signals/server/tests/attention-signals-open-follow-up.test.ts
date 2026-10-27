import { describe, expect, test } from "vitest";

import { createAttentionSignals } from "../attention-signals";
import {
  createMemoryAttentionSignalStore,
  createSourceDouble,
} from "./attention-signals-memory-store";

const ACCOUNT = "account-1";

function setup() {
  const harness = createMemoryAttentionSignalStore();
  const source = createSourceDouble();
  let sequence = 0;
  const access = createAttentionSignals(harness.store, {
    createId: () => {
      sequence += 1;
      return `id-${sequence}`;
    },
    now: () => new Date("2026-10-27T10:00:00.000Z"),
    resolver: source.resolver,
  });
  return { ...harness, access, source };
}

type Emit = Parameters<ReturnType<typeof setup>["access"]["emit"]>[1];
const event = (overrides: Record<string, unknown> = {}) =>
  ({
    eventId: "comment-9",
    group: { id: "work-1", kind: "Work" },
    occurredAt: "2026-10-27T09:00:00.000Z",
    projectId: "project-1",
    reason: "A comment needs your answer.",
    signalId: "work-blocked",
    targetId: "work-1",
    ...overrides,
  }) as unknown as Emit;

describe("read and closed are attention state only", () => {
  test("marks the signal and writes nothing to the source", async () => {
    const { access, source } = setup();
    const { signal } = await access.emit(ACCOUNT, event());
    const read = await access.mark(ACCOUNT, {
      mark: "read",
      signalRowId: signal.id,
    });
    expect(read.readAt).toBe("2026-10-27T10:00:00.000Z");
    expect(read.closedAt).toBeNull();
    const closed = await access.mark(ACCOUNT, {
      mark: "closed",
      signalRowId: signal.id,
    });
    expect(closed.closedAt).not.toBeNull();
    expect(closed.readAt).toBe(read.readAt);
    expect(source.state.writes).toBe(0);
    // Closing does not delete: the reason, event and time are still there.
    const [action] = (await access.center(ACCOUNT)).sections;
    expect(action?.groups[0]?.signals[0]).toMatchObject({
      closedAt: closed.closedAt,
      eventId: "comment-9",
      reason: "A comment needs your answer.",
    });
  });

  test("marking one signal leaves the others of its group untouched", async () => {
    const { access } = setup();
    const first = await access.emit(ACCOUNT, event());
    const second = await access.emit(
      ACCOUNT,
      event({ eventId: "comment-10", signalId: "open-risk" }),
    );
    await access.mark(ACCOUNT, { mark: "read", signalRowId: first.signal.id });
    const [action] = (await access.center(ACCOUNT)).sections;
    const byId = new Map(
      (action?.groups[0]?.signals ?? []).map((s) => [s.id, s]),
    );
    expect(byId.get(first.signal.id)?.readAt).not.toBeNull();
    expect(byId.get(second.signal.id)?.readAt).toBeNull();
  });

  test("reopens a closed signal and refuses another account's signal", async () => {
    const { access } = setup();
    const { signal } = await access.emit(ACCOUNT, event());
    await access.mark(ACCOUNT, { mark: "closed", signalRowId: signal.id });
    const reopened = await access.mark(ACCOUNT, {
      mark: "reopened",
      signalRowId: signal.id,
    });
    expect(reopened.closedAt).toBeNull();
    await expect(
      access.mark("account-2", { mark: "read", signalRowId: signal.id }),
    ).rejects.toMatchObject({ code: "ATTENTION_SIGNAL_NOT_FOUND" });
  });
});

describe("opening the exact source event", () => {
  test("opens the exact event when it resolves, and does not mark it read", async () => {
    const { access, source } = setup();
    source.state.resolvableEvents.add("comment-9");
    const { signal } = await access.emit(ACCOUNT, event());
    expect(await access.open(ACCOUNT, { signalRowId: signal.id })).toEqual({
      eventId: "comment-9",
      group: { id: "work-1", kind: "Work" },
      outcome: "event",
      targetId: "work-1",
    });
    const [action] = (await access.center(ACCOUNT)).sections;
    expect(action?.groups[0]?.signals[0]?.readAt).toBeNull();
  });

  test("opens the record and names the missing event instead of retargeting", async () => {
    const { access, source } = setup();
    source.state.resolvableEvents.add("comment-other");
    const { signal } = await access.emit(ACCOUNT, event());
    const opened = await access.open(ACCOUNT, { signalRowId: signal.id });
    expect(opened).toMatchObject({
      group: { id: "work-1", kind: "Work" },
      missingEventId: "comment-9",
      outcome: "record",
    });
    expect(JSON.stringify(opened)).toContain("comment-9");
    expect(opened).not.toHaveProperty("eventId");
  });

  test("a deleted source shows a tombstone and leaks no producer text", async () => {
    const { access, source } = setup();
    const { signal } = await access.emit(
      ACCOUNT,
      event({ reason: "Private secret plan." }),
    );
    source.state.deletedRecords.add("Work:work-1");
    const opened = await access.open(ACCOUNT, { signalRowId: signal.id });
    expect(opened.outcome).toBe("tombstone");
    expect(JSON.stringify(opened)).not.toContain("Private");
    const [action] = (await access.center(ACCOUNT)).sections;
    const row = action?.groups[0]?.signals[0];
    expect(row?.tombstone).toBe(true);
    expect(row?.reason).toBe("The source record was deleted.");
    expect(JSON.stringify(await access.center(ACCOUNT))).not.toContain(
      "Private",
    );
  });

  test("refuses a notification that does not exist", async () => {
    const { access } = setup();
    await expect(
      access.open(ACCOUNT, { signalRowId: "missing" }),
    ).rejects.toMatchObject({ code: "ATTENTION_SIGNAL_NOT_FOUND" });
  });
});

describe("Create Follow-up Work", () => {
  test("previews the İş and its Kökeni relations before anything is created", async () => {
    const { access, followUps, source } = setup();
    const { signal } = await access.emit(ACCOUNT, event());
    const preview = await access.previewFollowUp(ACCOUNT, {
      signalRowId: signal.id,
    });
    expect(preview.work).toMatchObject({
      projectId: "project-1",
      title: "Follow up: A comment needs your answer.",
      type: "Task",
    });
    expect(preview.relations).toEqual([
      { id: signal.id, kind: "Notification", relation: "Origin" },
      { id: "work-1", kind: "Work", relation: "Origin" },
    ]);
    expect(followUps.size).toBe(0);
    expect(source.state.writes).toBe(0);
  });

  test("apply creates exactly one İş, keeps the notification open and the source untouched", async () => {
    const { access, followUps, source } = setup();
    const { signal } = await access.emit(ACCOUNT, event());
    const preview = await access.previewFollowUp(ACCOUNT, {
      signalRowId: signal.id,
    });
    const created = await access.createFollowUp(ACCOUNT, {
      attemptId: "attempt-1",
      fingerprint: preview.fingerprint,
      signalRowId: signal.id,
    });
    expect(created.created).toBe(true);
    expect(followUps.size).toBe(1);
    expect(created.signal.readAt).toBeNull();
    expect(created.signal.closedAt).toBeNull();
    expect(source.state.writes).toBe(0);

    // A retry of the same attempt returns the same İş, never a second one.
    const retry = await access.createFollowUp(ACCOUNT, {
      attemptId: "attempt-1",
      fingerprint: preview.fingerprint,
      signalRowId: signal.id,
    });
    expect(retry).toMatchObject({ created: false, workId: created.workId });
    expect(followUps.size).toBe(1);
    const [action] = (await access.center(ACCOUNT)).sections;
    expect(action?.groups[0]?.signals[0]?.closedAt).toBeNull();
  });

  test("a changed preview is stale and creates nothing", async () => {
    const { access, followUps } = setup();
    const { signal } = await access.emit(ACCOUNT, event());
    const preview = await access.previewFollowUp(ACCOUNT, {
      signalRowId: signal.id,
      workType: "Task",
    });
    await expect(
      access.createFollowUp(ACCOUNT, {
        attemptId: "attempt-1",
        fingerprint: preview.fingerprint,
        signalRowId: signal.id,
        workType: "Bug",
      }),
    ).rejects.toMatchObject({ code: "ATTENTION_FOLLOW_UP_STALE" });
    expect(followUps.size).toBe(0);
  });

  test("a notification without a Project cannot create work", async () => {
    const { access, followUps } = setup();
    const { signal } = await access.emit(ACCOUNT, event({ projectId: null }));
    await expect(
      access.previewFollowUp(ACCOUNT, { signalRowId: signal.id }),
    ).rejects.toMatchObject({ code: "ATTENTION_FOLLOW_UP_PROJECT_REQUIRED" });
    expect(followUps.size).toBe(0);
  });

  test("a deleted source previews a plan with no source relation and no quoted text", async () => {
    const { access, source } = setup();
    const { signal } = await access.emit(
      ACCOUNT,
      event({ reason: "Private secret plan." }),
    );
    source.state.deletedRecords.add("Work:work-1");
    const preview = await access.previewFollowUp(ACCOUNT, {
      signalRowId: signal.id,
    });
    expect(JSON.stringify(preview)).not.toContain("Private");
    expect(preview.relations).toEqual([
      { id: signal.id, kind: "Notification", relation: "Origin" },
    ]);
  });
});

describe("no Saved queue", () => {
  test("the access exposes no save or bookmark member", () => {
    const { access } = setup();
    expect(Object.keys(access).sort()).toEqual([
      "center",
      "createFollowUp",
      "emit",
      "mark",
      "open",
      "previewFollowUp",
    ]);
  });
});
