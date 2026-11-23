import {
  type AccessorFnColumnDef,
  createSortedRowModel,
  type Row,
  type RowData,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

export const workListSortingFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export type WorkListSortColumn<T extends RowData> = Pick<
  AccessorFnColumnDef<typeof workListSortingFeatures, T>,
  "accessorFn" | "sortFn" | "sortUndefined"
>;

export const workListTextColumn = {
  sortFn<T extends RowData>(
    left: Row<typeof workListSortingFeatures, T>,
    right: Row<typeof workListSortingFeatures, T>,
    columnId: string,
  ) {
    return left
      .getValue<string>(columnId)
      .localeCompare(right.getValue(columnId));
  },
};
