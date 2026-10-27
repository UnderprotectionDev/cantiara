import {
  ATTENTION_SIGNAL_REGISTRY,
  attentionSectionOf,
} from "@cantiara/api/attention-signals";
import { describe, expect, test } from "vitest";

import { createAttentionSignals } from "../attention-signals";
import { createMemoryAttentionSignalStore } from "./attention-signals-memory-store";

const ACCOUNT = "account-1";

function setup() {
  const harness = createMemoryAttentionSignalStore();
  let sequence = 0;
  const access = createAttentionSignals(harness.store, () => {
    sequence += 1;
    return `sig-${sequence}`;
  });
  return { ...harness, access };
}

const event = (overrides: Record<string, unknown> = {}) => ({
  eventId: "event-1",
  group: { id: "work-1", kind: "Work" },
  occurredAt: "2026-10-27T09:00:00.000Z",
  reason: "Blocked by a decision.",
  signalId: "work-blocked",
  targetId: "work-1",
  ...overrides,
});

// A producer test-double: it emits through the gate and owns no rule.
type Emit = Parameters<ReturnType<typeof setup>["access"]["emit"]>[1];
const emitAs = (overrides?: Record<string, unknown>) =>
  event(overrides) as unknown as Emit;

describe("Attention Signals registry gate", () => {
  test("emits every registered id with the section of its registry row", async () => {
    const { access } = setup();
    const emitted = await Promise.all(
      ATTENTION_SIGNAL_REGISTRY.map(async (row) => ({
        result: await access.emit(
          ACCOUNT,
          emitAs({ eventId: `event-${row.id}`, signalId: row.id }),
        ),
        row,
      })),
    );
    for (const { result, row } of emitted) {
      const { outcome, signal } = result;
      expect(outcome).toBe("created");
      expect(signal.presentation).toBe(row.presentation);
      expect(signal.section).toBe(
        row.presentation === "Information Flow"
          ? "Information Flow"
          : "Action Required",
      );
      expect(attentionSectionOf(row.id)).toBe(signal.section);
    }
    expect(ATTENTION_SIGNAL_REGISTRY).toHaveLength(20);
  });

  test("files work-blocked (Needs Action) in Action Required, not a third section", async () => {
    const { access } = setup();
    const { signal } = await access.emit(ACCOUNT, emitAs());
    expect(signal.presentation).toBe("Needs Action");
    expect(signal.section).toBe("Action Required");
    const center = await access.center(ACCOUNT);
    expect(center.sections.map((section) => section.section)).toEqual([
      "Action Required",
      "Information Flow",
    ]);
  });

  test.each([
    "free-form-note",
    "due-date ",
    "DUE-DATE",
    "source-age",
    "cancelled-handoff",
    "value-chain-break",
    "",
    undefined,
  ])("rejects unregistered id %j without writing", async (signalId) => {
    const { access, rows } = setup();
    await expect(
      access.emit(ACCOUNT, emitAs({ signalId })),
    ).rejects.toMatchObject({ code: "ATTENTION_SIGNAL_NOT_REGISTERED" });
    expect(rows.size).toBe(0);
  });

  test.each([
    ["eventId", undefined],
    ["eventId", "   "],
    ["targetId", undefined],
    ["targetId", ""],
  ])("requires exact %s (%j) and writes nothing", async (field, value) => {
    const { access, rows } = setup();
    await expect(
      access.emit(ACCOUNT, emitAs({ [field]: value })),
    ).rejects.toMatchObject({ code: "ATTENTION_SIGNAL_IDENTITY_REQUIRED" });
    expect(rows.size).toBe(0);
  });

  test("refuses a producer-supplied presentation or section", async () => {
    const { access, rows } = setup();
    await expect(
      access.emit(ACCOUNT, emitAs({ section: "Information Flow" })),
    ).rejects.toMatchObject({ code: "ATTENTION_SIGNAL_IDENTITY_REQUIRED" });
    expect(rows.size).toBe(0);
  });

  test("dedupes the same event and target, per account", async () => {
    const { access } = setup();
    const first = await access.emit(ACCOUNT, emitAs());
    const retry = await access.emit(ACCOUNT, emitAs({ reason: "Retried." }));
    expect(retry.outcome).toBe("duplicate");
    expect(retry.signal.id).toBe(first.signal.id);
    expect(retry.signal.reason).toBe("Blocked by a decision.");
    expect(
      (await access.center(ACCOUNT)).sections[0]?.groups[0]?.signals,
    ).toHaveLength(1);

    const sameEventOtherTarget = await access.emit(
      ACCOUNT,
      emitAs({ targetId: "work-2" }),
    );
    const otherAccount = await access.emit("account-2", emitAs());
    expect(sameEventOtherTarget.outcome).toBe("created");
    expect(otherAccount.outcome).toBe("created");
  });
});

