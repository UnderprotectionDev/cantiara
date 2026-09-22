import type { WorkChecklistItem } from "@cantiara/api/work-lifecycle";
import { describe, expect, test } from "vitest";

import { resolveChecklistDrafts } from "./work-checklist-items";

describe("resolveChecklistDrafts", () => {
  const checklist: WorkChecklistItem[] = [
    { completed: false, id: "item-1", text: "First step" },
    { completed: true, id: "item-2", text: "Second step" },
  ];

  test("applies a non-empty draft as the saved item text", () => {
    expect(
      resolveChecklistDrafts(checklist, {
        "item-1": "  Edited first step  ",
      }),
    ).toEqual([
      { completed: false, id: "item-1", text: "Edited first step" },
      { completed: true, id: "item-2", text: "Second step" },
    ]);
  });

  test("keeps the saved text when a draft is missing or only whitespace", () => {
    expect(
      resolveChecklistDrafts(checklist, {
        "item-1": "   ",
        "item-2": "",
      }),
    ).toEqual(checklist);
  });

  test("keeps the saved list untouched when no drafts exist", () => {
    expect(resolveChecklistDrafts(checklist, {})).toEqual(checklist);
  });
});
