import {
  TRASH_RESTORE_CONFLICTS_LABEL,
  type TrashRestoreConflict,
} from "@cantiara/api/trash-configuration";

/**
 * The conflict preview of a restore. A dependency that is permanently
 * deleted, in Trash or changed meaning is listed; nothing is rebound or
 * reminted, so the founder decides what to do next.
 */
export function TrashRestoreConflicts({
  conflicts,
  label,
}: {
  conflicts: readonly TrashRestoreConflict[];
  label: string;
}) {
  return (
    <section
      aria-label={TRASH_RESTORE_CONFLICTS_LABEL}
      className="basis-full space-y-1 rounded-lg border border-destructive/50 p-3"
      role="alert"
    >
      <h4 className="font-medium text-sm">
        {TRASH_RESTORE_CONFLICTS_LABEL}: {label}
      </h4>
      <ul>
        {conflicts.map((conflict) => (
          <li
            className="text-sm"
            key={`${conflict.dependencyKind}:${conflict.dependencyId}`}
          >
            {conflict.dependencyKind} {conflict.label}: {conflict.reason}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">
        Nothing was restored or rebound.
      </p>
    </section>
  );
}
