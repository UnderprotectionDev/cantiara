import {
  PROJECT_HISTORY_LABEL,
  PROJECT_HISTORY_OPEN_SOURCE_LABEL,
  STORY_TIMELINE_LABEL,
  type StoryEvent,
  type StoryTimeline,
} from "@cantiara/api/project-history";
import { format, parseISO } from "date-fns";
import { AppLink } from "@/components/app-link";
import { storySourceHref } from "../../lib/project-history-links";

function StoryEventItem({
  event,
  projectId,
}: {
  event: StoryEvent;
  projectId: string;
}) {
  return (
    <li className="space-y-1 rounded-md border border-border/60 p-3">
      <p className="text-muted-foreground text-sm">
        <time dateTime={event.occurredAt}>
          {format(parseISO(event.occurredAt), "yyyy-MM-dd")}
        </time>
        {` · ${event.kind}`}
        {event.state ? ` · ${event.state}` : ""}
      </p>
      <h4 className="font-medium">{event.title}</h4>
      {event.abandonmentRationale ? (
        <p className="text-sm">{`Abandonment rationale: ${event.abandonmentRationale}`}</p>
      ) : null}
      <AppLink
        aria-label={`${PROJECT_HISTORY_OPEN_SOURCE_LABEL}: ${event.source.label}`}
        className="underline underline-offset-2"
        href={storySourceHref(projectId, event.source)}
      >
        {PROJECT_HISTORY_OPEN_SOURCE_LABEL}
      </AppLink>
    </li>
  );
}

/**
 * The `Story Timeline` of `Project History`: realized important events in
 * chronological order, one list item per event. It is read-only: no control
 * edits a source field, and it shows no signal, summary, release note or
 * success sentence. Each event opens its owner record.
 */
export function StoryTimelineView({
  projectId,
  timeline,
}: {
  projectId: string;
  timeline: StoryTimeline;
}) {
  const headingId = `story-timeline-${timeline.scope.kind === "Feature" ? timeline.scope.workId : timeline.scope.projectId}`;
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <header className="space-y-1">
        <p className="surface-kicker">{PROJECT_HISTORY_LABEL}</p>
        <h3 className="font-semibold text-xl" id={headingId}>
          {STORY_TIMELINE_LABEL}
        </h3>
        {timeline.scope.kind === "Feature" ? (
          <p className="text-muted-foreground text-sm">
            {`${timeline.scope.key} ${timeline.scope.title}`}
          </p>
        ) : null}
      </header>
      {timeline.events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No realized events yet.</p>
      ) : (
        <ol aria-labelledby={headingId} className="space-y-2">
          {timeline.events.map((event) => (
            <StoryEventItem
              event={event}
              key={event.eventId}
              projectId={projectId}
            />
          ))}
        </ol>
      )}
      {timeline.unavailable.length > 0 ? (
        <ul className="space-y-1 text-muted-foreground text-sm">
          {timeline.unavailable.map((source) => (
            <li key={source.kind} role="status">
              {`${source.kind}: ${source.reason}`}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
