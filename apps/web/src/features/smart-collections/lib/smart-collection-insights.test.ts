import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import { describe, expect, test } from "vitest";

import {
  filterSmartCollectionWorks,
  getSmartCollectionInsights,
  toggleSmartCollectionInsightSelection,
} from "./smart-collection-insights";

type CollectionWork = SmartCollectionViewSource["works"][number];

const work = (overrides: Partial<CollectionWork>): CollectionWork => ({
  createdAt: "2026-09-30T12:00:00.000Z",
  effort: null,
  id: "work-1",
  key: "CAN-1",
  membershipReasons: [],
  projectId: "project-1",
  status: "In Progress",
  statusChangedAt: "2026-10-04T12:00:00.000Z",
  title: "Work",
  type: "Task",
  ...overrides,
});

const now = new Date("2026-10-05T12:00:00.000Z");

const works = [
  work({ effort: "Large", id: "work-young" }),
  work({
    createdAt: "2026-09-27T12:00:00.000Z",
    effort: null,
    id: "work-middle",
    key: "CAN-2",
    statusChangedAt: "2026-09-25T12:00:00.000Z",
  }),
  work({
    createdAt: "2026-08-26T12:00:00.000Z",
    effort: "Medium",
    id: "work-old",
    key: "CAN-3",
    status: "Done",
    statusChangedAt: "2026-08-26T12:00:00.000Z",
  }),
  work({
    createdAt: "2026-10-06T12:00:00.000Z",
    id: "work-future",
    key: "CAN-4",
    statusChangedAt: "2026-10-06T12:00:00.000Z",
  }),
];

describe("Smart Collection light insights", () => {
  test("summarizes the current authorized Work set without scores", () => {
    const insights = getSmartCollectionInsights(works, now);

    expect(insights.recordCount).toBe(4);
    expect(insights.statusSlices).toEqual([
      { count: 1, dimension: "status", label: "Done", value: "Done" },
      {
        count: 3,
        dimension: "status",
        label: "In Progress",
        value: "In Progress",
      },
    ]);
    expect(insights.effortSlices).toEqual([
      { count: 1, dimension: "effort", label: "Large", value: "Large" },
      { count: 1, dimension: "effort", label: "Medium", value: "Medium" },
      { count: 2, dimension: "effort", label: "Not set", value: null },
    ]);
    expect(insights.ageSlices).toEqual([
      { count: 2, dimension: "age", label: "0–7 days", value: "0–7 days" },
      { count: 1, dimension: "age", label: "8–30 days", value: "8–30 days" },
      { count: 1, dimension: "age", label: "31+ days", value: "31+ days" },
    ]);
    expect(insights.timeInStatusSlices).toEqual([
      {
        count: 2,
        dimension: "timeInStatus",
        label: "0–7 days",
        value: "0–7 days",
      },
      {
        count: 1,
        dimension: "timeInStatus",
        label: "8–30 days",
        value: "8–30 days",
      },
      {
        count: 1,
        dimension: "timeInStatus",
        label: "31+ days",
        value: "31+ days",
      },
    ]);
    expect(Object.keys(insights).sort()).toEqual([
      "ageSlices",
      "effortSlices",
      "recordCount",
      "statusSlices",
      "timeInStatusSlices",
    ]);
  });

  test("drills into the exact slice and recomputes insights from that subset", () => {
    const selectedWorks = filterSmartCollectionWorks(
      works,
      { dimension: "status", value: "In Progress" },
      now,
    );

    expect(selectedWorks.map(({ id }) => id)).toEqual([
      "work-young",
      "work-middle",
      "work-future",
    ]);
    expect(getSmartCollectionInsights(selectedWorks, now)).toMatchObject({
      ageSlices: [
        { count: 2, label: "0–7 days" },
        { count: 1, label: "8–30 days" },
        { count: 0, label: "31+ days" },
      ],
      recordCount: 3,
    });
  });

  test("combines dimensions, replaces one slice, and clears it on a second click", () => {
    const status = { dimension: "status", value: "In Progress" } as const;
    const effort = { dimension: "effort", value: "Large" } as const;
    const replacementStatus = { dimension: "status", value: "Done" } as const;
    const withStatus = toggleSmartCollectionInsightSelection([], status);
    const combined = toggleSmartCollectionInsightSelection(withStatus, effort);

    expect(combined).toEqual([status, effort]);
    expect(
      combined
        .reduce(
          (selected, selection) =>
            filterSmartCollectionWorks(selected, selection, now),
          works,
        )
        .map(({ id }) => id),
    ).toEqual(["work-young"]);

    const replaced = toggleSmartCollectionInsightSelection(
      combined,
      replacementStatus,
    );
    expect(replaced).toEqual([effort, replacementStatus]);
    expect(
      toggleSmartCollectionInsightSelection(replaced, replacementStatus),
    ).toEqual([effort]);
  });

  test("treats unset effort as a drillable slice", () => {
    expect(
      filterSmartCollectionWorks(
        works,
        { dimension: "effort", value: null },
        now,
      ).map(({ id }) => id),
    ).toEqual(["work-middle", "work-future"]);
  });

  test("keeps selected categorical slices clearable after an empty drill-down", () => {
    const insights = getSmartCollectionInsights([], now, [
      { dimension: "status", value: "Done" },
      { dimension: "effort", value: "Large" },
    ]);

    expect(insights.recordCount).toBe(0);
    expect(insights.statusSlices).toEqual([
      { count: 0, dimension: "status", label: "Done", value: "Done" },
    ]);
    expect(insights.effortSlices).toEqual([
      { count: 0, dimension: "effort", label: "Large", value: "Large" },
    ]);
  });

  test("buckets completed elapsed days across daylight-saving changes", () => {
    const insights = getSmartCollectionInsights(
      [
        work({
          createdAt: "2025-03-01T15:30:00.000Z",
          id: "work-before-daylight-saving",
          statusChangedAt: "2025-03-01T15:30:00.000Z",
        }),
      ],
      new Date("2025-03-09T14:30:00.000Z"),
    );

    expect(insights.ageSlices[0]).toMatchObject({
      count: 1,
      label: "0–7 days",
    });
    expect(insights.timeInStatusSlices[0]).toMatchObject({
      count: 1,
      label: "0–7 days",
    });
  });
});
