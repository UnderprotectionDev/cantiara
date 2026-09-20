import type {
  CustomFieldDefinition,
  CustomFieldValueListItem,
} from "@cantiara/api/custom-fields";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";
import CustomFieldValuesForm from "./custom-field-values-form";

const timestamp = "2026-09-19T09:00:00.000Z";

function definition(
  overrides: Partial<CustomFieldDefinition> = {},
): CustomFieldDefinition {
  return {
    createdAt: timestamp,
    id: "field-1",
    name: "Audience",
    options: [],
    projectId: "project-1",
    recordTypes: ["Work"],
    revision: 0,
    trashedAt: null,
    type: "Text",
    updatedAt: timestamp,
    ...overrides,
  };
}

function renderFields({
  definitions,
  recordId,
  recordType,
  values,
}: {
  definitions: CustomFieldDefinition[];
  recordId?: string;
  recordType: "Feedback" | "Risk" | "Work";
  values?: CustomFieldValueListItem[];
}) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    orpc.customFields.queryOptions({ input: { projectId: "project-1" } })
      .queryKey,
    definitions,
  );
  if (recordId) {
    queryClient.setQueryData(
      orpc.customFieldValues.queryOptions({
        input: {
          projectId: "project-1",
          recordId,
          recordType,
        },
      }).queryKey,
      values ?? [],
    );
  }

  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(CustomFieldValuesForm, {
        projectId: "project-1",
        recordId,
        recordType,
      }),
    ),
  );
}

describe("Custom field values form", () => {
  test("shows fields only on their bound record type during creation", () => {
    const html = renderFields({
      definitions: [
        definition(),
        definition({
          id: "field-2",
          name: "Risk level",
          recordTypes: ["Risk"],
          type: "Single select",
          options: ["Low", "High"],
        }),
      ],
      recordType: "Work",
    });

    expect(html).toContain("Audience");
    expect(html).not.toContain("Risk level");
    expect(html).toContain("Not evaluated");
  });

  test("shows a field on another supported bound record type", () => {
    const html = renderFields({
      definitions: [
        definition({
          name: "Risk level",
          recordTypes: ["Risk"],
          type: "Single select",
          options: ["Low", "High"],
        }),
      ],
      recordType: "Risk",
    });

    expect(html).toContain("Risk level");
    expect(html).toContain("Low");
    expect(html).toContain("High");
  });

  test("keeps Boolean false, a select value, and Not evaluated distinct", () => {
    const reviewed = definition({
      id: "field-2",
      name: "Reviewed",
      type: "Boolean",
    });
    const status = definition({
      id: "field-3",
      name: "Status",
      options: ["Ready", "Later"],
      type: "Single select",
    });
    const html = renderFields({
      definitions: [definition(), reviewed, status],
      recordId: "work-1",
      recordType: "Work",
      values: [
        { definition: definition(), value: null },
        {
          definition: reviewed,
          value: {
            createdAt: timestamp,
            definitionId: reviewed.id,
            id: "value-2",
            recordId: "work-1",
            recordType: "Work",
            revision: 1,
            updatedAt: timestamp,
            value: { boolean: false, kind: "boolean" },
          },
        },
        {
          definition: status,
          value: {
            createdAt: timestamp,
            definitionId: status.id,
            id: "value-3",
            recordId: "work-1",
            recordType: "Work",
            revision: 1,
            updatedAt: timestamp,
            value: { kind: "option", option: "Ready" },
          },
        },
      ],
    });

    expect(html).toContain("Not evaluated");
    expect(html).toContain("False");
    expect(html).toContain("Ready");
  });

  test("does not render an unbound record surface", () => {
    const html = renderFields({
      definitions: [definition()],
      recordType: "Feedback",
    });

    expect(html).toBe("");
  });
});
