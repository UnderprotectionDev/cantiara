// biome-ignore-all lint/performance/noJsxPropsBind: The restore handler binds to one entry.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  IN_TRASH_LABEL,
  RESTORE_LABEL,
  TRASH_EMPTY_LABEL,
  TRASH_LABEL,
  type TrashEntry,
} from "@cantiara/api/trash";
import { PERMANENTLY_DELETE_LABEL } from "@cantiara/api/trash-early-delete";
import { Button } from "@cantiara/ui/components/button";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";

/**
 * The records waiting in Trash, soonest expiry first. Each row names the kind
 * and the label it had, marks it `In Trash`, shows when its 30-day window
 * ends and offers `Restore`. A Project delete group shares one clock, so its
 * rows restore as one unit. This is not an Archive and not a restore-point
 * library.
 */
export function TrashEntryList({
  entries,
  failedId,
  formatting,
  onPermanentlyDelete,
  onRestore,
  pendingId,
}: {
  entries: readonly TrashEntry[];
  failedId?: string | null;
  formatting: AccountPreferences;
  onPermanentlyDelete?: (entry: TrashEntry) => void;
  onRestore?: (entry: TrashEntry) => void;
  pendingId?: string | null;
}) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">{TRASH_EMPTY_LABEL}</p>;
  }
  return (
    <ul aria-label={`${TRASH_LABEL} entries`} className="space-y-2">
      {entries.map((entry) => (
        <li
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-border/70 p-3"
          key={entry.id}
        >
          <span className="text-muted-foreground text-sm">
            {entry.recordKind}
          </span>
          <span className="min-w-0 break-words font-medium">
            {entry.recordLabel}
          </span>
          <span className="text-muted-foreground text-sm">
            {IN_TRASH_LABEL}
          </span>
          <span className="text-muted-foreground text-sm">
            Expires{" "}
            <time dateTime={entry.expiresAt}>
              {formatAccountDateTime(entry.expiresAt, formatting)}
            </time>
          </span>
          {entry.groupId ? (
            <span className="text-muted-foreground text-sm">
              Part of a Project delete group: restored together.
            </span>
          ) : null}
          {onRestore ? (
            <Button
              aria-label={`${RESTORE_LABEL}: ${entry.recordLabel}`}
              disabled={Boolean(pendingId)}
              onClick={() => onRestore(entry)}
              size="sm"
              type="button"
              variant="outline"
            >
              {RESTORE_LABEL}
            </Button>
          ) : null}
          {onPermanentlyDelete ? (
            <Button
              aria-label={`${PERMANENTLY_DELETE_LABEL}: ${entry.recordLabel}`}
              disabled={Boolean(pendingId)}
              onClick={() => onPermanentlyDelete(entry)}
              size="sm"
              type="button"
              variant="destructive"
            >
              {PERMANENTLY_DELETE_LABEL}
            </Button>
          ) : null}
          {failedId === entry.id ? (
            <span role="alert">Could not restore. Reload and try again.</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
