import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import type { WorkTemplateCustomFieldValue } from "@cantiara/api/work-templates";
import { describe, expect, test } from "vitest";

import { liveCustomFieldDefaults } from "../work-template-draft";

const field: CustomFieldDefinition = {
  createdAt: "2026-09-20T09:00:00.000Z",
  id: "field-1",
  name: "Release readiness",
  options: ["Ready", "Later"],
  projectId: "project-1",
  recordTypes: ["Work"],
  revision: 1,
  trashedAt: null,
  type: "Single select",
  updatedAt: "2026-09-20T09:00:00.000Z",
};

describe("Work Template draft", () => {
  test("drops defaults whose Custom field definitions are no longer live", () => {
    const trashedField: CustomFieldDefinition = {
      ...field,
      id: "field-trashed",
      trashedAt: "2026-09-21T09:00:00.000Z",
    };
    const defaults: Record<string, WorkTemplateCustomFieldValue> = {
      "field-1": { kind: "option", option: "Ready" },
      "field-trashed": { kind: "text", text: "Stale default" },
    };

    expect(liveCustomFieldDefaults(defaults, [field, trashedField])).toEqual([
      { definitionId: "field-1", value: { kind: "option", option: "Ready" } },
      {
        definitionId: "field-trashed",
        value: { kind: "text", text: "Stale default" },
      },
    ]);
    expect(liveCustomFieldDefaults(defaults, [field])).toEqual([
      { definitionId: "field-1", value: { kind: "option", option: "Ready" } },
    ]);
    expect(liveCustomFieldDefaults({}, [field])).toEqual([]);
  });
});
