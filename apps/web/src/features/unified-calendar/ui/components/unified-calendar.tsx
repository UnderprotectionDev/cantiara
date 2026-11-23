// biome-ignore-all lint/performance/noJsxPropsBind: Calendar controls close over the visible Work and date scope.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { WorkDateField, WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
import {
  createPopoverHandle,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import {
  VirtualList,
  type VirtualRowProps,
  virtualRowId,
} from "@cantiara/ui/components/virtual-list";
import { pointerIntersection } from "@dnd-kit/collision";
import {
  DragDropProvider,
  type DragEndEvent,
  useDraggable,
  useDragOperation,
  useDroppable,
} from "@dnd-kit/react";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, GripVertical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatAccountDate } from "@/features/account-preferences/lib/account-preferences-format";
import { OpenSourceRecordButton } from "@/features/record-discovery/ui/components/context-record-preview";
import {
  CALENDAR_DATE_KINDS,
  type CalendarDateDrag,
  type CalendarDateKind,
  calendarDateFromSource,
  calendarDateFromTarget,
  calendarDateKindsForSelection,
  calendarDragPlugins,
  calendarDragSensors,
} from "../../lib/calendar-date-drag";

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

interface CalendarDateDraft {
  nextDate: string;
  source: CalendarDateDrag;
  submitting: boolean;
}

