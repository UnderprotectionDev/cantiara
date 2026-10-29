import type { TrashEntry } from "@cantiara/api/trash";
import type { TrashEarlyDeletePreview } from "@cantiara/api/trash-early-delete";
import { useState } from "react";

/** Early `Permanently Delete`: the preview, the Account Access grant step and the delete itself. */
export interface TrashPermanentDelete {
  confirmIdentity: () => Promise<string>;
  permanentlyDelete: (
    entry: TrashEntry,
    confirmation: { grant: string; typedName: string },
  ) => Promise<unknown>;
  preview: (entry: TrashEntry) => Promise<TrashEarlyDeletePreview>;
}

/** The review state of one early `Permanently Delete`. */
export function usePermanentDeleteFlow(permanentDelete?: TrashPermanentDelete) {
  const [deleting, setDeleting] = useState<{
    entry: TrashEntry;
    grant: string | null;
    identityPending: boolean;
    preview: TrashEarlyDeletePreview;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(entry: TrashEntry) {
    if (!permanentDelete) {
      return;
    }
    setError(null);
    try {
      setDeleting({
        entry,
        grant: null,
        identityPending: false,
        preview: await permanentDelete.preview(entry),
      });
    } catch {
      setError("Could not load the Permanently Delete preview.");
    }
  }

  async function confirmIdentity() {
    if (!(permanentDelete && deleting)) {
      return;
    }
    setError(null);
    setDeleting({ ...deleting, identityPending: true });
    try {
      const grant = await permanentDelete.confirmIdentity();
      setDeleting((current) =>
        current ? { ...current, grant, identityPending: false } : current,
      );
    } catch {
      setError("Confirm GitHub Identity could not be completed.");
      setDeleting((current) =>
        current ? { ...current, identityPending: false } : current,
      );
    }
  }

  async function deleteForever(typedName: string) {
    if (!(permanentDelete && deleting?.grant)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await permanentDelete.permanentlyDelete(deleting.entry, {
        grant: deleting.grant,
        typedName,
      });
      setDeleting(null);
    } catch {
      // The grant is single-use: a failed attempt needs a fresh confirmation.
      setDeleting((current) => (current ? { ...current, grant: null } : null));
      setError(
        "Could not permanently delete. Check the name and confirm again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    cancel: () => setDeleting(null),
    confirmIdentity,
    deleteForever,
    deleting,
    error,
    review,
  };
}
