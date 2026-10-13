// biome-ignore-all lint/style/noNonNullAssertion: Fixtures assert the presence of their source records at the seam.
import type { ReturnSource } from "@cantiara/api/return-to-work";
import { describe, expect, test, vi } from "vitest";
import { createReturnToWork, type ReturnToWorkStore } from "./return-to-work";

const now = "2026-10-07T12:00:00.000Z";
const context = { projectId: "project-1" };
function source(
  id: string,
  overrides: Partial<ReturnSource> = {},
): ReturnSource {
  return {
    id,
    projectId: "project-1",
    recordType: "Work",
    title: id,
    revision: 0,
    sourcePath: `/projects/project-1#work-${id}`,
    updatedAt: "2026-10-06T12:00:00.000Z",
    targetDate: null,
    lastViewedAt: null,
    openRisk: false,
    pendingGitHubSignal: false,
    nextConcreteStep: null,
    nextConcreteStepUpdatedAt: null,
    ...overrides,
  };
}
function fixture(
  records: ReturnSource[],
  timeZone = "UTC",
  readOnly = false,
  statusAgeThresholdDays: number | null = null,
) {
  const saveNextStep = vi.fn((_accountId, input) => {
    const record = records.find(
      (item) => item.id === (input.workId ?? input.projectId),
    );
    if (!record) {
      throw new Error("Record is unavailable.");
    }
    record.nextConcreteStep = input.nextConcreteStep;
    record.nextConcreteStepUpdatedAt = now;
    record.revision += 1;
    return Promise.resolve();
  });
  const store: ReturnToWorkStore = {
    readChanges: async () => ({ lastViewedAt: null, events: [] }),
    readTimeZone: () => Promise.resolve(timeZone),
    markViewed: () => Promise.resolve(),
    read: () =>
      Promise.resolve({ readOnly, sources: records, statusAgeThresholdDays }),
    saveNextStep,
  };
  return {
    access: createReturnToWork(store, () => new Date(now)),
    saveNextStep,
  };
}
describe("Return to Work", () => {
  test("returns an old active Work only after the optional Project status-age threshold", async () => {
    const records = [
      source("old-active", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        statusAge: { active: true, changedAt: "2026-09-29T12:00:00.000Z" },
      }),
    ];
    expect(
      (await fixture(records).access.read("account-1", context)).cards,
    ).toEqual([]);
    expect(
      (
        await fixture(records, "UTC", false, 7).access.read(
          "account-1",
          context,
        )
      ).cards,
    ).toEqual([
      expect.objectContaining({
        id: "old-active",
        reasons: ["Long in the same status"],
      }),
    ]);
  });
  test("excludes the exact threshold, inactive and future status ages and keeps the five-card cap", async () => {
    const records = [
      source("boundary", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        statusAge: { active: true, changedAt: "2026-09-30T12:00:00.000Z" },
      }),
      source("closed", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        statusAge: { active: false, changedAt: "2025-01-01T00:00:00.000Z" },
      }),
      source("future", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        statusAge: { active: true, changedAt: "2026-10-08T12:00:00.000Z" },
      }),
      source("long", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        statusAge: { active: true, changedAt: "2026-09-29T12:00:00.000Z" },
      }),
      source("edited"),
      source("viewed", { lastViewedAt: now }),
      source("due", { targetDate: "2026-10-10" }),
      source("risk", { openRisk: true }),
      source("github", { pendingGitHubSignal: true }),
    ];
    const before = structuredClone(records);
    const { access, saveNextStep } = fixture(records, "UTC", false, 7);
    const summary = await access.read("account-1", context);
    expect(summary.cards).toHaveLength(5);
    expect(summary.cards[0]).toMatchObject({
      id: "long",
      reasons: ["Long in the same status"],
    });
    expect(
      summary.cards.filter((card) =>
        ["boundary", "closed", "future"].includes(card.id),
      ),
    ).toEqual([]);
    expect(records).toEqual(before);
    expect(saveNextStep).not.toHaveBeenCalled();
  });
  test("groups only defined events strictly after the Account visit in chronological order", async () => {
    const store = {
      read: async () => ({
        readOnly: true,
        sources: [source("project-1", { recordType: "Project" })],
      }),
      readTimeZone: async () => "UTC",
      markViewed: () => Promise.resolve(),
      saveNextStep: () => Promise.resolve(),
      readChanges: async () => ({
        lastViewedAt: "2026-10-06T12:00:00.000Z",
        events: [
          {
            id: "boundary",
            kind: "Work updated",
            occurredAt: "2026-10-06T12:00:00.000Z",
            source: source("work-1"),
          },
          {
            id: "later",
            kind: "Work updated",
            occurredAt: "2026-10-07T10:00:00.000Z",
            source: source("work-1"),
          },
          {
            id: "earlier",
            kind: "Work created",
            occurredAt: "2026-10-06T13:00:00.000Z",
            source: source("work-2"),
          },
          {
            id: "unsupported",
            kind: "Analytics",
            occurredAt: "2026-10-07T09:00:00.000Z",
            source: source("work-1"),
          },
          {
            id: "future",
            kind: "Work updated",
            occurredAt: "2027-01-01T00:00:00.000Z",
            source: source("work-1"),
          },
        ],
      }),
    };
    const summary = await createReturnToWork(store, () => new Date(now)).read(
      "account-1",
      context,
    );
    expect(summary.readOnly).toBe(true);
    expect(summary.sinceLastLooked).toEqual({
      lastViewedAt: "2026-10-06T12:00:00.000Z",
      groups: [
        {
          name: "Work",
          events: [
            {
              id: "earlier",
              kind: "Work created",
              occurredAt: "2026-10-06T13:00:00.000Z",
              source: source("work-2"),
            },
            {
              id: "later",
              kind: "Work updated",
              occurredAt: "2026-10-07T10:00:00.000Z",
              source: source("work-1"),
            },
          ],
        },
      ],
    });
  });
  test("reserves the nearest date but fills remaining places only from recent edits", async () => {
    const records = [
      source("edited"),
      source("nearest", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        targetDate: "2026-10-08",
      }),
      source("later", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        targetDate: "2026-10-10",
      }),
    ];
    expect(
      (await fixture(records).access.read("account-1", context)).cards.map(
        (card) => card.id,
      ),
    ).toEqual(["edited", "nearest"]);
  });
  test("evaluates upcoming calendar dates in the Account time zone", async () => {
    const records = [
      source("due", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        targetDate: "2026-10-07",
      }),
    ];
    expect(
      (
        await fixture(records, "Pacific/Kiritimati").access.read(
          "account-1",
          context,
        )
      ).cards,
    ).toEqual([]);
  });
  test("keeps an old context hint visible and chooses the most recently viewed source", async () => {
    const records = [
      source("project-1", {
        recordType: "Project",
        updatedAt: "2025-01-01T00:00:00.000Z",
        nextConcreteStep: "Still intentional",
      }),
      source("edited", { updatedAt: "2026-10-07T11:00:00.000Z" }),
      source("viewed-first", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        lastViewedAt: "2026-10-06T11:00:00.000Z",
      }),
      source("viewed-latest", {
        updatedAt: "2025-01-01T00:00:00.000Z",
        lastViewedAt: "2026-10-07T11:00:00.000Z",
      }),
    ];
    const summary = await fixture(records).access.read("account-1", context);
    expect(summary.source?.nextConcreteStep).toBe("Still intentional");
    expect(summary.cards[1]?.id).toBe("viewed-latest");
  });
  test("carries the read-only archive state without hiding current cards or sources", async () => {
    const records = [
      source("project-1", {
        recordType: "Project",
        nextConcreteStep: "Archived hint",
      }),
      source("current"),
    ];
    expect(
      (await fixture(records).access.read("account-1", context)).readOnly,
    ).toBe(false);
    const archived = await fixture(records, "UTC", true).access.read(
      "account-1",
      context,
    );
    expect(archived.readOnly).toBe(true);
    expect(archived.source?.nextConcreteStep).toBe("Archived hint");
    expect(archived.cards.map((card) => card.id)).toEqual([
      "current",
      "project-1",
    ]);
  });
  test("keeps at most five cards and covers the closed reasons with deterministic current sources", async () => {
    const records = [
      source("old", { updatedAt: "2025-01-01T00:00:00.000Z" }),
      source("view", { lastViewedAt: "2026-10-07T11:00:00.000Z" }),
      source("due", { targetDate: "2026-10-10" }),
      source("risk", { recordType: "Risk", openRisk: true }),
      source("github", { pendingGitHubSignal: true }),
      source("a"),
      source("b"),
      source("c"),
    ];
    const { access } = fixture(records);
    const summary = await access.read("account-1", context);
    expect(summary.cards).toHaveLength(5);
    expect(summary.cards.find((card) => card.id === "old")).toBeUndefined();
    expect(summary.cards.flatMap((card) => card.reasons)).toEqual(
      expect.arrayContaining([
        "Recently edited",
        "Recently viewed",
        "Upcoming date",
        "Open risk",
        "Pending GitHub development signal",
      ]),
    );
    expect((await access.read("account-1", context)).cards).toEqual(
      summary.cards,
    );
  });
  test("replaces the optional source step without deriving or clearing it from changes", async () => {
    const records = [source("project-1", { recordType: "Project" })];
    const { access, saveNextStep } = fixture(records);
    await access.saveNextStep("account-1", {
      ...context,
      baseRevision: 0,
      clientIdempotencyKey: "first",
      nextConcreteStep: "Ask about payment failures",
    });
    records[0]!.targetDate = "2026-11-01";
    records[0]!.updatedAt = now;
    expect((await access.read("account-1", context)).cards[0]).toMatchObject({
      nextConcreteStep: "Ask about payment failures",
      nextConcreteStepUpdatedAt: now,
    });
    expect(saveNextStep).toHaveBeenCalledTimes(1);
    await access.saveNextStep("account-1", {
      ...context,
      baseRevision: 1,
      clientIdempotencyKey: "second",
      nextConcreteStep: "Write acceptance examples",
    });
    expect(
      (await access.read("account-1", context)).cards[0]!.nextConcreteStep,
    ).toBe("Write acceptance examples");
  });
  test("reads current source records with explainable reasons without writing fields", async () => {
    const records = [source("current")];
    const { access, saveNextStep } = fixture(records);
    expect((await access.read("account-1", context)).cards[0]).toMatchObject({
      title: "current",
      reasons: ["Recently edited"],
      sourcePath: "/projects/project-1#work-current",
    });
    records[0]!.title = "Renamed current record";
    expect((await access.read("account-1", context)).cards[0]!.title).toBe(
      "Renamed current record",
    );
    records.splice(0);
    expect((await access.read("account-1", context)).cards).toEqual([]);
    expect(saveNextStep).not.toHaveBeenCalled();
  });
});
