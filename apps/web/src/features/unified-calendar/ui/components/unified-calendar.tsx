import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { WorkDateField, WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
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
import { CalendarDays, GripVertical } from "lucide-react";
import { useCallback, useState } from "react";
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

export const CALENDAR_DATE_KINDS = [
  { field: "plannedStartDate", label: "Planned start" },
  { field: "targetDate", label: "Target date" },
  { field: "reappearDate", label: "Reappear date" },
] as const satisfies readonly { field: WorkDateField; label: string }[];
export type CalendarDateKind = (typeof CALENDAR_DATE_KINDS)[number]["field"];

export function calendarDateKindsForSelection(selected: Iterable<string>) {
  const selectedFields = new Set(selected);
  return CALENDAR_DATE_KINDS.filter(({ field }) => selectedFields.has(field));
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CalendarDateDrag {
  baseRevision: number;
  dateField: WorkDateField;
  label: (typeof CALENDAR_DATE_KINDS)[number]["label"];
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

function calendarDateChangeFromDragEnd(
  event: DragEndEvent,
): CalendarDateChange | null {
  const date = calendarDateFromOver(event.over);
  const dateChange = calendarDateFromActive(event.active);
  if (!(date && dateChange && date !== dateChange.oldDate)) {
    return null;
  }
  return {
    baseRevision: dateChange.baseRevision,
    date,
    dateField: dateChange.dateField,
    workId: dateChange.workId,
  };
}

function CalendarDateControl({
  dateField,
  disabled,
  label,
  onDatePreview,
  onDateChange,
  view,
  work,
}: {
  dateField: WorkDateField;
  disabled: boolean;
  label: CalendarDateDrag["label"];
  onDatePreview?: (date: CalendarDateDrag, nextDate: string) => void;
  onDateChange?: (change: CalendarDateChange) => void;
  view: CalendarView;
  work: CalendarWork;
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const dragData: CalendarDateDrag = {
    baseRevision: work.revision,
    dateField,
    label,
    oldDate: work[dateField] as string,
    workId: work.id,
    workTitle: work.title,
  };
  const { oldDate } = dragData;
  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) {
        return;
      }
      const nextDate = format(date, "yyyy-MM-dd");
      if (nextDate === oldDate) {
        setDatePickerOpen(false);
        return;
      }
      setDatePickerOpen(false);
      onDatePreview?.(
        {
          baseRevision: work.revision,
          dateField,
          label,
          oldDate,
          workId: work.id,
          workTitle: work.title,
        },
        nextDate,
      );
    },
    [
      dateField,
      label,
      oldDate,
      onDatePreview,
      work.id,
      work.revision,
      work.title,
    ],
  );
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      data: { calendarDate: dragData },
      disabled:
        disabled || !onDateChange || view === "Day" || view === "Agenda",
      id: `calendar-date:${work.id}:${dateField}`,
    });

  if (view === "Day" || view === "Agenda") {
    return (
      <Popover onOpenChange={setDatePickerOpen} open={datePickerOpen}>
        <PopoverTrigger
          disabled={disabled || !onDateChange}
          render={
            <Button
              aria-label={`${label} for ${work.title}`}
              disabled={disabled || !onDateChange}
              size="icon"
              type="button"
              variant="outline"
            />
          }
        >
          <CalendarDays aria-hidden="true" className="size-4" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            defaultMonth={parseISO(oldDate)}
            mode="single"
            onSelect={handleDateSelect}
            selected={parseISO(oldDate)}
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
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
  );
}

