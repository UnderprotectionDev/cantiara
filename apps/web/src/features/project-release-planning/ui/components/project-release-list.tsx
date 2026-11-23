// biome-ignore-all lint/performance/noJsxPropsBind: Record windows bind identity to the row model for this surface.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  groupProjectReleasesByStatus,
  type ProjectReleaseOverview,
} from "@cantiara/api/project-release-planning";
import { VirtualList } from "@cantiara/ui/components/virtual-list";
import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { projectReleasesHref } from "../../lib/project-release-planning-form";

/** 16.1 Project Releases: status-grouped, scannable list of one Project's releases. */
export function ProjectReleaseList({
  createControl,
  formatting,
  overview,
  projectId,
}: {
  createControl?: ReactNode;
  formatting: AccountPreferences;
  overview: ProjectReleaseOverview;
  projectId: string;
}) {
  const groups = groupProjectReleasesByStatus(overview.releases);
  return (
    <section aria-label="Project Releases" className="space-y-6">
      <header className="surface-header flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Releases</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Project Releases
          </h2>
        </div>
        {overview.readOnly ? null : <div>{createControl}</div>}
      </header>
      {overview.readOnly ? (
        <p className="text-sm text-muted-foreground">
          This Project is archived. Its Project Releases are read-only.
        </p>
      ) : null}
      {groups.length ? null : (
        <p className="text-muted-foreground">
          A Project Release is the publishable scope of this Project; it is not
          a Milestone or a Focus Period.
        </p>
      )}
      {groups.map(({ releases, status }) => (
        <section aria-label={status} className="space-y-2" key={status}>
          <h3 className="text-sm font-medium">
            {status}{" "}
            <span className="text-muted-foreground">({releases.length})</span>
          </h3>
          <VirtualList
            className="divide-y rounded-lg border border-border/70"
            estimateSize={100}
            gap={8}
            getKey={({ release }) => release.id}
            rows={releases}
          >
            {(
              { githubReferences, lastChangedAt, release, scope },
              rowProps,
            ) => (
              <li {...rowProps}>
                <AppLink
                  className="grid gap-1 p-4 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto]"
                  href={projectReleasesHref(projectId, release.id)}
                >
                  <span className="min-w-0 font-medium break-words">
                    {release.name}
                    {release.versionLabel ? (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        Version label {release.versionLabel}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {release.status}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Scope: {scope.completed} completed, {scope.open} open
                    {githubReferences
                      ? ` · ${githubReferences} GitHub ${githubReferences === 1 ? "reference" : "references"}`
                      : ""}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Last change{" "}
                    {formatAccountDateTime(lastChangedAt, formatting)}
                  </span>
                </AppLink>
              </li>
            )}
          </VirtualList>
        </section>
      ))}
    </section>
  );
}
