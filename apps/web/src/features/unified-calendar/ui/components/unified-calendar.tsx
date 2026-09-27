import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { WorkDateField, WorkProfile } from "@cantiara/api/work-lifecycle";
import {
  type Active,
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  type Over,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { GripVertical } from "lucide-react";
import { useCallback, useState } from "react";
import { formatAccountDate } from "@/features/account-preferences/lib/account-preferences-format";
import { workRecordHref } from "@/features/project-shell/lib/project-shell-navigation";

export type CalendarView = "Day" | "Week" | "Month";
export type CalendarWork = Pick<
  WorkProfile,
  | "archivedAt"
  | "id"
  | "key"
  | "plannedStartDate"
  | "projectId"
  | "reappearDate"
  | "revision"
  | "status"
  | "targetDate"
  | "title"
>;

export interface CalendarDateChange {
  baseRevision: number;
  date: string;
  dateField: WorkDateField;
  workId: string;
}

const DATE_KINDS = [
  { field: "plannedStartDate", label: "Planned start" },
  { field: "targetDate", label: "Target date" },
  { field: "reappearDate", label: "Reappear date" },
] as const satisfies readonly { field: WorkDateField; label: string }[];
const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CalendarDateDrag {
  baseRevision: number;
  dateField: WorkDateField;
  label: (typeof DATE_KINDS)[number]["label"];
  oldDate: string;
  workId: string;
  workTitle: string;
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
  view: CalendarView,
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
  return eachDayOfInterval({ start, end }).map((day) =>
    format(day, "yyyy-MM-dd"),
  );
}

const calendarCollisionDetection: CollisionDetection = (args) => {
  const dayTargets = args.droppableContainers.filter(
    ({ data }) => typeof data.current?.date === "string",
  );
  const dayTargetArgs = { ...args, droppableContainers: dayTargets };
  if (args.pointerCoordinates) {
    return pointerWithin(dayTargetArgs);
  }
  return closestCenter(dayTargetArgs);
};

function calendarDateFromActive(active: Active): CalendarDateDrag | null {
  const value = active.data.current?.calendarDate;
  return typeof value === "object" && value !== null
    ? (value as CalendarDateDrag)
    : null;
}

function calendarDateFromOver(over: Over | null) {
  const date = over?.data.current?.date;
  return typeof date === "string" && CALENDAR_DATE_PATTERN.test(date)
    ? date
    : null;
}

function CalendarDateMark({
  dateField,
  disabled,
  label,
  onDateChange,
  projectNames,
  selectedProjectId,
  work,
}: {
  dateField: WorkDateField;
  disabled: boolean;
  label: CalendarDateDrag["label"];
  onDateChange?: (change: CalendarDateChange) => void;
  projectNames: ReadonlyMap<string, string>;
  selectedProjectId: string;
  work: CalendarWork;
}) {
  const dragData: CalendarDateDrag = {
    baseRevision: work.revision,
    dateField,
    label,
    oldDate: work[dateField] as string,
    workId: work.id,
    workTitle: work.title,
  };
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      data: { calendarDate: dragData },
      disabled: disabled || !onDateChange,
      id: `calendar-date:${work.id}:${dateField}`,
    });

  return (
    <li className="flex items-start gap-1" key={`${work.id}:${dateField}`}>
      <button
        aria-label={`${label} for ${work.title}`}
        className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
        disabled={disabled || !onDateChange}
        ref={setNodeRef}
        style={{
          opacity: isDragging ? 0.45 : undefined,
          transform: CSS.Translate.toString(transform),
        }}
        type="button"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <a
        className="min-w-0 flex-1 rounded border border-border/70 px-2 py-1 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
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
  );
}

