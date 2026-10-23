import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { expect, test } from "vitest";

import {
  formatSyncTime,
  linkActionsFor,
  syncNowMessage,
} from "../github-sync-labels";

test("each life state offers only the actions that apply to it", () => {
  expect(linkActionsFor("Connected")).toEqual({
    canDisconnect: true,
    canReconnect: false,
    canSyncNow: true,
  });
  expect(linkActionsFor("Paused")).toEqual({
    canDisconnect: true,
    canReconnect: true,
    canSyncNow: false,
  });
  expect(linkActionsFor("Disconnected")).toEqual({
    canDisconnect: false,
    canReconnect: true,
    canSyncNow: false,
  });
});

test("a Sync now answer always says what happened", () => {
  expect(syncNowMessage({ applied: 2, outcome: "ran", stale: 1 })).toBe(
    "Synced. 2 GitHub records updated, 1 already newer.",
  );
  expect(syncNowMessage({ applied: 0, outcome: "paused", stale: 0 })).toContain(
    "paused",
  );
  expect(
    syncNowMessage({ applied: 0, outcome: "rate-limited", stale: 0 }),
  ).toContain("wait");
});

test("a sync time reads in the founder's account format preferences", () => {
  expect(
    formatSyncTime("2026-09-16T09:00:00.000Z", DEFAULT_ACCOUNT_PREFERENCES),
  ).toBe("16 Sept 2026, 12:00");

  const preferences: AccountPreferences = {
    ...DEFAULT_ACCOUNT_PREFERENCES,
    dateFormat: "yyyy-MM-dd",
    timeZone: "America/Los_Angeles",
  };

  expect(formatSyncTime("2026-09-17T06:30:00.000Z", preferences)).toBe(
    "2026-09-16 23:30",
  );
});
