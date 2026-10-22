// biome-ignore-all lint/performance/noJsxPropsBind: Picker state and field handlers close over the current value.
import { Button } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
import { Input } from "@cantiara/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { format, isValid, parse } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

const DATE_FORMAT = "yyyy-MM-dd";
const DEFAULT_TIME = "00:00";

function parseDateValue(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = parse(value, DATE_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

interface DatePickerProps {
  "aria-describedby"?: string;
  /** Accessible name of the trigger button. */
  ariaLabel: string;
  className?: string;
  /** Text of the clear action; defaults to `Clear <ariaLabel>`. */
  clearLabel?: string;
  disabled?: boolean;
  id?: string;
  /** Earliest selectable date as `yyyy-MM-dd`. */
  min?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** A required picker has no clear action. */
  required?: boolean;
  /** `yyyy-MM-dd`, or an empty string when unset. */
  value: string;
}

/** Date-only picker: DayPicker in a popover, value as `yyyy-MM-dd`. */
function DatePicker({
  "aria-describedby": ariaDescribedBy,
  ariaLabel,
  className,
  clearLabel,
  disabled,
  id,
  min,
  onChange,
  placeholder = "Select a date",
  required,
  value,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const minDate = min ? parseDateValue(min) : undefined;
  const triggerText = selected ? format(selected, "PP") : placeholder;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-describedby={ariaDescribedBy}
            aria-label={ariaLabel}
            className={className ?? "w-full justify-between font-normal"}
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
          />
        }
      >
        {triggerText}
        <CalendarDays aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-72">
        <Calendar
          defaultMonth={selected}
          disabled={minDate ? { before: minDate } : undefined}
          mode="single"
          onSelect={(date: Date | undefined) => {
            // Re-picking the selected day keeps it (like a native date field);
            // clearing is the explicit Clear action.
            onChange(date ? format(date, DATE_FORMAT) : value);
            setOpen(false);
          }}
          selected={selected}
        />
        {value && !required ? (
          <Button
            className="w-full"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            size="xs"
            type="button"
            variant="ghost"
          >
            {clearLabel ?? `Clear ${ariaLabel.toLowerCase()}`}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface DateTimePickerProps {
  "aria-describedby"?: string;
  /** Base accessible name; the controls are named `<ariaLabel> date` and `<ariaLabel> time`. */
  ariaLabel: string;
  disabled?: boolean;
  id?: string;
  /** Earliest selectable date-time as `yyyy-MM-ddTHH:mm`. */
  min?: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** `yyyy-MM-ddTHH:mm` in local time, or an empty string when unset. */
  value: string;
}

function splitDateTime(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export interface DateTimeDateChange {
  /** Retained typed time for the next render. */
  draftTime: string;
  /** Full picker value to send to the field. */
  value: string;
}

/**
 * How the DateTimePicker combines a picked or cleared date with the already
 * typed time: picking (or re-picking) a date keeps the typed or selected time
 * and ends at midnight when neither exists; clearing the date clears the time
 * too, so nothing silently survives a Clear action.
 */
export function onDateTimeDateChange(
  value: string,
  nextDate: string,
  typedTime: string,
): DateTimeDateChange {
  if (!nextDate) {
    return { draftTime: "", value: "" };
  }
  const time = splitDateTime(value).time || typedTime || DEFAULT_TIME;
  return { draftTime: typedTime, value: `${nextDate}T${time}` };
}

/** Date-time picker: shared DatePicker plus a time input, value as `yyyy-MM-ddTHH:mm`. */
function DateTimePicker({
  "aria-describedby": ariaDescribedBy,
  ariaLabel,
  disabled,
  id,
  min,
  onChange,
  required,
  value,
}: DateTimePickerProps) {
  const { date, time } = splitDateTime(value);
  const [draftTime, setDraftTime] = useState("");
  const shownTime = time || draftTime || (date ? DEFAULT_TIME : "");

  return (
    <div className="flex flex-wrap gap-2">
      <DatePicker
        aria-describedby={ariaDescribedBy}
        ariaLabel={`${ariaLabel} date`}
        className="min-w-40 flex-1 justify-between font-normal"
        clearLabel={`Clear ${ariaLabel.toLowerCase()}`}
        disabled={disabled}
        id={id}
        min={min ? splitDateTime(min).date : undefined}
        onChange={(nextDate) => {
          const change = onDateTimeDateChange(value, nextDate, draftTime);
          setDraftTime(change.draftTime);
          onChange(change.value);
        }}
        required={required}
        value={date}
      />
      <Input
        aria-describedby={ariaDescribedBy}
        aria-label={`${ariaLabel} time`}
        className="w-32"
        disabled={disabled}
        onChange={(event) => {
          const nextTime = event.target.value;
          setDraftTime(nextTime);
          if (date) {
            onChange(`${date}T${nextTime || DEFAULT_TIME}`);
          }
        }}
        type="time"
        value={shownTime}
      />
    </div>
  );
}

export { DatePicker, DateTimePicker };
