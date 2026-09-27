import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { formatAccountDate } from "@/features/account-preferences/lib/account-preferences-format";
import { workRecordHref } from "@/features/project-shell/lib/project-shell-navigation";

export type CalendarView = "Day" | "Week" | "Month" | "Agenda";
export type CalendarWork = Pick<
  WorkProfile,
  | "archivedAt"
  | "id"
  | "key"
  | "plannedStartDate"
  | "projectId"
  | "reappearDate"
  | "status"
  | "targetDate"
  | "title"
>;

export const CALENDAR_DATE_KINDS = [
  { field: "plannedStartDate", label: "Planned start" },
  { field: "targetDate", label: "Target date" },
  { field: "reappearDate", label: "Reappear date" },
] as const;
export type CalendarDateKind = (typeof CALENDAR_DATE_KINDS)[number]["field"];

export function calendarDateKindsForSelection(selected: Iterable<string>) {
  const selectedFields = new Set(selected);
  return CALENDAR_DATE_KINDS.filter(({ field }) => selectedFields.has(field));
}

function dateSpan(work: CalendarWork) {
  const { plannedStartDate, targetDate } = work;
  if (!(plannedStartDate && targetDate)) {
    return null;
  }
  return {
    end: plannedStartDate > targetDate ? plannedStartDate : targetDate,
    start: plannedStartDate < targetDate ? plannedStartDate : targetDate,
  };
}

function visibleDays(
  selectedDate: string,
  view: Exclude<CalendarView, "Agenda">,
  firstDayOfWeek: AccountPreferences["firstDayOfWeek"],
) {
  const selected = parseISO(selectedDate);
  if (view === "Day") {
    return [selectedDate];
  }
  const weekStartsOn = firstDayOfWeek === "Sunday" ? 0 : 1;
  const start =
    view === "Week"
      ? startOfWeek(selected, { weekStartsOn })
      : startOfMonth(selected);
  const end =
    view === "Week"
      ? endOfWeek(selected, { weekStartsOn })
      : endOfMonth(selected);
  return eachDayOfInterval({
    start,
    end,
  }).map((day) => format(day, "yyyy-MM-dd"));
}

