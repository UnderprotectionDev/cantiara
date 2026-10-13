import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { SmartCollectionInsightSelection } from "../../lib/smart-collection-insights";
import { SmartCollectionInsights } from "./smart-collection-insights";

type CollectionWork = SmartCollectionViewSource["works"][number];

const works: CollectionWork[] = [
  {
    createdAt: "2026-10-05T08:00:00.000Z",
    effort: null,
    id: "work-1",
    key: "CAN-1",
    membershipReasons: [],
    projectId: "project-1",
    status: "In Progress",
    statusChangedAt: "2026-10-04T08:00:00.000Z",
    title: "Work",
    type: "Task",
  },
];

const noOp = (): undefined => undefined;

function renderInsights(
  selectedSlices: SmartCollectionInsightSelection[] = [],
  selectedWorks: readonly CollectionWork[] = works,
) {
  return renderToStaticMarkup(
    <SmartCollectionInsights
      now={new Date("2026-10-05T12:00:00.000Z")}
      onSelectSlice={noOp}
      onShowAllRecords={noOp}
      selectedSlices={selectedSlices}
      works={selectedWorks}
    />,
  );
}

describe("Smart Collection Insights surface", () => {
  test("shows accessible counts and drill-down distributions without score language", () => {
    const html = renderInsights();

    expect(html).toContain('aria-label="Insights"');
    expect(html).toContain("Count: 1");
    expect(html).toContain("Status");
    expect(html).toContain("Effort");
    expect(html).toContain("Not set");
    expect(html).toContain("Age");
    expect(html).toContain("Time in status");
    expect(html).toContain('type="button"');
    expect(html.toLowerCase()).not.toContain("score");
    expect(html.toLowerCase()).not.toContain("readiness");
    expect(html.toLowerCase()).not.toContain("coverage");
  });

  test("marks selected slices and offers Show all records", () => {
    const html = renderInsights([
      { dimension: "status", value: "In Progress" },
    ]);

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Show all records");
  });

  test("keeps selected slices visible when combined filters have no matches", () => {
    const html = renderInsights(
      [
        { dimension: "status", value: "Done" },
        { dimension: "effort", value: "Large" },
      ],
      [],
    );

    expect(html).toContain("Done");
    expect(html).toContain("Large");
    expect(html.split('aria-pressed="true"')).toHaveLength(3);
  });

  test("renders fixed catalog rows when the collection has no records", () => {
    const html = renderInsights([], []);

    expect(html).toContain("Not Started");
    expect(html).toContain("Blocked");
    expect(html).toContain("Not set");
  });
});
