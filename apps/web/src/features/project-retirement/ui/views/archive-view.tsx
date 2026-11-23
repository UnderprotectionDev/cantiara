// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface state.

import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import {
  ARCHIVE_LABEL,
  type ArchivedProjectEntry,
  DELETE_PROJECT_LABEL,
  REPUBLISH_APPROVAL_NOTICE,
  RESTORE_TO_ARCHIVE_LABEL,
  RESTORE_TO_ARCHIVE_RESULT,
  UNARCHIVE_LABEL,
} from "@cantiara/api/project-retirement";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  VirtualList,
  type VirtualRowProps,
} from "@cantiara/ui/components/virtual-list";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";

function EntryCard({
  deletePanel,
  entry,
  formatting,
  onDelete,
  onRestore,
  onUnarchive,
  pending,
  rowProps,
}: {
  deletePanel?: ReactNode;
  entry: ArchivedProjectEntry;
  formatting: AccountPreferences;
  onDelete?: (entry: ArchivedProjectEntry) => void;
  onRestore?: (entry: ArchivedProjectEntry) => void;
  onUnarchive: (entry: ArchivedProjectEntry) => void;
  pending: boolean;
  rowProps: VirtualRowProps;
}) {
  const { project, trash } = entry;
  return (
    <li
      {...rowProps}
      className="space-y-4 rounded-lg border p-4"
      data-project-id={project.id}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">{project.name}</h3>
            <Badge variant="secondary">{project.status}</Badge>
            {trash ? <Badge variant="destructive">{trash.mark}</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {project.shortCode}
            {project.archivedAt
              ? ` · Archived ${formatAccountDateTime(project.archivedAt, formatting)}`
              : ""}
          </p>
        </div>
        {trash && onRestore ? (
          <Button
            className="min-h-11"
            disabled={pending}
            onClick={() => onRestore(entry)}
            type="button"
            variant="outline"
          >
            {RESTORE_TO_ARCHIVE_LABEL}
          </Button>
        ) : null}
        {trash ? null : (
          <Button
            className="min-h-11"
            disabled={pending}
            onClick={() => onUnarchive(entry)}
            type="button"
            variant="outline"
          >
            {UNARCHIVE_LABEL}
          </Button>
        )}
        {onDelete && !trash ? (
          <Button
            className="min-h-11"
            disabled={pending}
            onClick={() => onDelete(entry)}
            type="button"
            variant="destructive"
          >
            {DELETE_PROJECT_LABEL}
          </Button>
        ) : null}
      </div>
      {trash ? (
        <p className="text-sm text-muted-foreground">
          The Project group is in Trash until{" "}
          {formatAccountDateTime(trash.expiresAt, formatting)}.{" "}
          {RESTORE_TO_ARCHIVE_RESULT} {REPUBLISH_APPROVAL_NOTICE}
        </p>
      ) : null}
      {deletePanel}

      <section aria-label="Living External Surfaces" className="space-y-1">
        <h4 className="text-sm font-medium">Living External Surfaces</h4>
        {entry.surfaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No approved External Surface is live.
          </p>
        ) : (
          <VirtualList
            className="space-y-1 text-sm"
            estimateSize={26}
            gap={4}
            getKey={(surface) => surface.surfaceId}
            rows={entry.surfaces}
          >
            {(surface, surfaceRowProps) => (
              <li {...surfaceRowProps}>
                {surface.title} · {surface.visibility} · {surface.sourceState}
              </li>
            )}
          </VirtualList>
        )}
      </section>

      <section aria-label="Open security actions" className="space-y-1">
        <h4 className="text-sm font-medium">Open security actions</h4>
        {entry.securityActions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No access-reducing action is open.
          </p>
        ) : (
          <VirtualList
            className="space-y-1 text-sm"
            estimateSize={60}
            gap={4}
            getKey={(item) => `${item.action}:${item.source.id}`}
            rows={entry.securityActions}
          >
            {(item, actionRowProps) => (
              <li {...actionRowProps}>
                {item.label} · {item.source.title} · {item.source.state}
              </li>
            )}
          </VirtualList>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        {entry.githubNotice}{" "}
        <Link
          className="underline underline-offset-4"
          hash="github"
          params={{ projectId: project.id }}
          to="/projects/$projectId"
        >
          Open the GitHub area
        </Link>
      </p>
    </li>
  );
}

/**
 * Archive: archived Projects with their living External Surfaces and open
 * security actions. `Delete Project` lives only here, on an archived Project.
 */
export function ArchiveView({
  deletePanel,
  error,
  errorMessage,
  formatting = DEFAULT_ACCOUNT_PREFERENCES,
  loading,
  onDelete,
  onRestore,
  onUnarchive,
  pendingProjectId,
  projects,
}: {
  /** The delete preview of one Project, rendered inside its card. */
  deletePanel?: { node: ReactNode; projectId: string } | null;
  error: boolean;
  errorMessage?: string | null;
  formatting?: AccountPreferences;
  loading: boolean;
  onDelete?: (entry: ArchivedProjectEntry) => void;
  onRestore?: (entry: ArchivedProjectEntry) => void;
  onUnarchive: (entry: ArchivedProjectEntry) => void;
  pendingProjectId?: string | null;
  projects: readonly ArchivedProjectEntry[];
}) {
  return (
    <section aria-label={ARCHIVE_LABEL} className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          {ARCHIVE_LABEL}
        </h2>
        <p className="text-sm text-muted-foreground">
          Archived Projects are read-only. Their life-cycle status is unchanged.
        </p>
      </header>
      {error ? <p role="alert">The Archive could not be loaded.</p> : null}
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {loading ? <p>Loading…</p> : null}
      {!(loading || error) && projects.length === 0 ? (
        <p>No Project is archived.</p>
      ) : null}
      {projects.length > 0 ? (
        <VirtualList
          className="space-y-3"
          estimateSize={220}
          gap={12}
          getKey={(entry) => entry.project.id}
          keepMounted={deletePanel ? [deletePanel.projectId] : undefined}
          rows={projects}
        >
          {(entry, rowProps) => (
            <EntryCard
              deletePanel={
                deletePanel?.projectId === entry.project.id
                  ? deletePanel.node
                  : null
              }
              entry={entry}
              formatting={formatting}
              onDelete={onDelete}
              onRestore={onRestore}
              onUnarchive={onUnarchive}
              pending={pendingProjectId === entry.project.id}
              rowProps={rowProps}
            />
          )}
        </VirtualList>
      ) : null}
    </section>
  );
}
