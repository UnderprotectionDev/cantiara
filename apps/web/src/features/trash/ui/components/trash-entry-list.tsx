import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  TRASH_EMPTY_LABEL,
  TRASH_LABEL,
  type TrashEntry,
} from "@cantiara/api/trash";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";

/**
 * The records waiting in Trash, soonest expiry first. Each row names the kind
 * and the label it had, and when its 30-day window ends.
 */
export function TrashEntryList({
  entries,
  formatting,
}: {
  entries: readonly TrashEntry[];
  formatting: AccountPreferences;
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
            Expires{" "}
            <time dateTime={entry.expiresAt}>
              {formatAccountDateTime(entry.expiresAt, formatting)}
            </time>
          </span>
        </li>
      ))}
    </ul>
  );
}
