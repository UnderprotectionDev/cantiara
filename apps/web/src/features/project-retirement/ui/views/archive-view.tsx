// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface state.

import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import {
  ARCHIVE_LABEL,
  type ArchivedProjectEntry,
  UNARCHIVE_LABEL,
} from "@cantiara/api/project-retirement";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import { Link } from "@tanstack/react-router";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";

function EntryCard({
  entry,
  formatting,
  onUnarchive,
  pending,
}: {
  entry: ArchivedProjectEntry;
  formatting: AccountPreferences;
  onUnarchive: (entry: ArchivedProjectEntry) => void;
  pending: boolean;
}) {
  const { project } = entry;
  return (
    <li
      className="space-y-4 rounded-lg border p-4"
      data-project-id={project.id}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-lg">{project.name}</h3>
            <Badge variant="secondary">{project.status}</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            {project.shortCode}
            {project.archivedAt
              ? ` · Archived ${formatAccountDateTime(project.archivedAt, formatting)}`
              : ""}
          </p>
        </div>
        <Button
          className="min-h-11"
          disabled={pending}
          onClick={() => onUnarchive(entry)}
          type="button"
          variant="outline"
        >
          {UNARCHIVE_LABEL}
        </Button>
      </div>

      <section aria-label="Living External Surfaces" className="space-y-1">
        <h4 className="font-medium text-sm">Living External Surfaces</h4>
        {entry.surfaces.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No approved External Surface is live.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {entry.surfaces.map((surface) => (
              <li key={surface.surfaceId}>
                {surface.title} · {surface.visibility} · {surface.sourceState}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Open security actions" className="space-y-1">
        <h4 className="font-medium text-sm">Open security actions</h4>
        {entry.securityActions.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No access-reducing action is open.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {entry.securityActions.map((item) => (
              <li key={`${item.action}:${item.source.id}`}>
                {item.label} · {item.source.title} · {item.source.state}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-sm">
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
 * security actions. It offers `Unarchive` only; Project deletion is not
 * presented here yet.
 */
export function ArchiveView({
  error,
  errorMessage,
  formatting = DEFAULT_ACCOUNT_PREFERENCES,
  loading,
  onUnarchive,
  pendingProjectId,
  projects,
}: {
  error: boolean;
  errorMessage?: string | null;
  formatting?: AccountPreferences;
  loading: boolean;
  onUnarchive: (entry: ArchivedProjectEntry) => void;
  pendingProjectId?: string | null;
  projects: readonly ArchivedProjectEntry[];
}) {
  return (
    <section aria-label={ARCHIVE_LABEL} className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-semibold text-2xl tracking-tight">
          {ARCHIVE_LABEL}
        </h2>
        <p className="text-muted-foreground text-sm">
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
        <ul className="space-y-3">
          {projects.map((entry) => (
            <EntryCard
              entry={entry}
              formatting={formatting}
              key={entry.project.id}
              onUnarchive={onUnarchive}
              pending={pendingProjectId === entry.project.id}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
