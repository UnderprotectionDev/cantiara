import type {
  RecordTableCellUpdateInput,
  RecordTablePasteInput,
} from "@cantiara/api/record-discovery";
import {
  type QueryKey,
  useMutation,
  useMutationState,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

export type RecordTableCellTarget = Pick<
  RecordTableCellUpdateInput,
  "baseRevision" | "field" | "projectId" | "recordId" | "recordType"
>;

export interface RecordTableCellWrite {
  error: Error | null;
  isPending: boolean;
  variables: RecordTableCellUpdateInput;
}

function cellKey(target: RecordTableCellTarget) {
  return JSON.stringify([
    target.recordType,
    target.projectId,
    target.recordId,
    target.field,
    target.baseRevision,
  ]);
}

/**
 * The record table's `updateTableCell` and `applyTablePaste` writes. A cell or
 * pasted row can change a status or a Work type that Smart Collection
 * conditions read, so the table and the membership surfaces refresh together.
 */
export function useRecordTableWrites(tableQueryKey: QueryKey) {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: tableQueryKey }),
      ...invalidateSmartCollectionMembership(queryClient),
    ]);
  };
  const cellOptions = orpc.updateTableCell.mutationOptions({
    meta: { onlineWrite: true },
    mutationFn: (input) => client.updateTableCell(input),
    onSuccess: refresh,
  });
  const cell = useMutation(cellOptions);
  const cellStates = useMutationState({
    filters: { exact: true, mutationKey: cellOptions.mutationKey },
    select: ({ state }) => state,
  });
  const writesByCell = useMemo(() => {
    const writes = new Map<string, RecordTableCellWrite>();
    for (const state of cellStates) {
      // This cache subscription selects only updateTableCell mutations.
      const variables = state.variables as
        | RecordTableCellUpdateInput
        | undefined;
      if (variables) {
        writes.set(cellKey(variables), {
          error: state.error,
          isPending: state.status === "pending",
          variables,
        });
      }
    }
    return writes;
  }, [cellStates]);
  const cellWrite = useCallback(
    (target: RecordTableCellTarget) => writesByCell.get(cellKey(target)),
    [writesByCell],
  );
  const paste = useMutation(
    orpc.applyTablePaste.mutationOptions({
      // A paste can be retried from its reviewed rows. A toast from a previous
      // review must not submit after its rows have been discarded.
      meta: { onlineWrite: true, retryInSurface: true },
      mutationFn: (input: RecordTablePasteInput) =>
        client.applyTablePaste(input),
      onSuccess: refresh,
    }),
  );
  return {
    applyTablePaste: paste.mutateAsync,
    cellWrite,
    pasteWrite: paste,
    saveTableCell: cell.mutateAsync,
  };
}