function CalendarDaySection({
  day,
  disabled,
  formattingPreferences,
  onDateChange,
  projectNames,
  ranges,
  selectedProjectId,
  marks,
}: {
  day: string;
  disabled: boolean;
  formattingPreferences: AccountPreferences;
  onDateChange?: (change: CalendarDateChange) => void;
  projectNames: ReadonlyMap<string, string>;
  ranges: readonly CalendarWork[];
  selectedProjectId: string;
  marks: readonly {
    dateField: WorkDateField;
    label: CalendarDateDrag["label"];
    work: CalendarWork;
  }[];
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: { date: day },
    id: `calendar-day:${day}`,
  });
  const formattedDate = formatAccountDate(day, formattingPreferences);

  return (
    <section
      aria-label={formattedDate}
      className={`min-h-28 rounded-lg border bg-card/40 p-3 ${
        isOver ? "border-primary ring-2 ring-primary/40" : "border-border/70"
      }`}
      data-calendar-day={day}
      ref={setNodeRef}
    >
      <h2 className="mb-2 border-border/60 border-b pb-2 font-medium text-sm">
        {new Intl.DateTimeFormat(formattingPreferences.locale, {
          timeZone: "UTC",
          weekday: "short",
        }).format(new Date(day))}{" "}
        {formattedDate}
      </h2>
      {ranges.map((work) => (
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
          {marks.map(({ dateField, label, work }) => (
            <CalendarDateMark
              dateField={dateField}
              disabled={disabled}
              key={`${work.id}:${dateField}`}
              label={label}
              onDateChange={onDateChange}
              projectNames={projectNames}
              selectedProjectId={selectedProjectId}
              work={work}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function UnifiedCalendar({
  disabled = false,
  onDateChange,
  preferences,
  projects,
  selectedDate,
  selectedProjectId,
  view,
  works,
}: {
  disabled?: boolean;
  onDateChange?: (change: CalendarDateChange) => void;
  preferences: AccountPreferences;
  projects: readonly { id: string; name: string }[];
  selectedDate: string;
  selectedProjectId: string;
  view: CalendarView;
  works: readonly CalendarWork[];
}) {
  const [draggedDate, setDraggedDate] = useState<CalendarDateDrag | null>(null);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const cancelDrag = useCallback(() => {
    setDraggedDate(null);
    setPreviewDate(null);
  }, []);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const date = calendarDateFromOver(event.over);
      const dateChange = calendarDateFromActive(event.active);
      cancelDrag();
      if (date && dateChange && date !== dateChange.oldDate) {
        onDateChange?.({
          baseRevision: dateChange.baseRevision,
          date,
          dateField: dateChange.dateField,
          workId: dateChange.workId,
        });
      }
    },
    [cancelDrag, onDateChange],
  );
  const handleDragOver = useCallback(({ over }: DragOverEvent) => {
    setPreviewDate(calendarDateFromOver(over));
  }, []);
  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setDraggedDate(calendarDateFromActive(active));
    setPreviewDate(null);
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
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
  const projectNames = new Map(projects.map(({ id, name }) => [id, name]));
  const scopedWorks = works.filter(
    (work) =>
      work.archivedAt === null &&
      (selectedProjectId === "all" || work.projectId === selectedProjectId),
  );
  const scopedSpans = scopedWorks.flatMap((work) => {
    const span = dateSpan(work);
    return span ? [{ work, ...span }] : [];
  });
  const hasVisibleDatedWork =
    scopedWorks.some((work) =>
      DATE_KINDS.some(({ field }) => work[field] && days.includes(work[field])),
    ) ||
    (view !== "Day" &&
      scopedSpans.some(
        ({ start, end }) => start <= lastVisibleDay && firstVisibleDay <= end,
      ));

  function announceDate(
    date: CalendarDateDrag | null,
    nextDate?: string | null,
  ) {
    if (!date) {
      return "Calendar date was not moved.";
    }
    const oldValue = formatAccountDate(date.oldDate, preferences);
    if (nextDate) {
      return `${date.label} for ${date.workTitle}: ${oldValue} to ${formatAccountDate(nextDate, preferences)}.`;
    }
    return `${date.label} for ${date.workTitle}, ${oldValue}. Use the arrow keys to preview a date, Space to drop, or Escape to cancel.`;
  }

  return (
    <DndContext
      accessibility={{
        announcements: {
          onDragCancel: ({ active }) =>
            `${announceDate(calendarDateFromActive(active))} Cancelled.`,
          onDragEnd: (event) =>
            announceDate(
              calendarDateFromActive(event.active),
              calendarDateFromOver(event.over),
            ),
          onDragOver: (event) =>
            announceDate(
              calendarDateFromActive(event.active),
              calendarDateFromOver(event.over),
            ),
          onDragStart: ({ active }) =>
            announceDate(calendarDateFromActive(active)),
        },
        screenReaderInstructions: {
          draggable:
            "Press Space to pick up this date. Use the arrow keys to preview another day. Press Space to drop or Escape to cancel.",
        },
      }}
      collisionDetection={calendarCollisionDetection}
      onDragCancel={cancelDrag}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      {hasVisibleDatedWork ? null : (
        <p className="mb-4 text-muted-foreground text-sm">
          No dated Work in this Calendar view.
        </p>
      )}
      {draggedDate && previewDate && previewDate !== draggedDate.oldDate ? (
        <p
          className="mb-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
          role="status"
        >
          {draggedDate.label} for {draggedDate.workTitle}:{" "}
          {formatAccountDate(draggedDate.oldDate, preferences)} →{" "}
          {formatAccountDate(previewDate, preferences)}
        </p>
      ) : null}
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
            DATE_KINDS.flatMap(({ field, label }) =>
              work[field] === day ? [{ dateField: field, label, work }] : [],
            ),
          );
          const ranges =
            view === "Day"
              ? []
              : scopedSpans
                  .filter(({ start, end }) => start <= day && day <= end)
                  .map(({ work }) => work);
          return (
            <CalendarDaySection
              day={day}
              disabled={disabled}
              formattingPreferences={preferences}
              key={day}
              marks={marks}
              onDateChange={onDateChange}
              projectNames={projectNames}
              ranges={ranges}
              selectedProjectId={selectedProjectId}
            />
          );
        })}
      </section>
    </DndContext>
  );
}