export default function UnifiedCalendar({
  preferences,
  projects,
  selectedDate,
  selectedDateKinds = CALENDAR_DATE_KINDS.map(({ field }) => field),
  selectedProjectId,
  view,
  works,
}: {
  preferences: AccountPreferences;
  projects: readonly { id: string; name: string }[];
  selectedDate: string;
  selectedDateKinds?: readonly CalendarDateKind[];
  selectedProjectId: string;
  view: CalendarView;
  works: readonly CalendarWork[];
}) {
  const projectNames = new Map(projects.map(({ id, name }) => [id, name]));
  const scopedWorks = works.filter(
    (work) =>
      work.archivedAt === null &&
      (selectedProjectId === "all" || work.projectId === selectedProjectId),
  );
  const visibleKinds = calendarDateKindsForSelection(selectedDateKinds);
  const hasStartAndTargetKinds =
    selectedDateKinds.includes("plannedStartDate") &&
    selectedDateKinds.includes("targetDate");

  if (view === "Agenda") {
    const monthDays = visibleDays(
      selectedDate,
      "Month",
      preferences.firstDayOfWeek,
    );
    const firstAgendaDay = monthDays[0] ?? selectedDate;
    const lastAgendaDay = monthDays.at(-1) ?? selectedDate;
    const rows = scopedWorks
      .flatMap((work) =>
        visibleKinds.flatMap(({ field, label }) => {
          const date = work[field];
          return date && firstAgendaDay <= date && date <= lastAgendaDay
            ? [{ date, field, label, work }]
            : [];
        }),
      )
      .sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          CALENDAR_DATE_KINDS.findIndex(({ field }) => field === left.field) -
            CALENDAR_DATE_KINDS.findIndex(
              ({ field }) => field === right.field,
            ) ||
          left.work.key.localeCompare(right.work.key),
      );

    return (
      <section aria-label="Agenda Calendar">
        {rows.length === 0 ? (
          <p className="mb-4 text-muted-foreground text-sm">
            No dated Work in this Calendar view.
          </p>
        ) : null}
        <ol className="divide-y divide-border/70">
          {rows.map(({ date, field, label, work }) => (
            <li
              className="grid gap-x-4 gap-y-1 py-2 sm:grid-cols-[minmax(8rem,auto)_minmax(9rem,auto)_minmax(0,1fr)_auto] sm:items-center"
              key={`${work.id}:${field}`}
            >
              <time className="text-muted-foreground text-sm" dateTime={date}>
                {formatAccountDate(date, preferences)}
              </time>
              <span className="font-medium text-sm">{label}</span>
              <div className="min-w-0 text-sm">
                <span className="font-medium">{work.key}</span> · {work.title}
                {selectedProjectId === "all" ? (
                  <span className="block text-muted-foreground">
                    {projectNames.get(work.projectId)}
                  </span>
                ) : null}
              </div>
              <a
                aria-label={`Open source record: ${work.key} · ${work.title}`}
                className="w-fit rounded text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                href={workRecordHref(work.projectId, work.id)}
              >
                Open source record
              </a>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const days = visibleDays(selectedDate, view, preferences.firstDayOfWeek);
  const firstVisibleDay = days[0] ?? selectedDate;
  const lastVisibleDay = days.at(-1) ?? selectedDate;
  const monthLeadingDays =
    view === "Month"
      ? (parseISO(firstVisibleDay).getDay() -
          (preferences.firstDayOfWeek === "Sunday" ? 0 : 1) +
          7) %
        7
      : 0;
  const scopedSpans = scopedWorks.flatMap((work) => {
    const span = dateSpan(work);
    return span ? [{ work, ...span }] : [];
  });
  const hasVisibleDatedWork =
    scopedWorks.some((work) =>
      visibleKinds.some(
        ({ field }) => work[field] && days.includes(work[field]),
      ),
    ) ||
    (view !== "Day" &&
      hasStartAndTargetKinds &&
      scopedSpans.some(
        ({ start, end }) => start <= lastVisibleDay && firstVisibleDay <= end,
      ));

  return (
    <>
      {hasVisibleDatedWork ? null : (
        <p className="mb-4 text-muted-foreground text-sm">
          No dated Work in this Calendar view.
        </p>
      )}
      <section
        aria-label={`${view} Calendar`}
        className={
          view === "Day"
            ? "grid gap-3"
            : "grid grid-cols-1 gap-2 sm:grid-cols-7"
        }
      >
        {monthLeadingDays > 0 ? (
          <div
            aria-hidden="true"
            className="hidden sm:block"
            style={{ gridColumn: `span ${monthLeadingDays}` }}
          />
        ) : null}
        {days.map((day) => {
          const marks = scopedWorks.flatMap((work) =>
            visibleKinds.flatMap(({ field, label }) =>
              work[field] === day ? [{ work, field, label }] : [],
            ),
          );
          const ranges =
            view === "Day" || !hasStartAndTargetKinds
              ? []
              : scopedSpans.filter(
                  ({ start, end }) => start <= day && day <= end,
                );
          return (
            <section
              aria-label={formatAccountDate(day, preferences)}
              className="min-h-28 rounded-lg border border-border/70 bg-card/40 p-3"
              key={day}
            >
              <h2 className="mb-2 border-border/60 border-b pb-2 font-medium text-sm">
                {new Intl.DateTimeFormat(preferences.locale, {
                  timeZone: "UTC",
                  weekday: "short",
                }).format(new Date(day))}{" "}
                {formatAccountDate(day, preferences)}
              </h2>
              {ranges.map(({ work }) => (
                <a
                  className="mb-2 block rounded bg-primary/10 px-2 py-1 text-xs hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-ring"
                  href={workRecordHref(work.projectId, work.id)}
                  key={work.id}
                >
                  <span className="font-medium">{work.key}</span> · {work.title}
                  <span className="block text-muted-foreground">
                    Planned start · Target date
                  </span>
                </a>
              ))}
              {marks.length > 0 ? (
                <ul className="space-y-1.5">
                  {marks.map(({ field, label, work }) => (
                    <li key={`${work.id}:${field}`}>
                      <a
                        className="block rounded border border-border/70 px-2 py-1 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                        href={workRecordHref(work.projectId, work.id)}
                      >
                        <span className="block font-medium">{label}</span>
                        <span>
                          {work.key} · {work.title}
                        </span>
                        {selectedProjectId === "all" ? (
                          <span className="block text-muted-foreground">
                            {projectNames.get(work.projectId)}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </section>
    </>
  );
}
