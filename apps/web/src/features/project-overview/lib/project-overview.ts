import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type {
  ProjectOverviewModel,
  ProjectOverviewModule,
  ProjectOverviewSourceRecord,
} from "@cantiara/api/project-overview";

export type OverviewFormattingPreferences = AccountPreferences;

export const DEFAULT_OVERVIEW_FORMATTING_PREFERENCES =
  DEFAULT_ACCOUNT_PREFERENCES satisfies OverviewFormattingPreferences;

export const EMPTY_SOURCE_MESSAGE = "No source records yet.";
export const OPEN_SOURCE_RECORD_LABEL = "Open source record";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeFormattingPreferences(
  preferences: OverviewFormattingPreferences,
): OverviewFormattingPreferences {
  return {
    ...preferences,
    locale:
      preferences.locale || DEFAULT_OVERVIEW_FORMATTING_PREFERENCES.locale,
    timeZone:
      preferences.timeZone || DEFAULT_OVERVIEW_FORMATTING_PREFERENCES.timeZone,
  };
}

export function moduleRecords(
  module: ProjectOverviewModule,
  overview: ProjectOverviewModel,
): readonly ProjectOverviewSourceRecord[] {
  if (module.name !== "Dates" || !overview.targetDate) {
    return module.records;
  }

  return [
    {
      id: "project-target-date",
      targetDate: overview.targetDate,
      title: "Target date",
      type: "Target date",
    },
    ...module.records,
  ];
}

export function emptyModuleMessage(moduleName: ProjectOverviewModule["name"]) {
  if (moduleName === "Work" || moduleName === "Documents") {
    return "No sample content was created.";
  }
  if (moduleName === "Goals") {
    return "No Project Goals recorded yet.";
  }
  if (moduleName === "Stages") {
    return "No active stages recorded yet.";
  }
  return EMPTY_SOURCE_MESSAGE;
}

export function formatOverviewDate(
  value: string,
  preferences: OverviewFormattingPreferences,
  formatDate: (
    value: string,
    preferences: OverviewFormattingPreferences,
  ) => string,
  formatDateTime: (
    value: string,
    preferences: OverviewFormattingPreferences,
  ) => string,
) {
  try {
    return DATE_ONLY_PATTERN.test(value)
      ? formatDate(value, preferences)
      : formatDateTime(value, preferences);
  } catch {
    try {
      return DATE_ONLY_PATTERN.test(value)
        ? formatDate(value, DEFAULT_OVERVIEW_FORMATTING_PREFERENCES)
        : formatDateTime(value, DEFAULT_OVERVIEW_FORMATTING_PREFERENCES);
    } catch {
      return value;
    }
  }
}

export function moduleAnchor(moduleName: string) {
  if (moduleName === "Work" || moduleName === "Documents") {
    return moduleName.toLowerCase();
  }
  return `project-overview-${slug(moduleName)}`;
}

export function slug(value: string) {
  return value.toLowerCase().replaceAll(" ", "-");
}
