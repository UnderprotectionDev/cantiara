import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import type { WorkDraftCustomFieldValue } from "@cantiara/api/work-drafts";
import { describe, expect, test } from "vitest";

import {
  activeDraftCustomFieldValues,
  customFieldValueMatchesDefinition,
  formatDraftCustomFieldDate,
  parseDraftNumberText,
} from "./draft-custom-fields";

function definition(
  overrides: Partial<CustomFieldDefinition> = {},
): CustomFieldDefinition {
  return {
    createdAt: "2026-09-19T09:00:00.000Z",
    id: "field-1",
    name: "Release readiness",
    options: [],
    projectId: "project-1",
    recordTypes: ["Work"],
    revision: 0,
    trashedAt: null,
    type: "Boolean",
    updatedAt: "2026-09-19T09:00:00.000Z",
    ...overrides,
  };
}

const preferences: AccountPreferences = {
  appearance: "Dark",
  dateFormat: "locale",
  firstDayOfWeek: "Monday",
  locale: "en-GB",
  timeZone: "Europe/Istanbul",
};
const localeDateDayPattern = /20/;
const localeDateYearPattern = /2026/;

describe("customFieldValueMatchesDefinition", () => {
  test("accepts a payload whose kind matches the definition type", () => {
    expect(
      customFieldValueMatchesDefinition(definition(), {
        boolean: true,
        kind: "boolean",
      }),
    ).toBe(true);
    expect(
      customFieldValueMatchesDefinition(definition({ type: "Text" }), {
        kind: "text",
        text: "Paid",
      }),
    ).toBe(true);
  });

  test("rejects a payload whose kind does not match the definition type", () => {
    expect(
      customFieldValueMatchesDefinition(definition({ type: "Text" }), {
        boolean: true,
        kind: "boolean",
      }),
    ).toBe(false);
  });

  test("accepts select payloads whose options still exist", () => {
    expect(
      customFieldValueMatchesDefinition(
        definition({ options: ["Ready"], type: "Single select" }),
        { kind: "option", option: "Ready" },
      ),
    ).toBe(true);
    expect(
      customFieldValueMatchesDefinition(
        definition({ options: ["Ready", "Blocked"], type: "Multi select" }),
        { kind: "options", options: ["Ready", "Blocked"] },
      ),
    ).toBe(true);
  });

  test("rejects select payloads that use a removed option", () => {
    expect(
      customFieldValueMatchesDefinition(
        definition({ options: ["Ready"], type: "Single select" }),
        { kind: "option", option: "Blocked" },
      ),
    ).toBe(false);
    expect(
      customFieldValueMatchesDefinition(
        definition({ options: ["Ready"], type: "Multi select" }),
        { kind: "options", options: ["Ready", "Blocked"] },
      ),
    ).toBe(false);
  });
});

describe("activeDraftCustomFieldValues", () => {
  test("keeps values backed by an active Work definition", () => {
    const values: WorkDraftCustomFieldValue[] = [
      { definitionId: "field-1", payload: { boolean: true, kind: "boolean" } },
    ];
    expect(activeDraftCustomFieldValues(values, [definition()])).toEqual(
      values,
    );
  });

  test("drops values whose definition is gone, trashed, or unbound from Work", () => {
    const values: WorkDraftCustomFieldValue[] = [
      { definitionId: "field-1", payload: { boolean: true, kind: "boolean" } },
      { definitionId: "field-2", payload: { boolean: false, kind: "boolean" } },
    ];
    // The caller renders only active Work definitions: field-2 was trashed or
    // unbound, so it is absent from the list and its value must be dropped.
    expect(activeDraftCustomFieldValues(values, [definition()])).toEqual([
      { definitionId: "field-1", payload: { boolean: true, kind: "boolean" } },
    ]);
    expect(activeDraftCustomFieldValues(values, [])).toEqual([]);
  });

  test("drops values whose payload no longer matches the definition", () => {
    const values: WorkDraftCustomFieldValue[] = [
      {
        definitionId: "field-select",
        payload: { kind: "option", option: "Blocked" },
      },
    ];
    expect(
      activeDraftCustomFieldValues(values, [
        definition({
          id: "field-select",
          options: ["Ready"],
          type: "Single select",
        }),
      ]),
    ).toEqual([]);
  });
});

describe("parseDraftNumberText", () => {
  test("treats blank text as an empty value", () => {
    expect(parseDraftNumberText("")).toBe("empty");
    expect(parseDraftNumberText("  ")).toBe("empty");
  });

  test("keeps in-progress input invalid instead of a number", () => {
    expect(parseDraftNumberText("-")).toBe("invalid");
    expect(parseDraftNumberText("0e")).toBe("invalid");
  });

  test("parses partial decimal and negative text without reformatting", () => {
    expect(parseDraftNumberText("0.")).toBe(0);
    expect(parseDraftNumberText("1.5")).toBe(1.5);
    expect(parseDraftNumberText("-5")).toBe(-5);
    expect(parseDraftNumberText(" 12 ")).toBe(12);
  });
});

describe("formatDraftCustomFieldDate", () => {
  test("follows the fixed Date format preferences without shifting the day", () => {
    expect(
      formatDraftCustomFieldDate("2026-09-20", {
        ...preferences,
        dateFormat: "dd/MM/yyyy",
      }),
    ).toBe("20/09/2026");
    expect(
      formatDraftCustomFieldDate("2026-09-20", {
        ...preferences,
        dateFormat: "MM/dd/yyyy",
      }),
    ).toBe("09/20/2026");
    expect(
      formatDraftCustomFieldDate("2026-09-20", {
        ...preferences,
        dateFormat: "yyyy-MM-dd",
      }),
    ).toBe("2026-09-20");
  });

  test("uses the account Locale for the locale default format", () => {
    const formatted = formatDraftCustomFieldDate("2026-09-20", preferences);
    expect(formatted).toMatch(localeDateDayPattern);
    expect(formatted).toMatch(localeDateYearPattern);
  });

  test("returns an unparseable value as-is", () => {
    expect(formatDraftCustomFieldDate("not-a-date", preferences)).toBe(
      "not-a-date",
    );
  });
});
