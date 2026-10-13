import { describe, expect, test } from "vitest";

import {
  startSmartCollectionSubscriptionMembership,
  transitionSmartCollectionSubscriptionMembership,
} from "./smart-collection-subscription-signals";

const subscription = {
  accountId: "account-1",
  collectionId: "collection-1",
  collectionName: "Active work",
  id: "subscription-1",
};

const member = {
  membershipReasons: ["Project: First project", "Status: In Progress"],
  sourcePath: "/projects/project-1#work-work-1",
  sourceProjectId: "project-1",
  sourceRecordId: "work-1",
  sourceRecordTitle: "TAC1-1 · Ship the release",
  sourceRecordType: "Work" as const,
};

describe("Smart Collection subscription membership periods", () => {
  test("uses current members as a silent initial subscription baseline", () => {
    const baseline = startSmartCollectionSubscriptionMembership(
      member,
      new Date("2026-10-05T10:00:00.000Z"),
    );

    expect(baseline).toMatchObject({
      isMember: true,
      membershipPeriod: 1,
      leftAt: null,
    });

    const firstRead = transitionSmartCollectionSubscriptionMembership({
      current: member,
      now: new Date("2026-10-05T10:01:00.000Z"),
      notifyOnLeave: false,
      previous: baseline,
      subscription,
    });

    expect(firstRead.signal).toBeNull();
    expect(firstRead.nextState?.membershipPeriod).toBe(1);
  });

  test("emits one registered entry signal for a new period and none on repeated reads", () => {
    const now = new Date("2026-10-05T10:00:00.000Z");
    const firstEntry = transitionSmartCollectionSubscriptionMembership({
      current: member,
      now,
      notifyOnLeave: false,
      previous: null,
      subscription,
    });

    expect(firstEntry.signal).toMatchObject({
      eventType: "entry",
      membershipPeriod: 1,
      presentation: "Information Flow",
      reason: expect.stringContaining("Status: In Progress"),
      signalType: "smart-collection-entry",
    });
    expect(firstEntry.nextState).toMatchObject({
      isMember: true,
      membershipPeriod: 1,
    });

    const repeatedRead = transitionSmartCollectionSubscriptionMembership({
      current: member,
      now: new Date("2026-10-05T10:01:00.000Z"),
      notifyOnLeave: false,
      previous: firstEntry.nextState,
      subscription,
    });

    expect(repeatedRead.signal).toBeNull();
    expect(repeatedRead.nextState?.membershipPeriod).toBe(1);
  });

  test("emits the optional leave event with the same registered signal identity", () => {
    const entered = transitionSmartCollectionSubscriptionMembership({
      current: member,
      now: new Date("2026-10-05T10:00:00.000Z"),
      notifyOnLeave: true,
      previous: null,
      subscription,
    });
    const left = transitionSmartCollectionSubscriptionMembership({
      current: null,
      now: new Date("2026-10-05T10:02:00.000Z"),
      notifyOnLeave: true,
      previous: entered.nextState,
      subscription,
    });

    expect(left.signal).toMatchObject({
      eventType: "leave",
      membershipPeriod: 1,
      presentation: "Information Flow",
      reason: expect.stringContaining("Status: In Progress"),
      signalType: "smart-collection-entry",
    });
    expect(left.signal?.signalId).not.toBe(entered.signal?.signalId);
    expect(left.nextState).toMatchObject({
      isMember: false,
      membershipPeriod: 1,
    });
  });

  test("does not emit a leave signal when Notify on leave is disabled and advances on re-entry", () => {
    const entered = transitionSmartCollectionSubscriptionMembership({
      current: member,
      now: new Date("2026-10-05T10:00:00.000Z"),
      notifyOnLeave: false,
      previous: null,
      subscription,
    });
    const left = transitionSmartCollectionSubscriptionMembership({
      current: null,
      now: new Date("2026-10-05T10:02:00.000Z"),
      notifyOnLeave: false,
      previous: entered.nextState,
      subscription,
    });
    const reentered = transitionSmartCollectionSubscriptionMembership({
      current: member,
      now: new Date("2026-10-05T10:03:00.000Z"),
      notifyOnLeave: false,
      previous: left.nextState,
      subscription,
    });

    expect(left.signal).toBeNull();
    expect(reentered.signal).toMatchObject({
      eventType: "entry",
      membershipPeriod: 2,
      signalType: "smart-collection-entry",
    });
    expect(reentered.nextState).toMatchObject({
      isMember: true,
      membershipPeriod: 2,
    });
  });
});
