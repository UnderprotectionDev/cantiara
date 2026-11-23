import {
  type ColumnDef,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_basic,
  tableFeatures,
} from "@tanstack/react-table";

export type BacklogPresentation =
  | "Manual order"
  | "Priority"
  | "Date"
  | "Field";
export type BacklogSortField = "Title" | "Status";

interface PresentableWork {
  id: string;
  plannedStartDate: string | null;
  status: string;
  targetDate: string | null;
  title: string;
}

const backlogFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

interface BacklogRow<T> {
  priority: number;
  work: T;
}

export function backlogTableOptions<T extends PresentableWork>(
  works: readonly T[],
  presentation: BacklogPresentation,
  priorityByWorkId: ReadonlyMap<string, number>,
  field: BacklogSortField,
) {
  const columns: ColumnDef<typeof backlogFeatures, BacklogRow<T>>[] = [
    {
      id: "Priority",
      accessorKey: "priority",
      sortFn: sortFn_basic,
    },
    {
      id: "Date",
      accessorFn: ({ work }) =>
        work.targetDate ?? work.plannedStartDate ?? "9999-12-31",
    },
    {
      id: "Field",
      accessorFn: ({ work }) => (field === "Status" ? work.status : work.title),
    },
  ];
  return {
    columns,
    data: works.map((work) => ({
      priority: priorityByWorkId.get(work.id) ?? -1,
      work,
    })),
    defaultColumn: {
      sortFn: (left, right, columnId) =>
        left.getValue<string>(columnId).localeCompare(right.getValue(columnId)),
    } satisfies Partial<ColumnDef<typeof backlogFeatures, BacklogRow<T>>>,
    features: backlogFeatures,
    getRowId: ({ work }: BacklogRow<T>) => work.id,
    state: {
      // Table keeps the input order for ties and with no active sort.
      sorting:
        presentation === "Manual order"
          ? []
          : [{ id: presentation, desc: presentation === "Priority" }],
    },
  };
}
