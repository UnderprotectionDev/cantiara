import { expect, test } from "vitest";

import { linkActionsFor, syncNowMessage } from "../github-sync-labels";

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
