import {
  PROJECT_ACTIVITY_LABEL,
  PROJECT_ACTIVITY_OPEN_SOURCE_LABEL,
  PROJECT_ACTIVITY_QUESTION_LABEL,
  PROJECT_HISTORY_LABEL,
  type ProjectActivity,
  type ProjectActivityChange,
  type ProjectActivityRow,
} from "@cantiara/api/project-activity";
import { Button } from "@cantiara/ui/components/button";
import { AppLink } from "@/components/app-link";
import type { ProjectActivityFilters } from "../../lib/project-activity-filters";
import {
  activityActorText,
  activityTimeText,
  activityValueText,
} from "../../lib/project-activity-format";
import { projectActivitySourceHref } from "../../lib/project-activity-links";
import { ProjectActivityFilterForm } from "../forms/project-activity-filter-form";

function ChangeLine({ change }: { change: ProjectActivityChange }) {
  const { values } = change;
  if (values.kind === "redacted") {
    return (
      <li>
        <span className="font-medium">{change.field}</span>
        {": value redacted"}
      </li>
    );
  }
  if (values.kind === "unsupported") {
    return (
      <li>
        <span className="font-medium">{change.field}</span>
        {": changed (previous and next values are not shown for this field)"}
      </li>
    );
  }
  return (
    <li>
      <span className="font-medium">{change.field}</span>
      {": "}
      <span>
        {activityValueText(values.previous, values.previousTruncated)}
      </span>
      {" → "}
      <span>{activityValueText(values.next, values.nextTruncated)}</span>
    </li>
  );
}

function ActivityRow({
  projectId,
  row,
}: {
  projectId: string;
  row: ProjectActivityRow;
}) {
  return (
    <li className="space-y-1 rounded-md border border-border/60 p-3">
      <p className="font-medium">
        {`${row.eventType} · ${row.source.recordType} · ${row.source.label}`}
      </p>
      <p className="text-muted-foreground text-sm">
        <span>
          {activityActorText(
            row.actor.kind,
            row.actor.actorId,
            row.actor.authorizingUserId,
          )}
        </span>
        {" · "}
        <time dateTime={row.occurredAt}>
          {activityTimeText(row.occurredAt)}
        </time>
        {row.origin.kind === "source" ? " · from a source delivery" : null}
        {row.undo.of ? " · undo of an earlier change" : null}
      </p>
      {row.redacted ? (
        <p className="text-sm">Redacted for security. No content is shown.</p>
      ) : null}
      {row.changes.length > 0 ? (
        <ul aria-label="Previous and next values" className="text-sm">
          {row.changes.map((change) => (
            <ChangeLine change={change} key={change.field} />
          ))}
        </ul>
      ) : null}
      <AppLink
        aria-label={`${PROJECT_ACTIVITY_OPEN_SOURCE_LABEL}: ${row.source.label}`}
        className="text-sm underline underline-offset-2"
        href={projectActivitySourceHref(projectId, row.source)}
      >
        {PROJECT_ACTIVITY_OPEN_SOURCE_LABEL}
      </AppLink>
    </li>
  );
}

/**
 * `Project Activity`: the atomic, filterable `What changed?` trail derived from
 * existing record history. It is a secondary area: not the Project landing
 * surface, not a Notification Center section and not the `Story Timeline`.
 * Rows are read-only and open the source record; nothing here writes.
 */
export function ProjectActivityView({
  activity,
  filters,
  hasMore,
  loadingMore,
  onApplyFilters,
  onLoadMore,
  projectId,
}: {
  activity: ProjectActivity;
  filters: ProjectActivityFilters;
  hasMore: boolean;
  loadingMore: boolean;
  onApplyFilters: (filters: ProjectActivityFilters) => void;
  onLoadMore: () => void;
  projectId: string;
}) {
  const notes = activity.sources.filter(
    (source) => source.status !== "available" && source.reason,
  );
  return (
    <section aria-labelledby="project-activity-heading" className="space-y-5">
      <header className="space-y-1">
        <h2 className="font-semibold text-xl">{PROJECT_HISTORY_LABEL}</h2>
        <h3 className="font-medium text-lg" id="project-activity-heading">
          {PROJECT_ACTIVITY_LABEL}
        </h3>
        <p className="text-muted-foreground text-sm">
          {PROJECT_ACTIVITY_QUESTION_LABEL}
        </p>
      </header>
      <ProjectActivityFilterForm
        filters={filters}
        key={`${filters.sourceTypes.join()}|${filters.eventTypes.join()}`}
        onApply={onApplyFilters}
      />
      {notes.length > 0 ? (
        <ul
          aria-label="Source coverage"
          className="space-y-1 text-sm"
          role="status"
        >
          {notes.map((source) => (
            <li className="text-muted-foreground" key={source.sourceType}>
              {`${source.sourceType}: ${source.reason}`}
            </li>
          ))}
        </ul>
      ) : null}
      {activity.unattributed.length > 0 ? (
        <details className="text-sm">
          <summary className="cursor-pointer">
            History not attributed to a Project record
          </summary>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {activity.unattributed.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {activity.windowReached ? (
        <p className="text-muted-foreground text-sm" role="status">
          Only the newest history is read. Older changes are not listed.
        </p>
      ) : null}
      {activity.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No changes match these filters.
        </p>
      ) : (
        <ol aria-label={PROJECT_ACTIVITY_LABEL} className="space-y-2">
          {activity.rows.map((row) => (
            <ActivityRow key={row.id} projectId={projectId} row={row} />
          ))}
        </ol>
      )}
      {hasMore ? (
        <Button
          disabled={loadingMore}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          Show older changes
        </Button>
      ) : null}
    </section>
  );
}
