import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  LAST_APPROVED_LABEL,
  type PlaceholderFinding,
  type ShareScopePreview,
} from "@cantiara/api/link-sharing";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";

/**
 * Owner-only status of the share surface: the hybrid label and the last scope
 * approval time, the unresolved placeholders and the diff since that approval.
 * None of this reaches a visitor.
 */
export function ShareScopeStatus({
  formatting,
  preview,
}: {
  formatting: AccountPreferences;
  preview: ShareScopePreview;
}) {
  const { diff, surface } = preview;
  return (
    <div className="space-y-4">
      {surface ? (
        <p className="text-sm">
          <strong>{surface.label}</strong>
          {" · "}
          {LAST_APPROVED_LABEL}:{" "}
          <time dateTime={surface.lastApprovedAt}>
            {formatAccountDateTime(surface.lastApprovedAt, formatting)}
          </time>
          {` · Revision ${surface.revision}`}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Nothing is shared yet. No link exists until you approve this scope.
        </p>
      )}
      {diff &&
      diff.added.length + diff.changed.length + diff.removed.length > 0 ? (
        <section aria-label="Unpublished changes" className="space-y-1">
          <h4 className="font-medium text-sm">Unpublished changes</h4>
          <p className="text-muted-foreground text-sm">
            Only you see this. {diff.added.length} new, {diff.changed.length}{" "}
            changed, {diff.removed.length} removed since the last approval.
          </p>
        </section>
      ) : null}
      <PlaceholderList findings={preview.placeholders} />
    </div>
  );
}

function PlaceholderList({
  findings,
}: {
  findings: readonly PlaceholderFinding[];
}) {
  if (findings.length === 0) {
    return null;
  }
  return (
    <section aria-label="Unresolved placeholders" className="space-y-2">
      <h4 className="font-medium text-sm">Unresolved placeholders</h4>
      <p className="text-muted-foreground text-sm">
        Fix them in the record, or confirm Publish/share anyway below. Approving
        the scope does not accept them.
      </p>
      <ul className="space-y-2">
        {findings.map((finding) => (
          <li
            className="rounded-md border border-border/70 p-2 text-sm"
            key={`${finding.itemId}-${finding.context}`}
          >
            <p className="font-medium">
              {finding.recordKind}: {finding.recordTitle} · {finding.fieldLabel}
            </p>
            <p className="text-muted-foreground">
              <code>{finding.placeholder}</code> in “{finding.context}”
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
