import {
  SHARES_AND_PUBLICATIONS_LABEL,
  type SurfaceAction,
  type SurfaceRow,
} from "@cantiara/api/external-surface-management";
import { Badge } from "@cantiara/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cantiara/ui/components/table";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { shareLink, sourceLink } from "../../lib/surface-source-link";

const ACTION_CLASS =
  "inline-flex min-h-11 items-center rounded-md px-2 text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function accessLabel(row: SurfaceRow) {
  const parts = [row.passwordProtected ? "Password set" : "No password"];
  parts.push(row.expiresAt ? `Expires ${row.expiresAt}` : "No expiry");
  return parts.join(" · ");
}

function purgeLabel(purge: NonNullable<SurfaceRow["purge"]>) {
  if (purge.status === "Done") {
    return "Cache and index purge done";
  }
  if (purge.status === "Retrying") {
    return `Cache and index purge retrying (attempt ${purge.attempts}, next ${purge.nextAttemptAt})`;
  }
  return "Cache and index purge requested";
}

function ActionLink({
  action,
  row,
}: {
  action: SurfaceAction;
  row: SurfaceRow;
}) {
  const target = action === "Open source" ? sourceLink(row) : shareLink(row);
  return (
    <Link
      className={ACTION_CLASS}
      hash={target.hash}
      params={target.params as never}
      to={target.to}
    >
      {action}
    </Link>
  );
}

/** Actions this directory links to; row-level removal is rendered by `renderRemove`. */
function RowActions({
  renderRemove,
  row,
}: {
  renderRemove?: (row: SurfaceRow) => ReactNode;
  row: SurfaceRow;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {row.actions.map((action) =>
        action === "Revoke / Unpublish" ? (
          <span key={action}>{renderRemove?.(row)}</span>
        ) : (
          <ActionLink action={action} key={action} row={row} />
        ),
      )}
    </div>
  );
}

/**
 * Shares and Publications: one directory of every Dış yüzey. It lists and
 * manages existing surfaces; it starts no create flow and shows no view
 * counter, last access or visitor.
 */
export function SharesAndPublicationsView({
  error,
  loading,
  renderRemove,
  rows,
  scopeLabel,
}: {
  error: boolean;
  loading: boolean;
  renderRemove?: (row: SurfaceRow) => ReactNode;
  rows: readonly SurfaceRow[];
  scopeLabel: string;
}) {
  return (
    <section aria-label={SHARES_AND_PUBLICATIONS_LABEL} className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-semibold text-2xl tracking-tight">
          {SHARES_AND_PUBLICATIONS_LABEL}
        </h2>
        <p className="text-muted-foreground text-sm">{scopeLabel}</p>
      </header>
      {error ? <p role="alert">The directory could not be loaded.</p> : null}
      {loading ? <p>Loading…</p> : null}
      {!(loading || error) && rows.length === 0 ? (
        <p>Nothing is shared or published yet.</p>
      ) : null}
      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last approval</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow data-surface-id={row.surfaceId} key={row.surfaceId}>
                <TableCell>
                  <div className="font-medium">
                    {row.source.title || row.source.kind}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {row.source.kind}
                  </div>
                </TableCell>
                <TableCell>{row.visibility}</TableCell>
                <TableCell>{accessLabel(row)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge>{row.status}</Badge>
                    {row.hasUnpublishedChanges ? (
                      <Badge variant="outline">Unpublished changes</Badge>
                    ) : null}
                    {row.redaction === "Redacted" ? (
                      <Badge variant="outline">Redacted</Badge>
                    ) : null}
                    {row.purge ? (
                      <Badge variant="outline">{purgeLabel(row.purge)}</Badge>
                    ) : null}
                    {row.frozenDetached ? (
                      <Badge variant="outline">Frozen · source detached</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>{row.lastApprovedAt ?? "—"}</TableCell>
                <TableCell>
                  <RowActions renderRemove={renderRemove} row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </section>
  );
}