function CalendarDateMark({
  dateField,
  disabled,
  label,
  onDatePreview,
  onDateChange,
  projectNames,
  selectedProjectId,
  view,
  work,
}: {
  dateField: WorkDateField;
  disabled: boolean;
  label: CalendarDateDrag["label"];
  onDatePreview?: (date: CalendarDateDrag, nextDate: string) => void;
  onDateChange?: (change: CalendarDateChange) => void;
  projectNames: ReadonlyMap<string, string>;
  selectedProjectId: string;
  view: CalendarView;
  work: CalendarWork;
}) {
  return (
    <li className="flex items-start gap-1" key={`${work.id}:${dateField}`}>
      <CalendarDateControl
        dateField={dateField}
        disabled={disabled}
        label={label}
        onDateChange={onDateChange}
        onDatePreview={onDatePreview}
        view={view}
        work={work}
      />
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
  onDatePreview,
  onDateChange,
  projectNames,
  ranges,
  selectedProjectId,
  marks,
  view,
}: {
  day: string;
  disabled: boolean;
  formattingPreferences: AccountPreferences;
  onDatePreview?: (date: CalendarDateDrag, nextDate: string) => void;
  onDateChange?: (change: CalendarDateChange) => void;
  projectNames: ReadonlyMap<string, string>;
  ranges: readonly CalendarWork[];
  selectedProjectId: string;
  marks: readonly {
    dateField: WorkDateField;
    label: CalendarDateDrag["label"];
    work: CalendarWork;
  }[];
  view: CalendarView;
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
              onDatePreview={onDatePreview}
              projectNames={projectNames}
              selectedProjectId={selectedProjectId}
              view={view}
              work={work}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

interface CalendarAgendaRow {
  date: string;
  field: CalendarDateKind;
  label: (typeof CALENDAR_DATE_KINDS)[number]["label"];
  work: CalendarWork;
}

function calendarAgendaRows(
  works: readonly CalendarWork[],
  visibleKinds: ReturnType<typeof calendarDateKindsForSelection>,
  selectedDate: string,
  firstDayOfWeek: AccountPreferences["firstDayOfWeek"],
): CalendarAgendaRow[] {
  const monthDays = visibleDays(selectedDate, "Month", firstDayOfWeek);
  const firstAgendaDay = monthDays[0] ?? selectedDate;
  const lastAgendaDay = monthDays.at(-1) ?? selectedDate;
  return works
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
          CALENDAR_DATE_KINDS.findIndex(({ field }) => field === right.field) ||
        left.work.key.localeCompare(right.work.key),
    );
}

function calendarMarksForDay(
  works: readonly CalendarWork[],
  visibleKinds: ReturnType<typeof calendarDateKindsForSelection>,
  day: string,
) {
  return works.flatMap((work) =>
    visibleKinds.flatMap(({ field, label }) =>
      work[field] === day ? [{ dateField: field, label, work }] : [],
    ),
  );
}

interface CalendarWorkSpan {
  end: string;
  start: string;
  work: CalendarWork;
}

function calendarMonthLeadingDayCount(
  view: CalendarView,
  firstVisibleDay: string,
  firstDayOfWeek: AccountPreferences["firstDayOfWeek"],
) {
  if (view !== "Month") {
    return 0;
  }
  return (
    (parseISO(firstVisibleDay).getDay() -
      (firstDayOfWeek === "Sunday" ? 0 : 1) +
      7) %
    7
  );
}

function calendarHasVisibleWork(
  works: readonly CalendarWork[],
  visibleKinds: ReturnType<typeof calendarDateKindsForSelection>,
  days: readonly string[],
  spans: readonly CalendarWorkSpan[],
  view: CalendarView,
  hasStartAndTargetKinds: boolean,
  firstVisibleDay: string,
  lastVisibleDay: string,
) {
  const hasVisibleDate = works.some((work) =>
    visibleKinds.some(({ field }) => work[field] && days.includes(work[field])),
  );
  const hasVisibleRange =
    view !== "Day" &&
    hasStartAndTargetKinds &&
    spans.some(
      ({ start, end }) => start <= lastVisibleDay && firstVisibleDay <= end,
    );
  return hasVisibleDate || hasVisibleRange;
}

function calendarRangesForDay(
  spans: readonly CalendarWorkSpan[],
  day: string,
  view: CalendarView,
  hasStartAndTargetKinds: boolean,
) {
  if (view === "Day" || !hasStartAndTargetKinds) {
    return [];
  }
  return spans
    .filter(({ start, end }) => start <= day && day <= end)
    .map(({ work }) => work);
}

function CalendarAgenda({
  disabled,
  onDateChange,
  onDatePreview,
  preferences,
  projectNames,
  rows,
  selectedProjectId,
}: {
  disabled: boolean;
  onDateChange?: (change: CalendarDateChange) => void;
  onDatePreview: (date: CalendarDateDrag, nextDate: string) => void;
  preferences: AccountPreferences;
  projectNames: ReadonlyMap<string, string>;
  rows: readonly CalendarAgendaRow[];
  selectedProjectId: string;
}) {
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
            <div className="flex items-center gap-1">
              <time className="text-muted-foreground text-sm" dateTime={date}>
                {formatAccountDate(date, preferences)}
              </time>
              <CalendarDateControl
                dateField={field}
                disabled={disabled}
                label={label}
                onDateChange={onDateChange}
                onDatePreview={onDatePreview}
                view="Agenda"
                work={work}
              />
            </div>
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

function CalendarDatePreview({
  date,
  nextDate,
  onCancel,
  onConfirm,
  preferences,
  requiresConfirmation,
}: {
  date: CalendarDateDrag | null;
  nextDate: string | null;
  onCancel: () => void;
  onConfirm: () => void;
  preferences: AccountPreferences;
  requiresConfirmation: boolean;
}) {
  if (!(date && nextDate && nextDate !== date.oldDate)) {
    return null;
  }
  return (
    <div className="mb-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
      <p role="status">
        {date.label} for {date.workTitle}:{" "}
        {formatAccountDate(date.oldDate, preferences)} →{" "}
        {formatAccountDate(nextDate, preferences)}
      </p>
      {requiresConfirmation ? (
        <div className="mt-2 flex gap-2">
          <Button onClick={onConfirm} size="sm" type="button">
            Save
          </Button>
          <Button onClick={onCancel} size="sm" type="button" variant="outline">
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function UnifiedCalendar({
  disabled = false,
  onDateChange,
  preferences,
  projects,
  selectedDate,
  selectedDateKinds = CALENDAR_DATE_KINDS.map(({ field }) => field),
  selectedProjectId,
  view,
  works,
}: {
  disabled?: boolean;
  onDateChange?: (change: CalendarDateChange) => void;
  preferences: AccountPreferences;
  projects: readonly { id: string; name: string }[];
  selectedDate: string;
  selectedDateKinds?: readonly CalendarDateKind[];
  selectedProjectId: string;
  view: CalendarView;
  works: readonly CalendarWork[];
}) {
  const [draggedDate, setDraggedDate] = useState<CalendarDateDrag | null>(null);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [previewRequiresConfirmation, setPreviewRequiresConfirmation] =
    useState(false);
  const cancelDrag = useCallback(() => {
    setDraggedDate(null);
    setPreviewDate(null);
    setPreviewRequiresConfirmation(false);
  }, []);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const change = calendarDateChangeFromDragEnd(event);
      cancelDrag();
      if (change) {
        onDateChange?.(change);
      }
    },
    [cancelDrag, onDateChange],
  );
  const handleDatePreview = useCallback(
    (dateChange: CalendarDateDrag, nextDate: string) => {
      setDraggedDate(dateChange);
      setPreviewDate(nextDate);
      setPreviewRequiresConfirmation(true);
    },
    [],
  );
  const handleDragOver = useCallback(({ over }: DragOverEvent) => {
    setPreviewDate(calendarDateFromOver(over));
  }, []);
  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setDraggedDate(calendarDateFromActive(active));
    setPreviewDate(null);
    setPreviewRequiresConfirmation(false);
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
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
  const agendaRows = calendarAgendaRows(
    scopedWorks,
    visibleKinds,
    selectedDate,
    preferences.firstDayOfWeek,
  );

  if (view === "Agenda") {
    return (
      <DndContext
        collisionDetection={calendarCollisionDetection}
        onDragCancel={cancelDrag}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <CalendarDatePreview
          date={draggedDate}
          nextDate={previewDate}
          onCancel={cancelDrag}
          onConfirm={confirmDatePreview}
          preferences={preferences}
          requiresConfirmation={previewRequiresConfirmation}
        />
        <CalendarAgenda
          disabled={disabled}
          onDateChange={onDateChange}
          onDatePreview={handleDatePreview}
          preferences={preferences}
          projectNames={projectNames}
          rows={agendaRows}
          selectedProjectId={selectedProjectId}
        />
      </DndContext>
    );
  }
  const days = visibleDays(selectedDate, view, preferences.firstDayOfWeek);
  const firstVisibleDay = days[0] ?? selectedDate;
  const lastVisibleDay = days.at(-1) ?? selectedDate;
  const monthLeadingDays = calendarMonthLeadingDayCount(
    view,
    firstVisibleDay,
    preferences.firstDayOfWeek,
  );
  const scopedSpans: CalendarWorkSpan[] = scopedWorks.flatMap((work) => {
    const span = dateSpan(work);
    return span ? [{ work, ...span }] : [];
  });
  const hasVisibleDatedWork = calendarHasVisibleWork(
    scopedWorks,
    visibleKinds,
    days,
    scopedSpans,
    view,
    hasStartAndTargetKinds,
    firstVisibleDay,
    lastVisibleDay,
  );

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

  function confirmDatePreview() {
    if (!(draggedDate && previewDate && previewDate !== draggedDate.oldDate)) {
      cancelDrag();
      return;
    }
    onDateChange?.({
      baseRevision: draggedDate.baseRevision,
      date: previewDate,
      dateField: draggedDate.dateField,
      workId: draggedDate.workId,
    });
    cancelDrag();
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
      <CalendarDatePreview
        date={draggedDate}
        nextDate={previewDate}
        onCancel={cancelDrag}
        onConfirm={confirmDatePreview}
        preferences={preferences}
        requiresConfirmation={previewRequiresConfirmation}
      />
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
          const marks = calendarMarksForDay(scopedWorks, visibleKinds, day);
          const ranges = calendarRangesForDay(
            scopedSpans,
            day,
            view,
            hasStartAndTargetKinds,
          );
          return (
            <CalendarDaySection
              day={day}
              disabled={disabled}
              formattingPreferences={preferences}
              key={day}
              marks={marks}
              onDateChange={onDateChange}
              onDatePreview={handleDatePreview}
              projectNames={projectNames}
              ranges={ranges}
              selectedProjectId={selectedProjectId}
              view={view}
            />
          );
        })}
      </section>
    </DndContext>
  );
}
