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
import type { TrashRestorePreview } from "@cantiara/api/trash-configuration";
import { Button } from "@cantiara/ui/components/button";
import { useMoveToTrashFlow } from "../../hooks/use-move-to-trash-flow";
import {
  type TrashPermanentDelete,
  usePermanentDeleteFlow,
} from "../../hooks/use-permanent-delete-flow";
import { useRestoreFlow } from "../../hooks/use-restore-flow";
import type { TrashCandidate } from "../../lib/trash-candidates";
import { TrashEntryList } from "../components/trash-entry-list";
import { TrashRestoreConflicts } from "../components/trash-restore-conflicts";
import { MoveToTrashForm } from "../forms/move-to-trash-form";
import { PermanentlyDeleteForm } from "../forms/permanently-delete-form";

/**
 * Trash: the records waiting out their 30-day window, and `Move to Trash` for
 * a live record. Trash is not Archive and not a restore-point library.
 */
export function TrashView({
  candidates,
  entries,
  formatting,
  onMove,
  onPreview,
  onRestore,
  permanentDelete,
  onRestorePreview,
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
  /** Configuration kinds only: reads dependency conflicts before a restore. */
  onRestorePreview?: (entry: TrashEntry) => Promise<TrashRestorePreview>;
}) {
  const del = usePermanentDeleteFlow(permanentDelete);
  const restoreFlow = useRestoreFlow({ onRestore, onRestorePreview });
  const move = useMoveToTrashFlow({ onMove, onPreview });
  const { deleting } = del;
  const { conflicts, restoredLabel } = restoreFlow;
  const { failed, pending, reviewing } = move;

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
        failedId={restoreFlow.failedId}
        formatting={formatting}
        onPermanentlyDelete={permanentDelete ? del.review : undefined}
        onRestore={restoreFlow.restore}
        pendingId={restoreFlow.restoring}
      />
      {deleting ? (
        <PermanentlyDeleteForm
          busy={del.busy}
          error={del.error}
          grant={deleting.grant}
          identityPending={deleting.identityPending}
          onCancel={del.cancel}
          onConfirmIdentity={del.confirmIdentity}
          onSubmit={del.deleteForever}
          preview={deleting.preview}
        />
      ) : null}
      {deleting || !del.error ? null : <p role="alert">{del.error}</p>}
      {conflicts ? (
        <TrashRestoreConflicts
          conflicts={conflicts.conflicts}
          label={conflicts.label}
        />
      ) : null}
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
                    onClick={() => move.review(candidate)}
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
                        onCancel={move.cancel}
                        onConfirm={move.confirm}
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
