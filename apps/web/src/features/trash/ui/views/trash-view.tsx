// biome-ignore-all lint/performance/noJsxPropsBind: The move handler binds to one candidate.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  MOVE_TO_TRASH_LABEL,
  type MoveToTrashPreview,
  TRASH_LABEL,
  TRASH_RETENTION_DAYS,
  type TrashEntry,
  type TrashSurfaceDisposition,
} from "@cantiara/api/trash";
import type { TrashEarlyDeletePreview } from "@cantiara/api/trash-early-delete";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import type { TrashCandidate } from "../../lib/trash-candidates";
import { TrashEntryList } from "../components/trash-entry-list";
import { MoveToTrashForm } from "../forms/move-to-trash-form";
import { PermanentlyDeleteForm } from "../forms/permanently-delete-form";

/**
 * Trash: the records waiting out their 30-day window, and `Move to Trash` for
 * a live record. Trash is not Archive and not a restore-point library.
 */
/** Early `Permanently Delete`: the preview, the Account Access grant step and the delete itself. */
export interface TrashPermanentDelete {
  confirmIdentity: () => Promise<string>;
  permanentlyDelete: (
    entry: TrashEntry,
    confirmation: { grant: string; typedName: string },
  ) => Promise<unknown>;
  preview: (entry: TrashEntry) => Promise<TrashEarlyDeletePreview>;
}

export function TrashView({
  candidates,
  entries,
  formatting,
  onMove,
  onPreview,
  onRestore,
  permanentDelete,
}: {
  candidates: readonly TrashCandidate[];
  entries: readonly TrashEntry[];
  formatting: AccountPreferences;
  onMove: (
    candidate: TrashCandidate,
    disposition: TrashSurfaceDisposition,
  ) => Promise<unknown>;
  onPreview: (candidate: TrashCandidate) => Promise<MoveToTrashPreview>;
  onRestore: (entry: TrashEntry) => Promise<unknown>;
  permanentDelete?: TrashPermanentDelete;
}) {
  const [deleting, setDeleting] = useState<{
    entry: TrashEntry;
    grant: string | null;
    identityPending: boolean;
    preview: TrashEarlyDeletePreview;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function reviewDelete(entry: TrashEntry) {
    if (!permanentDelete) {
      return;
    }
    setDeleteError(null);
    try {
      setDeleting({
        entry,
        grant: null,
        identityPending: false,
        preview: await permanentDelete.preview(entry),
      });
    } catch {
      setDeleteError("Could not load the Permanently Delete preview.");
    }
  }

  async function confirmIdentity() {
    if (!(permanentDelete && deleting)) {
      return;
    }
    setDeleteError(null);
    setDeleting({ ...deleting, identityPending: true });
    try {
      const grant = await permanentDelete.confirmIdentity();
      setDeleting((current) =>
        current ? { ...current, grant, identityPending: false } : current,
      );
    } catch {
      setDeleteError("Confirm GitHub Identity could not be completed.");
      setDeleting((current) =>
        current ? { ...current, identityPending: false } : current,
      );
    }
  }

  async function deleteForever(typedName: string) {
    if (!(permanentDelete && deleting?.grant)) {
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await permanentDelete.permanentlyDelete(deleting.entry, {
        grant: deleting.grant,
        typedName,
      });
      setDeleting(null);
    } catch {
      // The grant is single-use: a failed attempt needs a fresh confirmation.
      setDeleting((current) => (current ? { ...current, grant: null } : null));
      setDeleteError(
        "Could not permanently delete. Check the name and confirm again.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreFailed, setRestoreFailed] = useState<string | null>(null);
  const [restoredLabel, setRestoredLabel] = useState<string | null>(null);

  async function restore(entry: TrashEntry) {
    setRestoring(entry.id);
    setRestoreFailed(null);
    setRestoredLabel(null);
    try {
      await onRestore(entry);
      setRestoredLabel(entry.recordLabel);
    } catch {
      setRestoreFailed(entry.id);
    } finally {
      setRestoring(null);
    }
  }

  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<{
    candidate: TrashCandidate;
    preview: MoveToTrashPreview;
  } | null>(null);

  // The preview comes first: the founder sees every attached External
  // Surface before anything is committed.
  async function review(candidate: TrashCandidate) {
    const key = `${candidate.kind}:${candidate.id}`;
    setPending(key);
    setFailed(null);
    try {
      setReviewing({ candidate, preview: await onPreview(candidate) });
    } catch {
      setFailed(key);
    } finally {
      setPending(null);
    }
  }

  async function confirm(disposition: TrashSurfaceDisposition) {
    if (!reviewing) {
      return;
    }
    const { candidate } = reviewing;
    const key = `${candidate.kind}:${candidate.id}`;
    setPending(key);
    setFailed(null);
    try {
      await onMove(candidate, disposition);
      setReviewing(null);
    } catch {
      setFailed(key);
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-label={TRASH_LABEL} className="space-y-6">
      <header className="space-y-1">
        <h2 className="font-semibold text-2xl tracking-tight">{TRASH_LABEL}</h2>
        <p className="text-muted-foreground text-sm">
          A record in {TRASH_LABEL} keeps its identity for{" "}
          {TRASH_RETENTION_DAYS} days, then it is permanently deleted.
        </p>
      </header>
      <TrashEntryList
        entries={entries}
        failedId={restoreFailed}
        formatting={formatting}
        onPermanentlyDelete={permanentDelete ? reviewDelete : undefined}
        onRestore={restore}
        pendingId={restoring}
      />
      {deleting ? (
        <PermanentlyDeleteForm
          busy={deleteBusy}
          error={deleteError}
          grant={deleting.grant}
          identityPending={deleting.identityPending}
          onCancel={() => setDeleting(null)}
          onConfirmIdentity={confirmIdentity}
          onSubmit={deleteForever}
          preview={deleting.preview}
        />
      ) : null}
      {deleting || !deleteError ? null : <p role="alert">{deleteError}</p>}
      <p aria-live="polite" role="status">
        {restoredLabel ? `Restored ${restoredLabel}.` : null}
      </p>
      {candidates.length > 0 ? (
        <section aria-label={MOVE_TO_TRASH_LABEL} className="space-y-2">
          <h3 className="font-medium">{MOVE_TO_TRASH_LABEL}</h3>
          <ul className="space-y-2">
            {candidates.map((candidate) => {
              const key = `${candidate.kind}:${candidate.id}`;
              return (
                <li className="flex flex-wrap items-center gap-3" key={key}>
                  <span className="text-muted-foreground text-sm">
                    {candidate.kind}
                  </span>
                  <span className="min-w-0 break-words">{candidate.label}</span>
                  <Button
                    aria-label={`${MOVE_TO_TRASH_LABEL}: ${candidate.label}`}
                    disabled={pending !== null}
                    onClick={() => review(candidate)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {MOVE_TO_TRASH_LABEL}
                  </Button>
                  {reviewing?.candidate === candidate ? (
                    <div className="basis-full">
                      <MoveToTrashForm
                        candidate={candidate}
                        disabled={pending !== null}
                        onCancel={() => setReviewing(null)}
                        onConfirm={confirm}
                        preview={reviewing.preview}
                      />
                    </div>
                  ) : null}
                  {failed === key ? (
                    <span role="alert">
                      Could not move to {TRASH_LABEL}. Reload and try again.
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
