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

export function presentBacklog<T extends PresentableWork>(
  works: readonly T[],
  presentation: BacklogPresentation,
  priorityByWorkId: ReadonlyMap<string, number> = new Map(),
  field: BacklogSortField = "Title",
): T[] {
  if (presentation === "Manual order") {
    return [...works];
  }

  return works
    .map((work, index) => ({ work, index }))
    .sort((left, right) => {
      let comparison = 0;
      if (presentation === "Priority") {
        comparison =
          (priorityByWorkId.get(right.work.id) ?? -1) -
          (priorityByWorkId.get(left.work.id) ?? -1);
      } else if (presentation === "Date") {
        const leftDate = left.work.targetDate ?? left.work.plannedStartDate;
        const rightDate = right.work.targetDate ?? right.work.plannedStartDate;
        comparison = (leftDate ?? "9999-12-31").localeCompare(
          rightDate ?? "9999-12-31",
        );
      } else {
        comparison = (
          field === "Status" ? left.work.status : left.work.title
        ).localeCompare(
          field === "Status" ? right.work.status : right.work.title,
        );
      }
      return comparison || left.index - right.index;
    })
    .map(({ work }) => work);
}
