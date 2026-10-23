// biome-ignore-all lint/suspicious/useAwait: the in-memory double implements the async port.
import { expect, test } from "vitest";

import { createLookAgainSchedule } from "../release-communication-database";

function fakeStore(
  existing: { action: string; id: string; status: string }[] = [],
) {
  const reminders = [...existing];
  const cancelledIds: string[] = [];
  const expectedOnCancel: unknown[] = [];
  const createdKeys: string[] = [];
  return {
    cancelledIds,
    createdKeys,
    expectedOnCancel,
    store: {
      cancel: async (
        _accountId: string,
        reminderId: string,
        expected?: { action?: string; sourceRecordType?: string },
      ) => {
        expectedOnCancel.push(expected);
        cancelledIds.push(reminderId);
        const reminder = reminders.find((row) => row.id === reminderId);
        if (reminder) {
          reminder.status = "Cancelled";
        }
        return reminder ?? null;
      },
      create: async (
        _accountId: string,
        input: { clientIdempotencyKey: string; fireAt: string },
      ) => {
        createdKeys.push(`${input.clientIdempotencyKey}:${input.fireAt}`);
        reminders.push({
          action: "Review Later",
          id: `reminder-${createdKeys.length}`,
          status: "Planned",
        });
        return { id: `reminder-${createdKeys.length}` };
      },
      list: async () => reminders.map((row) => ({ ...row })),
    },
  };
}

test("a re-picked date replaces the unsent reminder instead of accumulating", async () => {
  const first = fakeStore();
  const schedule = createLookAgainSchedule(first.store);
  expect(
    await schedule("account-1", "release-1", "2026-11-20T09:00:00.000Z"),
  ).toBe(true);

  const second = fakeStore([
    { action: "Review Later", id: "reminder-1", status: "Planned" },
  ]);
  const reschedule = createLookAgainSchedule(second.store);
  expect(
    await reschedule("account-1", "release-1", "2026-11-27T09:00:00.000Z"),
  ).toBe(true);
  expect(second.expectedOnCancel).toEqual([
    { action: "Review Later", sourceRecordType: "Project Release" },
  ]);
  expect(second.cancelledIds).toEqual(["reminder-1"]);
  expect(second.createdKeys).toHaveLength(1);
});

test("only the unsent Review Later on the Release is replaced", async () => {
  const fake = fakeStore([
    { action: "Remind me", id: "reminder-m", status: "Planned" },
    { action: "Review Later", id: "reminder-t", status: "Triggered" },
    { action: "Review Later", id: "reminder-c", status: "Cancelled" },
  ]);
  const schedule = createLookAgainSchedule(fake.store);

  expect(
    await schedule("account-1", "release-1", "2026-11-20T09:00:00.000Z"),
  ).toBe(true);
  expect(fake.cancelledIds).toEqual([]);
  expect(fake.createdKeys).toHaveLength(1);
});
