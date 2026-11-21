import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { WorkDateField } from "@cantiara/api/work-lifecycle";
import { Accessibility, type DragDropManagerInput } from "@dnd-kit/dom";
import {
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  type useDragOperation,
} from "@dnd-kit/react";
import { addDays, format, parseISO } from "date-fns";
import { formatAccountDate } from "@/features/account-preferences/lib/account-preferences-format";
import { pointerDragSensor } from "@/lib/sortable-order";

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

export interface CalendarDateDrag {
  baseRevision: number;
  dateField: WorkDateField;
  label: (typeof CALENDAR_DATE_KINDS)[number]["label"];
  oldDate: string;
  workId: string;
  workTitle: string;
}

type CalendarDragOperation = ReturnType<typeof useDragOperation>;

export function calendarDateFromSource(
  source: CalendarDragOperation["source"],
) {
  const value = source?.data.calendarDate;
  return typeof value === "object" && value !== null
    ? (value as CalendarDateDrag)
    : null;
}

export function calendarDateFromTarget(
  target: CalendarDragOperation["target"],
) {
  const date = target?.data.date;
  return typeof date === "string" && CALENDAR_DATE_PATTERN.test(date)
    ? date
    : null;
}

const CALENDAR_KEYBOARD_DAY_OFFSETS = {
  left: -1,
  right: 1,
  up: -7,
  down: 7,
};

class CalendarKeyboardSensor extends KeyboardSensor {
  protected override handleMove(
    direction: keyof typeof CALENDAR_KEYBOARD_DAY_OFFSETS,
    event: KeyboardEvent,
  ) {
    event.preventDefault();
    const { actions, dragOperation, registry } = this.manager;
    const date =
      calendarDateFromTarget(dragOperation.target) ??
      calendarDateFromSource(dragOperation.source)?.oldDate;
    if (!date) {
      return;
    }
    const nextDate = format(
      addDays(parseISO(date), CALENDAR_KEYBOARD_DAY_OFFSETS[direction]),
      "yyyy-MM-dd",
    );
    const target = registry.droppables.get(`calendar-day:${nextDate}`);
    if (!target?.element) {
      return;
    }
    const { left, top, width, height } = target.element.getBoundingClientRect();
    actions.move({ event, to: { x: left + width / 2, y: top + height / 2 } });
    actions.setDropTarget(target.id).catch(() => undefined);
  }
}

export const calendarDragSensors = [pointerDragSensor, CalendarKeyboardSensor];

export function calendarDragPlugins(
  preferences: AccountPreferences,
): DragDropManagerInput["plugins"] {
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

  return (defaults) => [
    ...defaults.filter((plugin) => plugin !== Accessibility),
    Accessibility.configure({
      announcements: {
        dragstart: ({ operation }: DragStartEvent) =>
          announceDate(calendarDateFromSource(operation.source)),
        dragover: ({ operation }: DragOverEvent) =>
          announceDate(
            calendarDateFromSource(operation.source),
            calendarDateFromTarget(operation.target),
          ),
        dragend: ({ canceled, operation }: DragEndEvent) =>
          canceled
            ? `${announceDate(calendarDateFromSource(operation.source))} Cancelled.`
            : announceDate(
                calendarDateFromSource(operation.source),
                calendarDateFromTarget(operation.target),
              ),
      },
      screenReaderInstructions: {
        draggable:
          "Press Space to pick up this date. Use the arrow keys to preview another day. Press Space to drop or Escape to cancel.",
      },
    }),
  ];
}
