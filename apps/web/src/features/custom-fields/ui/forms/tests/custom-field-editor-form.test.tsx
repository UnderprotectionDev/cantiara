// @vitest-environment happy-dom

import {
  CUSTOM_FIELD_RECORD_TYPE_OPTIONS,
  CUSTOM_FIELD_TYPE_OPTIONS,
  type CustomFieldDefinition,
} from "@cantiara/api/custom-fields";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { orpc } from "@/utils/orpc";
import CustomFieldEditor from "../custom-field-editor-form";

function renderEditor(projectId: string, definitions: CustomFieldDefinition[]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    orpc.customFields.queryOptions({ input: { projectId } }).queryKey,
    definitions,
  );

  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(CustomFieldEditor, { projectId }),
    ),
  );
}

test("Custom field editing clears on Cancel, field removal, and Project switch", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const projectId = "project-1";
  const definition: CustomFieldDefinition = {
    createdAt: "2026-09-19T09:00:00.000Z",
    id: "field-1",
    name: "Release readiness",
    options: [],
    projectId,
    recordTypes: ["Work"],
    revision: 1,
    trashedAt: null,
    type: "Text",
    updatedAt: "2026-09-19T09:00:00.000Z",
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Number.POSITIVE_INFINITY } },
  });
  const key = orpc.customFields.queryOptions({ input: { projectId } }).queryKey;
  queryClient.setQueryData(key, [definition]);
  queryClient.setQueryData(
    orpc.customFields.queryOptions({ input: { projectId: "project-2" } })
      .queryKey,
    [{ ...definition, id: "field-2", projectId: "project-2" }],
  );
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function render(id: string) {
    act(() =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <CustomFieldEditor projectId={id} />
        </QueryClientProvider>,
      ),
    );
  }
  const input = () =>
    host.querySelector<HTMLInputElement>("#custom-field-edit-name-field-1");
  function click(label: string) {
    const button = [...host.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === label,
    );
    expect(button).toBeDefined();
    act(() => button?.click());
  }
  async function refresh(definitions: CustomFieldDefinition[]) {
    await act(async () => {
      queryClient.setQueryData(key, definitions);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  try {
    render(projectId);
    click("Edit");
    const field = input();
    act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(field, "Unsaved readiness");
      field?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(input()?.value).toBe("Unsaved readiness");
    click("Cancel");
    expect(input()).toBeNull();
    click("Edit");
    expect(input()?.value).toBe(definition.name);

    await refresh([]);
    expect(input()).toBeNull();
    await refresh([definition]);
    expect(input()).toBeNull();

    click("Edit");
    render("project-2");
    expect(host.querySelector('form[aria-label^="Edit "]')).toBeNull();
    render(projectId);
    expect(input()).toBeNull();
  } finally {
    act(() => root.unmount());
    queryClient.clear();
    host.remove();
    vi.unstubAllGlobals();
  }
});

describe("Custom field editor", () => {
  test("renders the closed type and record binding catalogs without forbidden counterparts", () => {
    const html = renderEditor("project-1", []);

    for (const type of CUSTOM_FIELD_TYPE_OPTIONS) {
      expect(html).toContain(type);
    }
    for (const recordType of CUSTOM_FIELD_RECORD_TYPE_OPTIONS) {
      expect(html).toContain(recordType);
    }
    for (const forbidden of [
      "Lookup",
      "Formula",
      "Session Test",
      "Test assessment",
      "Markdown body",
      "Raw attachment",
      "Tag hierarchy",
      "Rename Tag",
      "Merge tags",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  test("shows the Project-local definitions returned by the seam", () => {
    const html = renderEditor("project-1", [
      {
        createdAt: "2026-09-19T09:00:00.000Z",
        id: "field-1",
        name: "Release readiness",
        options: ["Ready", "Later"],
        projectId: "project-1",
        recordTypes: ["Work", "Project Release"],
        revision: 1,
        trashedAt: null,
        type: "Single select",
        updatedAt: "2026-09-19T09:00:00.000Z",
      },
    ]);

    expect(html).toContain("Release readiness");
    expect(html).toContain("Available on: Work, Project Release");
    expect(html).toContain("Options: Ready, Later");
    expect(html).toContain("Edit");
    expect(html).toContain("Move to Trash");
  });

  test("keeps trashed definitions separate with restore and permanent delete", () => {
    const html = renderEditor("project-1", [
      {
        createdAt: "2026-09-19T09:00:00.000Z",
        id: "field-1",
        name: "Release readiness",
        options: [],
        projectId: "project-1",
        recordTypes: ["Work"],
        revision: 2,
        trashedAt: "2026-09-19T10:00:00.000Z",
        type: "Text",
        updatedAt: "2026-09-19T10:00:00.000Z",
      },
    ]);

    expect(html).toContain("Trash");
    expect(html).toContain("Release readiness");
    expect(html).toContain("Restore");
    expect(html).toContain("Permanently Delete");
    expect(html).not.toContain("Move to Trash");
  });
});
