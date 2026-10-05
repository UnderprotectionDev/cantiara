import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import { Button } from "@cantiara/ui/components/button";
import { type MouseEvent, useCallback } from "react";
import {
  getSmartCollectionInsights,
  type SmartCollectionInsightSelection,
  type SmartCollectionInsightSlice,
} from "../../lib/smart-collection-insights";

type CollectionWork = SmartCollectionViewSource["works"][number];

function InsightDistribution({
  onSelectSlice,
  selectedSlices,
  slices,
  title,
}: {
  onSelectSlice: (selection: SmartCollectionInsightSelection) => void;
  selectedSlices: readonly SmartCollectionInsightSelection[];
  slices: readonly SmartCollectionInsightSlice[];
  title: string;
}) {
  const handleSliceClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const sliceIndex = Number(event.currentTarget.dataset.sliceIndex);
      const slice = slices[sliceIndex];
      if (slice) {
        onSelectSlice(slice);
      }
    },
    [onSelectSlice, slices],
  );

  return (
    <section aria-label={title} className="space-y-2">
      <h4 className="font-medium text-sm">{title}</h4>
      <ul className="space-y-1">
        {slices.map((slice, index) => {
          const selected = selectedSlices.some(
            (selection) =>
              selection.dimension === slice.dimension &&
              selection.value === slice.value,
          );
          return (
            <li key={`${slice.dimension}:${JSON.stringify(slice.value)}`}>
              <Button
                aria-pressed={selected}
                className="flex w-full justify-between"
                data-slice-index={index}
                disabled={slice.count === 0 && !selected}
                onClick={handleSliceClick}
                size="sm"
                type="button"
                variant={selected ? "secondary" : "outline"}
              >
                <span>{slice.label}</span>
                <span>{slice.count}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SmartCollectionInsights({
  now,
  onSelectSlice,
  onShowAllRecords,
  selectedSlices,
  works,
}: {
  now: Date;
  onSelectSlice: (selection: SmartCollectionInsightSelection) => void;
  onShowAllRecords: () => void;
  selectedSlices: readonly SmartCollectionInsightSelection[];
  works: readonly CollectionWork[];
}) {
  const insights = getSmartCollectionInsights(works, now, selectedSlices);

  return (
    <section
      aria-label="Insights"
      className="space-y-3 rounded-md bg-muted/30 p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium">Insights</h4>
        <p aria-live="polite" className="text-sm">
          Count: {insights.recordCount}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <InsightDistribution
          onSelectSlice={onSelectSlice}
          selectedSlices={selectedSlices}
          slices={insights.statusSlices}
          title="Status"
        />
        <InsightDistribution
          onSelectSlice={onSelectSlice}
          selectedSlices={selectedSlices}
          slices={insights.effortSlices}
          title="Effort"
        />
        <InsightDistribution
          onSelectSlice={onSelectSlice}
          selectedSlices={selectedSlices}
          slices={insights.ageSlices}
          title="Age"
        />
        <InsightDistribution
          onSelectSlice={onSelectSlice}
          selectedSlices={selectedSlices}
          slices={insights.timeInStatusSlices}
          title="Time in status"
        />
      </div>
      {selectedSlices.length > 0 ? (
        <Button onClick={onShowAllRecords} type="button" variant="ghost">
          Show all records
        </Button>
      ) : null}
    </section>
  );
}
