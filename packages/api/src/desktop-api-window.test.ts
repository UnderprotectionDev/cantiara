import { describe, expect, test } from "vitest";

import {
  type DesktopApiCompatibilityWindow,
  evaluateDesktopApiCompatibility,
} from "./desktop-api-window";

const compatibilityWindow = {
  currentContract: "cantiara-desktop-api/v2",
  previousContract: "cantiara-desktop-api/v1",
  publishedAt: "2026-08-01T00:00:00.000Z",
} satisfies DesktopApiCompatibilityWindow;

describe("signed desktop API compatibility window", () => {
  test("accepts the current and previous contract through the 30-day boundary", () => {
    const now = new Date("2026-08-31T00:00:00.000Z");

    expect(
      evaluateDesktopApiCompatibility(
        compatibilityWindow.currentContract,
        compatibilityWindow,
        now,
      ),
    ).toMatchObject({ accepted: true, contract: "cantiara-desktop-api/v2" });
    expect(
      evaluateDesktopApiCompatibility(
        compatibilityWindow.previousContract,
        compatibilityWindow,
        now,
      ),
    ).toMatchObject({ accepted: true, contract: "cantiara-desktop-api/v1" });
  });

  test("rejects an unknown contract and a contract after the window", () => {
    const expiredAt = new Date("2026-08-31T00:00:00.001Z");

    expect(
      evaluateDesktopApiCompatibility(
        "cantiara-desktop-api/v0",
        compatibilityWindow,
        new Date("2026-08-10T00:00:00.000Z"),
      ),
    ).toEqual({ accepted: false, reason: "unsupported-contract" });
    expect(
      evaluateDesktopApiCompatibility(
        compatibilityWindow.currentContract,
        compatibilityWindow,
        expiredAt,
      ),
    ).toEqual({ accepted: false, reason: "window-expired" });
  });

  test("rejects a missing contract before the API can assume compatibility", () => {
    expect(
      evaluateDesktopApiCompatibility(
        undefined,
        compatibilityWindow,
        new Date("2026-08-10T00:00:00.000Z"),
      ),
    ).toEqual({ accepted: false, reason: "missing-contract" });
  });
});