describe("Notification Center sections and groups", () => {
  test("opens Action Required by default and puts each signal in one section", async () => {
    const { access } = setup();
    await access.emit(ACCOUNT, emitAs({ eventId: "a", signalId: "open-risk" }));
    await access.emit(
      ACCOUNT,
      emitAs({ eventId: "b", signalId: "github-activity" }),
    );
    const center = await access.center(ACCOUNT);
    expect(center.sections.map((s) => [s.section, s.defaultOpen])).toEqual([
      ["Action Required", true],
      ["Information Flow", false],
    ]);
    expect(
      center.sections.map((s) =>
        s.groups.flatMap((g) => g.signals.map((x) => x.signalId)),
      ),
    ).toEqual([["open-risk"], ["github-activity"]]);
  });

  test("groups one main source inside its section and keeps each signal's own fields", async () => {
    const { access } = setup();
    await access.emit(
      ACCOUNT,
      emitAs({
        eventId: "e1",
        occurredAt: "2026-10-27T08:00:00.000Z",
        reason: "Blocked.",
        signalId: "work-blocked",
      }),
    );
    await access.emit(
      ACCOUNT,
      emitAs({
        eventId: "e2",
        occurredAt: "2026-10-27T10:00:00.000Z",
        reason: "Reminder is due.",
        signalId: "personal-reminder",
      }),
    );
    await access.emit(
      ACCOUNT,
      emitAs({ eventId: "e3", signalId: "github-activity" }),
    );
    const [action, flow] = (await access.center(ACCOUNT)).sections;
    expect(action?.groups).toHaveLength(1);
    expect(
      action?.groups[0]?.signals.map((s) => [s.reason, s.eventId]),
    ).toEqual([
      ["Reminder is due.", "e2"],
      ["Blocked.", "e1"],
    ]);
    // Same main source, different attention meaning: a separate group per section.
    expect(flow?.groups).toHaveLength(1);
    expect(flow?.groups[0]?.key).toBe(action?.groups[0]?.key);
    for (const signal of action?.groups[0]?.signals ?? []) {
      expect(signal.readAt).toBeNull();
      expect(signal.closedAt).toBeNull();
    }
  });

  test("one Kaynak group holds several usages with separate rows", async () => {
    const { access } = setup();
    const version = { id: "source-version-7", kind: "Source version" };
    await Promise.all(
      ["usage-a", "usage-b", "usage-c"].map((usage) =>
        access.emit(
          ACCOUNT,
          emitAs({
            eventId: "source-version-7-changed",
            group: version,
            reason: `Newer version used in ${usage}.`,
            signalId: "source-version-in-use",
            targetId: usage,
          }),
        ),
      ),
    );
    const [action] = (await access.center(ACCOUNT)).sections;
    expect(action?.groups).toHaveLength(1);
    const signals = action?.groups[0]?.signals ?? [];
    expect(signals.map((s) => s.targetId).sort()).toEqual([
      "usage-a",
      "usage-b",
      "usage-c",
    ]);
    expect(new Set(signals.map((s) => s.id)).size).toBe(3);
  });

  test("only reads the account's own signals", async () => {
    const { access } = setup();
    await access.emit(ACCOUNT, emitAs());
    const other = await access.center("account-2");
    expect(other.sections.flatMap((s) => s.groups)).toEqual([]);
  });
});
