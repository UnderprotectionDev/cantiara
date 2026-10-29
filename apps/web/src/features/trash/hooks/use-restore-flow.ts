import type { TrashEntry } from "@cantiara/api/trash";
import {
  isTrashConfigurationKind,
  type TrashRestoreConflict,
  type TrashRestorePreview,
} from "@cantiara/api/trash-configuration";
import { useState } from "react";

/**
 * The restore state of one Trash list. A definition with an unresolvable
 * dependency shows a conflict preview and stays in Trash; nothing is rebound.
 */
export function useRestoreFlow({
  onRestore,
  onRestorePreview,
}: {
  onRestore: (entry: TrashEntry) => Promise<unknown>;
  onRestorePreview?: (entry: TrashEntry) => Promise<TrashRestorePreview>;
}) {
  const [conflicts, setConflicts] = useState<{
    conflicts: TrashRestoreConflict[];
    label: string;
  } | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [restoredLabel, setRestoredLabel] = useState<string | null>(null);

  async function restore(entry: TrashEntry) {
    setRestoring(entry.id);
    setFailedId(null);
    setRestoredLabel(null);
    setConflicts(null);
    try {
      if (onRestorePreview && isTrashConfigurationKind(entry.recordKind)) {
        const check = await onRestorePreview(entry);
        if (!check.restorable) {
          setConflicts({
            conflicts: check.conflicts,
            label: entry.recordLabel,
          });
          return;
        }
      }
      await onRestore(entry);
      setRestoredLabel(entry.recordLabel);
    } catch {
      setFailedId(entry.id);
    } finally {
      setRestoring(null);
    }
  }

  return { conflicts, failedId, restore, restoredLabel, restoring };
}
