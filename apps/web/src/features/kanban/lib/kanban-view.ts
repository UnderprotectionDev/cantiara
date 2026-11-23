import type { ProjectWorkSort } from "@cantiara/api/project-shell";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import {
  type ColumnDef,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
} from "@tanstack/react-table";
import { differenceInMinutes } from "date-fns";

const kanbanFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

const kanbanColumns: ColumnDef<typeof kanbanFeatures, WorkProfile>[] = [
  { accessorKey: "number", sortFn: sortFn_basic },
  { accessorKey: "title" },
  { accessorKey: "createdAt" },
  { accessorKey: "updatedAt" },
  { accessorKey: "id" },
  {
    id: "reappearDate",
    accessorFn: (work) => work.reappearDate ?? undefined,
    sortUndefined: "last",
  },
];

export function kanbanTableOptions(
  works: readonly WorkProfile[],
  sort: ProjectWorkSort,
) {
  return {
    columns: kanbanColumns,
    data: works,
    defaultColumn: {
      sortFn: (left, right, columnId) =>
        left.getValue<string>(columnId).localeCompare(right.getValue(columnId)),
    } satisfies Partial<ColumnDef<typeof kanbanFeatures, WorkProfile>>,
    features: kanbanFeatures,
    getRowId: (work: WorkProfile) => work.id,
    state: {
      sorting: [
        { id: sort.field, desc: sort.direction === "descending" },
        ...(sort.field === "number" ? [] : [{ id: "number", desc: false }]),
        { id: "id", desc: false },
      ],
    },
  };
}

export function filterDefaultKanbanWorks(
  works: readonly WorkProfile[],
  today: string,
) {
  return works.filter((work) => {
    const reappearDate = work.reappearDate ?? null;
    return (
      work.archivedAt === null &&
      (reappearDate === null || reappearDate <= today)
    );
  });
}

export function formatTimeInStatus(statusChangedAt: string, now = Date.now()) {
  const elapsedMinutes = Math.max(
    0,
    differenceInMinutes(now, new Date(statusChangedAt)),
  );
  const days = Math.floor(elapsedMinutes / 1440);
  const hours = Math.floor((elapsedMinutes % 1440) / 60);
  const minutes = elapsedMinutes % 60;

  if (days > 0) {
    return `${days} ${days === 1 ? "day" : "days"}${hours ? `, ${hours} ${hours === 1 ? "hour" : "hours"}` : ""}`;
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? "hour" : "hours"}${minutes ? `, ${minutes} ${minutes === 1 ? "minute" : "minutes"}` : ""}`;
  }
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}
