import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  CustomFieldDefinition,
  ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import type { WorkDraftCustomFieldValue } from "@cantiara/api/work-drafts";

/**
 * True when a definition still accepts a stored Custom field value: the
 * payload kind must match the type and select options must still exist
 * (10 keeps inactive definitions and removed options off record surfaces).
 */
export function customFieldValueMatchesDefinition(
  definition: Pick<CustomFieldDefinition, "options" | "type">,
  payload: ParsedCustomFieldValuePayload,
): boolean {
  switch (payload.kind) {
    case "boolean":
      return definition.type === "Boolean";
    case "date":
      return definition.type === "Date";
    case "number":
      return definition.type === "Number";
    case "option":
      return (
        definition.type === "Single select" &&
        definition.options.includes(payload.option)
      );
    case "options":
      return (
        definition.type === "Multi select" &&
        payload.options.every((option) => definition.options.includes(option))
      );
    case "text":
      return definition.type === "Text";
    default:
      return false;
  }
}

/**
 * Draft Custom field values are form state only (11). Entries whose
 * definition is absent from the active Work list (gone, configuration
 * trashed, or unbound from Work) or whose payload no longer matches are
 * dropped, so a stale value can never wedge `Create` behind a failed
 * finalize.
 */
export function activeDraftCustomFieldValues(
  values: readonly WorkDraftCustomFieldValue[],
  definitions: readonly CustomFieldDefinition[],
): WorkDraftCustomFieldValue[] {
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  return values.filter((value) => {
    const definition = definitionsById.get(value.definitionId);
    return definition
      ? customFieldValueMatchesDefinition(definition, value.payload)
      : false;
  });
}

export type DraftNumberText = "empty" | "invalid" | number;

/**
 * Interprets raw Number field text without reformatting it: "empty" clears
 * the value, "invalid" keeps in-progress input such as "-", and a number is
 * returned as-is so decimal typing survives the controlled round-trip.
 */
export function parseDraftNumberText(text: string): DraftNumberText {
  const trimmed = text.trim();
  if (trimmed === "") {
    return "empty";
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : "invalid";
}

/**
 * Renders a calendar date (YYYY-MM-DD) with the account's Date format and
 * Locale. The date is pinned to UTC so formatting never shifts the calendar
 * day (10: Date values are never rewritten into zoned instants).
 */
export function formatDraftCustomFieldDate(
  value: string,
  preferences: Pick<AccountPreferences, "dateFormat" | "locale">,
): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  if (preferences.dateFormat === "locale") {
    return new Intl.DateTimeFormat(preferences.locale, {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
      year: "numeric",
    }).format(date);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric",
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return preferences.dateFormat
    .replace("dd", byType.get("day") ?? "")
    .replace("MM", byType.get("month") ?? "")
    .replace("yyyy", byType.get("year") ?? "");
}
