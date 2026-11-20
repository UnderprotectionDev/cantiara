import type { TrashEntry } from "@cantiara/api/trash";
import {
  isTrashConfigurationKind,
  type TrashRestorePreview,
} from "@cantiara/api/trash-configuration";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commandVariables } from "@/lib/command-variables";
import { orpc } from "@/utils/orpc";
import { refreshTrashQueries } from "../lib/refresh-trash-queries";

export function useRestoreFlow({
  onRestore,
  onRestorePreview,
}: {
  onRestore: (
    entry: TrashEntry,
    clientIdempotencyKey: string,
  ) => Promise<unknown>;
  onRestorePreview?: (entry: TrashEntry) => Promise<TrashRestorePreview>;
}) {
  const queryClient = useQueryClient();
  const inspect = useMutation({
    mutationFn: (entry: TrashEntry) =>
      onRestorePreview?.(entry) ?? Promise.resolve(undefined),
  });
  const commit = useMutation({
    mutationKey: orpc.restoreFromTrash.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      entry,
      clientIdempotencyKey,
    }: {
      entry: TrashEntry;
      clientIdempotencyKey: string;
    }) => onRestore(entry, clientIdempotencyKey),
    onSettled: (_, _error, { entry }) =>
      refreshTrashQueries(queryClient, entry),
  });

  async function restore(entry: TrashEntry) {
    inspect.reset();
    if (onRestorePreview && isTrashConfigurationKind(entry.recordKind)) {
      try {
        const check = await inspect.mutateAsync(entry);
        if (!check?.restorable) {
          return;
        }
      } catch {
        return;
      }
    }
    await commit
      .mutateAsync(
        commandVariables(
          { entry },
          commit.isError ? commit.variables : undefined,
        ),
      )
      .catch(() => undefined);
  }
  const conflicts =
    inspect.isSuccess && inspect.data && !inspect.data.restorable
      ? {
          conflicts: inspect.data.conflicts,
          label: inspect.variables.recordLabel,
        }
      : null;
  return {
    conflicts,
    failedId:
      (inspect.isError && inspect.variables.id) ||
      (commit.isError && commit.variables.entry.id) ||
      null,
    restore,
    restoredLabel:
      !(inspect.isPending || conflicts) && commit.isSuccess
        ? commit.variables.entry.recordLabel
        : null,
    restoring:
      (inspect.isPending && inspect.variables.id) ||
      (commit.isPending && commit.variables.entry.id) ||
      null,
  };
}
