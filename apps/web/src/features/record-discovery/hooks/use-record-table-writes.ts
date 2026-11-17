import type {
  RecordTableCellUpdateInput,
  RecordTablePasteInput,
} from "@cantiara/api/record-discovery";
import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { client, invalidateSmartCollectionMembership } from "@/utils/orpc";

/**
 * The record table's `updateTableCell` and `applyTablePaste` writes. A cell or
 * pasted row can change a status or a Work type that Smart Collection
 * conditions read, so the table and the membership surfaces refresh together.
 */
export function useRecordTableWrites(tableQueryKey: QueryKey) {
  const queryClient = useQueryClient();
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tableQueryKey }),
      ...invalidateSmartCollectionMembership(queryClient),
    ]);
  }, [queryClient, tableQueryKey]);
  const saveTableCell = useCallback(
    async (input: RecordTableCellUpdateInput) => {
      await client.updateTableCell(input);
      await refresh();
    },
    [refresh],
  );
  const applyTablePaste = useCallback(
    async (input: RecordTablePasteInput) => {
      await client.applyTablePaste(input);
      await refresh();
    },
    [refresh],
  );
  return { applyTablePaste, saveTableCell };
}