function CalendarDateControl({
  dateField,
  disabled,
  label,
  onDatePreview,
  view,
  work,
}: {
  dateField: WorkDateField;
  disabled: boolean;
  label: CalendarDateDrag["label"];
  onDatePreview?: (date: CalendarDateDrag, nextDate: string) => void;
  view: CalendarView;
  work: CalendarWork;
}) {
  const [popoverHandle] = useState(createPopoverHandle);
  const dragData: CalendarDateDrag = {
    baseRevision: work.revision,
    dateField,
    label,
    oldDate: work[dateField] as string,
    workId: work.id,
    workTitle: work.title,
  };
  const { oldDate } = dragData;
  function handleDateSelect(date: Date | undefined) {
    if (!date) {
      return;
    }
    popoverHandle.close();
    const nextDate = format(date, "yyyy-MM-dd");
    if (nextDate !== oldDate) {
      onDatePreview?.(dragData, nextDate);
    }
  }
  const draggable = useDraggable({
    data: { calendarDate: dragData },
    disabled: disabled || !onDatePreview || view === "Day" || view === "Agenda",
    id: `calendar-date:${work.id}:${dateField}:${work.revision}`,
    type: "calendar-date",
  });

  if (view === "Day" || view === "Agenda") {
    return (
      <Popover handle={popoverHandle}>
        <PopoverTrigger
          disabled={disabled || !onDatePreview}
          render={
            <Button
              aria-label={`${label} for ${work.title}`}
              disabled={disabled || !onDatePreview}
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
      disabled={disabled || !onDatePreview}
      ref={draggable.ref}
      style={{ opacity: draggable.isDragging ? 0.45 : undefined }}
      type="button"
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
  projectNames,
  selectedProjectId,
  view,
  work,
  rowProps,
}: {
  dateField: WorkDateField;
  disabled: boolean;
  label: CalendarDateDrag["label"];
  onDatePreview?: (date: CalendarDateDrag, nextDate: string) => void;
  projectNames: ReadonlyMap<string, string>;
  selectedProjectId: string;
  view: CalendarView;
  work: CalendarWork;
  rowProps?: VirtualRowProps;
}) {
  return (
    <li
      {...rowProps}
      className="flex items-start gap-1"
      key={`${work.id}:${dateField}`}
    >
      <CalendarDateControl
        dateField={dateField}
        disabled={disabled}
        label={label}
        onDatePreview={onDatePreview}
        view={view}
        work={work}
      />
      <div className="min-w-0 flex-1 rounded border border-border/70 px-2 py-1 text-xs">
        <span className="block font-medium">{label}</span>
        <span>
          {work.key} · {work.title}
        </span>
        {selectedProjectId === "all" ? (
          <span className="block text-muted-foreground">
            {projectNames.get(work.projectId)}
          </span>
        ) : null}
        <OpenSourceRecordButton
          className="min-h-10 px-0 py-0 text-xs"
          target={{
            kind: "work",
            label: `${work.key} · ${work.title}`,
            projectId: work.projectId,
            workId: work.id,
          }}
        />
      </div>
    </li>
  );
}

function CalendarDaySection({
  day,
  disabled,
  formattingPreferences,
  onDatePreview,
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
  const { source } = useDragOperation();
  const draggedDate = calendarDateFromSource(source);
  const draggedMarkKey =
    draggedDate?.oldDate === day
      ? `${draggedDate.workId}:${draggedDate.dateField}`
      : undefined;
  const { isDropTarget, ref } = useDroppable({
    accept: "calendar-date",
    collisionDetector: pointerIntersection,
    data: { date: day },
    id: `calendar-day:${day}`,
  });
  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(formattingPreferences.locale, {
        timeZone: "UTC",
        weekday: "short",
      }),
    [formattingPreferences.locale],
  );
  const formattedDate = formatAccountDate(day, formattingPreferences);

  return (
    <section
      aria-label={formattedDate}
      className={`min-h-28 rounded-lg border bg-card/40 p-3 ${
        isDropTarget
          ? "border-primary ring-2 ring-primary/40"
          : "border-border/70"
      }`}
      data-calendar-day={day}
      ref={ref}
    >
      <h2 className="mb-2 border-b border-border/60 pb-2 text-sm font-medium">
        {weekdayFormatter.format(new Date(day))} {formattedDate}
      </h2>
      <VirtualList
        as="div"
        className="space-y-2"
        estimateSize={45}
        gap={8}
        getKey={virtualRowId}
        rows={ranges}
      >
        {(work, rowProps) => (
          <div
            className="rounded bg-primary/10 px-2 py-1 text-xs"
            {...rowProps}
          >
            <span className="font-medium">{work.key}</span> · {work.title}
            <span className="block text-muted-foreground">
              Planned start · Target date
            </span>
            <OpenSourceRecordButton
              className="min-h-10 px-0 py-0 text-xs"
              target={{
                kind: "work",
                label: `${work.key} · ${work.title}`,
                projectId: work.projectId,
                workId: work.id,
              }}
            />
          </div>
        )}
      </VirtualList>
      {marks.length > 0 ? (
        <VirtualList
          className="space-y-1.5"
          estimateSize={26}
          gap={4}
          getKey={({ dateField, work }) => `${work.id}:${dateField}`}
          keepMounted={draggedMarkKey ? [draggedMarkKey] : undefined}
          rows={marks}
        >
          {({ dateField, label, work }, rowProps) => (
            <CalendarDateMark
              dateField={dateField}
              disabled={disabled}
              label={label}
              onDatePreview={onDatePreview}
              projectNames={projectNames}
              rowProps={rowProps}
              selectedProjectId={selectedProjectId}
              view={view}
              work={work}
            />
          )}
        </VirtualList>
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
    (getDay(parseISO(firstVisibleDay)) -
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
  onDatePreview,
  preferences,
  projectNames,
  rows,
  selectedProjectId,
}: {
  disabled: boolean;
  onDatePreview?: (date: CalendarDateDrag, nextDate: string) => void;
  preferences: AccountPreferences;
  projectNames: ReadonlyMap<string, string>;
  rows: readonly CalendarAgendaRow[];
  selectedProjectId: string;
}) {
  return (
    <section aria-label="Agenda Calendar">
      {rows.length === 0 ? (
        <p className="mb-4 text-sm text-muted-foreground">
          No dated Work in this Calendar view.
        </p>
      ) : null}
      <VirtualList
        as="ol"
        className="divide-y divide-border/70"
        estimateSize={48}
        gap={8}
        getKey={(row) => `${row.work.id}:${row.field}`}
        rows={rows}
      >
        {({ date, field, label, work }, rowProps) => (
          <li
            className="grid gap-x-4 gap-y-1 py-2 sm:grid-cols-[minmax(8rem,auto)_minmax(9rem,auto)_minmax(0,1fr)_auto] sm:items-center"
            {...rowProps}
          >
            <div className="flex items-center gap-1">
              <time className="text-sm text-muted-foreground" dateTime={date}>
                {formatAccountDate(date, preferences)}
              </time>
              <CalendarDateControl
                dateField={field}
                disabled={disabled}
                label={label}
                onDatePreview={onDatePreview}
                view="Agenda"
                work={work}
              />
            </div>
            <span className="text-sm font-medium">{label}</span>
            <div className="min-w-0 text-sm">
              <span className="font-medium">{work.key}</span> · {work.title}
              {selectedProjectId === "all" ? (
                <span className="block text-muted-foreground">
                  {projectNames.get(work.projectId)}
                </span>
              ) : null}
            </div>
            <OpenSourceRecordButton
              className="w-fit rounded text-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
              target={{
                kind: "work",
                label: `${work.key} · ${work.title}`,
                projectId: work.projectId,
                workId: work.id,
              }}
            />
          </li>
        )}
      </VirtualList>
    </section>
  );
}

function CalendarDatePreview({
  disabled,
  draft,
  onCancel,
  onConfirm,
  preferences,
}: {
  disabled: boolean;
  draft: CalendarDateDraft | null;
  onCancel: () => void;
  onConfirm: (draft: CalendarDateDraft) => void;
  preferences: AccountPreferences;
}) {
  const { source, target } = useDragOperation();
  const date = source ? calendarDateFromSource(source) : draft?.source;
  const nextDate = source ? calendarDateFromTarget(target) : draft?.nextDate;
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
      {!source && draft ? (
        <div className="mt-2 flex gap-2">
          <Button
            disabled={disabled || draft.submitting}
            onClick={() => onConfirm(draft)}
            size="sm"
            type="button"
          >
            Save
          </Button>
          <Button
            disabled={disabled || draft.submitting}
            onClick={onCancel}
            size="sm"
            type="button"
            variant="outline"
          >
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
  onDateChange?: (change: CalendarDateChange) => Promise<unknown> | undefined;
  preferences: AccountPreferences;
  projects: readonly { id: string; name: string }[];
  selectedDate: string;
  selectedDateKinds?: readonly CalendarDateKind[];
  selectedProjectId: string;
  view: CalendarView;
  works: readonly CalendarWork[];
}) {
  const draftStore = useCreateStore<CalendarDateDraft | null>(null);
  const draft = useSelector(draftStore);
  const dragPlugins = useMemo(
    () => calendarDragPlugins(preferences),
    [preferences],
  );
  useEffect(() => () => draftStore.setState(() => null), [draftStore]);
  const projectNames = new Map(projects.map(({ id, name }) => [id, name]));
  const scopedWorks = works.filter(
    (work) =>
      work.archivedAt === null &&
      (selectedProjectId === "all" || work.projectId === selectedProjectId),
  );
  const visibleKinds = calendarDateKindsForSelection(selectedDateKinds);
  function isCurrentSource(source: CalendarDateDrag) {
    return (
      visibleKinds.some(({ field }) => field === source.dateField) &&
      scopedWorks.some(
        (work) =>
          work.id === source.workId &&
          work.revision === source.baseRevision &&
          work[source.dateField] === source.oldDate,
      )
    );
  }
  const currentDraft = draft && isCurrentSource(draft.source) ? draft : null;
  useEffect(() => {
    if (draft && !currentDraft) {
      draftStore.setState((current) => (current === draft ? null : current));
    }
  }, [currentDraft, draft, draftStore]);

  function clearDraft() {
    draftStore.setState(() => null);
  }

  function previewDate(source: CalendarDateDrag, nextDate: string) {
    draftStore.setState(() => ({ source, nextDate, submitting: false }));
  }

  async function saveDate(submitted: CalendarDateDraft) {
    const { source, nextDate } = submitted;
    if (
      disabled ||
      !onDateChange ||
      !isCurrentSource(source) ||
      submitted.submitting ||
      draftStore.get() !== submitted
    ) {
      return;
    }
    const attempt = { ...submitted, submitting: true };
    draftStore.setState(() => attempt);
    try {
      await onDateChange({
        baseRevision: source.baseRevision,
        date: nextDate,
        dateField: source.dateField,
        workId: source.workId,
      });
      draftStore.setState((current) => (current === attempt ? null : current));
    } catch {
      // The write reports its error. Keep this proposal available for retry.
      draftStore.setState((current) =>
        current === attempt ? submitted : current,
      );
    }
  }

  async function handleDragEnd({ canceled, operation }: DragEndEvent) {
    const source = calendarDateFromSource(operation.source);
    const nextDate = calendarDateFromTarget(operation.target);
    if (canceled || !source || !nextDate || nextDate === source.oldDate) {
      clearDraft();
      return;
    }
    if (!isCurrentSource(source) || disabled || !onDateChange) {
      return;
    }
    const dropped = { source, nextDate, submitting: false };
    draftStore.setState(() => dropped);
    await saveDate(dropped);
  }

  const hasStartAndTargetKinds =
    selectedDateKinds.includes("plannedStartDate") &&
    selectedDateKinds.includes("targetDate");
  const days =
    view === "Agenda"
      ? []
      : visibleDays(selectedDate, view, preferences.firstDayOfWeek);
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

  return (
    <DragDropProvider
      onDragEnd={handleDragEnd}
      onDragStart={clearDraft}
      plugins={dragPlugins}
      sensors={calendarDragSensors}
    >
      <CalendarDatePreview
        disabled={disabled}
        draft={currentDraft}
        onCancel={clearDraft}
        onConfirm={saveDate}
        preferences={preferences}
      />
      {view === "Agenda" ? (
        <CalendarAgenda
          disabled={disabled}
          onDatePreview={onDateChange ? previewDate : undefined}
          preferences={preferences}
          projectNames={projectNames}
          rows={calendarAgendaRows(
            scopedWorks,
            visibleKinds,
            selectedDate,
            preferences.firstDayOfWeek,
          )}
          selectedProjectId={selectedProjectId}
        />
      ) : (
        <>
          {hasVisibleDatedWork ? null : (
            <p className="mb-4 text-sm text-muted-foreground">
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
                  onDatePreview={onDateChange ? previewDate : undefined}
                  projectNames={projectNames}
                  ranges={ranges}
                  selectedProjectId={selectedProjectId}
                  view={view}
                />
              );
            })}
          </section>
        </>
      )}
    </DragDropProvider>
  );
}
