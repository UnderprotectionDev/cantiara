import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  groupProjectReleasesByStatus,
  type ProjectReleaseOverview,
} from "@cantiara/api/project-release-planning";
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
          <p className="text-muted-foreground text-sm">Releases</p>
          <h2 className="font-semibold text-2xl tracking-tight">
            Project Releases
          </h2>
        </div>
        {overview.readOnly ? null : <div>{createControl}</div>}
      </header>
      {overview.readOnly ? (
        <p className="text-muted-foreground text-sm">
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
          <h3 className="font-medium text-sm">
            {status}{" "}
            <span className="text-muted-foreground">({releases.length})</span>
          </h3>
          <ul className="divide-y rounded-lg border border-border/70">
            {releases.map(
              ({ githubReferences, lastChangedAt, release, scope }) => (
                <li key={release.id}>
                  <AppLink
                    className="grid gap-1 p-4 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto]"
                    href={projectReleasesHref(projectId, release.id)}
                  >
                    <span className="min-w-0 break-words font-medium">
                      {release.name}
                      {release.versionLabel ? (
                        <span className="ml-2 font-normal text-muted-foreground text-sm">
                          Version label {release.versionLabel}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {release.status}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      Scope: {scope.completed} completed, {scope.open} open
                      {githubReferences
                        ? ` · ${githubReferences} GitHub ${githubReferences === 1 ? "reference" : "references"}`
                        : ""}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      Last change{" "}
                      {formatAccountDateTime(lastChangedAt, formatting)}
                    </span>
                  </AppLink>
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
    </section>
  );
}
