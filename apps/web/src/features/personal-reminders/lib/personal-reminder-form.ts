import {
  PERSONAL_REMINDER_CONDITIONAL_SOURCE_TYPES,
  type PersonalReminderSourceType,
} from "@cantiara/api/personal-reminders";
import { addHours, format, startOfMinute } from "date-fns";

export function localDateTimeValue(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function defaultFireAt() {
  return localDateTimeValue(startOfMinute(addHours(new Date(), 1)));
}

export function supportsOpenCondition(
  sourceRecordType: PersonalReminderSourceType,
) {
  return PERSONAL_REMINDER_CONDITIONAL_SOURCE_TYPES.some(
    (conditionalType) => conditionalType === sourceRecordType,
  );
}
