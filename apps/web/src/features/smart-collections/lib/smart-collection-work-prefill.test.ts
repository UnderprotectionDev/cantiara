import { describe, expect, test } from "vitest";

import {
  clearSmartCollectionWorkPrefillSearch,
  smartCollectionWorkPrefillFromSearch,
  smartCollectionWorkPrefillSearch,
  smartCollectionWorkPrefillWarning,
} from "./smart-collection-work-prefill";

describe("Smart Collection New work prefill", () => {
  test("carries Work equalities as temporary Create search values", () => {
    expect(
      smartCollectionWorkPrefillSearch({
        status: "In Progress",
        type: "Bug",
      }),
    ).toEqual({
      smartCollectionWorkStatus: "In Progress",
      smartCollectionWorkType: "Bug",
    });
  });

  test("does not carry another source type's status into New work", () => {
    expect(smartCollectionWorkPrefillSearch({ status: "Valid" })).toEqual({});
  });

  test("accepts only known Work values from Create search", () => {
    expect(
      smartCollectionWorkPrefillFromSearch({
        smartCollectionWorkStatus: "In Progress",
        smartCollectionWorkType: "Bug",
      }),
    ).toEqual({
      smartCollectionWorkStatus: "In Progress",
      smartCollectionWorkType: "Bug",
    });
    expect(
      smartCollectionWorkPrefillFromSearch({
        smartCollectionWorkStatus: "Not a status",
        smartCollectionWorkType: "Not a Work type",
      }),
    ).toEqual({});
  });

  test("clears temporary Create values while preserving other search values", () => {
    expect(
      clearSmartCollectionWorkPrefillSearch({
        collectionView: "Roadmap",
        smartCollectionWorkStatus: "In Progress",
        smartCollectionWorkType: "Bug",
      }),
    ).toEqual({
      collectionView: "Roadmap",
      smartCollectionWorkStatus: undefined,
      smartCollectionWorkType: undefined,
    });
  });

  test("keeps a status-only condition available for the miss warning", () => {
    expect(smartCollectionWorkPrefillSearch({ status: "In Progress" })).toEqual(
      { smartCollectionWorkStatus: "In Progress" },
    );
  });

  test("shows a warning when the Work type no longer matches", () => {
    expect(smartCollectionWorkPrefillWarning({ type: "Bug" }, "Task")).toBe(
      "This Work may not appear in this Smart Collection.",
    );
  });

  test("shows a warning when the default status does not match", () => {
    expect(
      smartCollectionWorkPrefillWarning({ status: "In Progress" }, "Bug"),
    ).toBe("This Work may not appear in this Smart Collection.");
  });

  test("keeps the warning hidden when the new Work matches", () => {
    expect(smartCollectionWorkPrefillWarning({ type: "Bug" }, "Bug")).toBe(
      null,
    );
  });
});
