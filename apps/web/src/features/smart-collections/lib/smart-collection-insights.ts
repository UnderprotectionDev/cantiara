import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import { parseISO } from "date-fns";

type CollectionWork = SmartCollectionViewSource["works"][number];

export type SmartCollectionInsightElapsedDaysBucket =
  | "0–7 days"
  | "8–30 days"
  | "31+ days";

export type SmartCollectionInsightSelection =
  | { dimension: "status"; value: string }
  | { dimension: "effort"; value: string | null }
  | { dimension: "age"; value: SmartCollectionInsightElapsedDaysBucket }
  | {
      dimension: "timeInStatus";
      value: SmartCollectionInsightElapsedDaysBucket;
    };

export type SmartCollectionInsightSlice = SmartCollectionInsightSelection & {
  count: number;
  label: string;
};

export interface SmartCollectionInsights {
  ageSlices: Extract<SmartCollectionInsightSlice, { dimension: "age" }>[];
  effortSlices: Extract<SmartCollectionInsightSlice, { dimension: "effort" }>[];
  recordCount: number;
  statusSlices: Extract<SmartCollectionInsightSlice, { dimension: "status" }>[];
  timeInStatusSlices: Extract<
    SmartCollectionInsightSlice,
    { dimension: "timeInStatus" }
  >[];
}

const ELAPSED_DAYS_BUCKETS: SmartCollectionInsightElapsedDaysBucket[] = [
  "0–7 days",
  "8–30 days",
  "31+ days",
];
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function elapsedDaysBucket(
  date: string,
  now: Date,
): SmartCollectionInsightElapsedDaysBucket {
  const elapsedDays = Math.max(
    0,
    Math.floor(
      (now.getTime() - parseISO(date).getTime()) / MILLISECONDS_PER_DAY,
    ),
  );
  if (elapsedDays <= 7) {
    return "0–7 days";
  }
  if (elapsedDays <= 30) {
    return "8–30 days";
  }
  return "31+ days";
}

function countSlices<Dimension extends "age" | "timeInStatus">(
  dimension: Dimension,
  works: readonly CollectionWork[],
  getDate: (work: CollectionWork) => string,
  now: Date,
): Extract<SmartCollectionInsightSlice, { dimension: Dimension }>[] {
  const counts = new Map<SmartCollectionInsightElapsedDaysBucket, number>();
  for (const work of works) {
    const bucket = elapsedDaysBucket(getDate(work), now);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return ELAPSED_DAYS_BUCKETS.map((value) => ({
    count: counts.get(value) ?? 0,
    dimension,
    label: value,
    value,
  })) as Extract<SmartCollectionInsightSlice, { dimension: Dimension }>[];
}

function getStatusSlices(
  works: readonly CollectionWork[],
  selectedSlices: readonly SmartCollectionInsightSelection[],
): SmartCollectionInsights["statusSlices"] {
  const counts = new Map<string, number>();
  for (const work of works) {
    counts.set(work.status, (counts.get(work.status) ?? 0) + 1);
  }
  for (const selection of selectedSlices) {
    if (selection.dimension === "status" && !counts.has(selection.value)) {
      counts.set(selection.value, 0);
    }
  }
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({
      count,
      dimension: "status" as const,
      label: value,
      value,
    }));
}

function getEffortSlices(
  works: readonly CollectionWork[],
  selectedSlices: readonly SmartCollectionInsightSelection[],
): SmartCollectionInsights["effortSlices"] {
  const counts = new Map<string | null, number>();
  for (const work of works) {
    counts.set(work.effort, (counts.get(work.effort) ?? 0) + 1);
  }
  for (const selection of selectedSlices) {
    if (selection.dimension === "effort" && !counts.has(selection.value)) {
      counts.set(selection.value, 0);
    }
  }
  return [...counts]
    .sort(([left], [right]) => {
      if (left === null) {
        return 1;
      }
      if (right === null) {
        return -1;
      }
      return left.localeCompare(right);
    })
    .map(([value, count]) => ({
      count,
      dimension: "effort" as const,
      label: value ?? "Not set",
      value,
    }));
}

export function getSmartCollectionInsights(
  works: readonly CollectionWork[],
  now = new Date(),
  selectedSlices: readonly SmartCollectionInsightSelection[] = [],
): SmartCollectionInsights {
  return {
    ageSlices: countSlices("age", works, ({ createdAt }) => createdAt, now),
    effortSlices: getEffortSlices(works, selectedSlices),
    recordCount: works.length,
    statusSlices: getStatusSlices(works, selectedSlices),
    timeInStatusSlices: countSlices(
      "timeInStatus",
      works,
      ({ statusChangedAt }) => statusChangedAt,
      now,
    ),
  };
}

export function filterSmartCollectionWorks(
  works: readonly CollectionWork[],
  selection: SmartCollectionInsightSelection,
  now = new Date(),
): CollectionWork[] {
  return works.filter((work) => {
    switch (selection.dimension) {
      case "age":
        return elapsedDaysBucket(work.createdAt, now) === selection.value;
      case "effort":
        return work.effort === selection.value;
      case "status":
        return work.status === selection.value;
      case "timeInStatus":
        return elapsedDaysBucket(work.statusChangedAt, now) === selection.value;
      default:
        return assertNever(selection);
    }
  });
}

function assertNever(value: never): never {
  throw new Error(`Unsupported smart collection insight selection: ${value}`);
}

export function toggleSmartCollectionInsightSelection(
  current: readonly SmartCollectionInsightSelection[],
  selection: SmartCollectionInsightSelection,
): SmartCollectionInsightSelection[] {
  const active = current.find(
    ({ dimension }) => dimension === selection.dimension,
  );
  if (active?.value === selection.value) {
    return current.filter(({ dimension }) => dimension !== selection.dimension);
  }
  return [
    ...current.filter(({ dimension }) => dimension !== selection.dimension),
    selection,
  ];
}
