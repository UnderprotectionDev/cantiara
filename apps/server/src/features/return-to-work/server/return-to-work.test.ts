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
function fixture(records: ReturnSource[], timeZone = "UTC") {
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
    readTimeZone: () => Promise.resolve(timeZone),
    markViewed: () => Promise.resolve(),
    read: () => Promise.resolve(records),
    saveNextStep,
  };
  return {
    access: createReturnToWork(store, () => new Date(now)),
    saveNextStep,
  };
}
describe("Return to Work", () => {
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
