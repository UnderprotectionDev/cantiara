import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  PROJECT_UPDATE_LABEL,
  PROJECT_UPDATE_OPEN_SOURCE_LABEL,
  type ProjectUpdate,
} from "@cantiara/api/project-updates";
import { AppLink } from "@/components/app-link";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { projectRecordHref } from "@/features/project-history/lib/project-record-links";
import { ProjectUpdateSummary } from "./project-update-summary";

/**
 * The chronology of Project Updates, newest first. Each entry is read-only:
 * its mark, narrative and frozen summary stay as saved. Linked records are
 * live and open from `Open source record`.
 */
export function ProjectUpdateList({
  formatting,
  projectId,
  updates,
}: {
  formatting: AccountPreferences;
  projectId: string;
  updates: readonly ProjectUpdate[];
}) {
  if (updates.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No {PROJECT_UPDATE_LABEL} yet. Each one you save is added here with the
        date; none replaces another.
      </p>
    );
  }
  return (
    <ol aria-label="Project Updates, newest first" className="space-y-4">
      {updates.map((update) => (
        <li
          className="space-y-3 rounded-lg border border-border/70 p-4"
          key={update.id}
        >
          <article aria-label={`${PROJECT_UPDATE_LABEL} ${update.mark}`}>
            <header className="flex flex-wrap items-baseline gap-3">
              <h3 className="font-semibold">{update.mark}</h3>
              <time
                className="text-muted-foreground text-sm"
                dateTime={update.savedAt}
              >
                {formatAccountDateTime(update.savedAt, formatting)}
              </time>
            </header>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">
              {update.narrative}
            </p>
            {update.links.length ? (
              <ul
                aria-label="Linked records"
                className="mt-3 space-y-1 text-sm"
              >
                {update.links.map((link) => (
                  <li key={`${link.targetType}:${link.targetId}`}>
                    {link.unavailable ? (
                      <span className="text-muted-foreground">
                        {link.targetType} (unavailable)
                      </span>
                    ) : (
                      <>
                        {link.targetType}: {link.label}
                        {link.status ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {link.status}
                          </span>
                        ) : null}{" "}
                        <AppLink
                          className="underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
                          href={projectRecordHref(projectId, {
                            recordId: link.targetId,
                            recordType: link.targetType,
                          })}
                        >
                          {PROJECT_UPDATE_OPEN_SOURCE_LABEL}
                        </AppLink>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
            <details className="mt-3">
              <summary className="cursor-pointer text-sm">
                Summary as saved on{" "}
                {formatAccountDateTime(update.savedAt, formatting)}
              </summary>
              <div className="mt-2">
                <ProjectUpdateSummary snapshot={update.snapshot} />
              </div>
            </details>
          </article>
        </li>
      ))}
    </ol>
  );
}
