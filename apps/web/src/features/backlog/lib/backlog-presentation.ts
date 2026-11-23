import { sortFn_basic } from "@tanstack/react-table";
import {
  type WorkListSortColumn,
  workListSortingFeatures,
  workListTextColumn,
} from "@/lib/work-list-sorting";

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
  const sortColumns: Record<
    Exclude<BacklogPresentation, "Manual order">,
    WorkListSortColumn<BacklogRow<T>>
  > = {
    Priority: {
      accessorFn: ({ priority }) => priority,
      sortFn: sortFn_basic,
    },
    Date: {
      accessorFn: ({ work }) =>
        work.targetDate ?? work.plannedStartDate ?? "9999-12-31",
    },
    Field: {
      accessorFn: ({ work }) => (field === "Status" ? work.status : work.title),
    },
  };
  return {
    columns: Object.entries(sortColumns).map(([id, column]) => ({
      ...column,
      id,
    })),
    data: works.map((work) => ({
      priority: priorityByWorkId.get(work.id) ?? -1,
      work,
    })),
    defaultColumn: workListTextColumn,
    features: workListSortingFeatures,
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
