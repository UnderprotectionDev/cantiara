// biome-ignore-all lint/performance/noJsxPropsBind: Saved list controls close over their form fields.
import {
  PROJECT_AREA_OPTIONS,
  PROJECT_LIFECYCLE_STATUS_OPTIONS,
  type ProjectArea,
  type ProjectLifecycleStatus,
} from "@cantiara/api/project-shell";
import {
  type WorkspaceOverviewSavedListColumnId,
  type WorkspaceOverviewSavedListDefinition,
  type WorkspaceOverviewSavedListGroupField,
  type WorkspaceOverviewSavedListSortField,
  workspaceOverviewSavedListDefinitionSchema,
} from "@cantiara/api/workspace-overview";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { COLUMN_LABELS } from "../../lib/saved-list-columns";

const DEFAULT_COLUMNS: readonly WorkspaceOverviewSavedListColumnId[] = [
  "name",
  "status",
  "targetDate",
];

interface SavedListFormValues {
  archive: "all" | "archived" | "not-archived";
  areaMatch: "any" | "all";
  columns: WorkspaceOverviewSavedListColumnId[];
  groupBy: WorkspaceOverviewSavedListGroupField | "";
  lifecycleStatuses: ProjectLifecycleStatus[];
  name: string;
  nameContains: string;
  projectAreas: ProjectArea[];
  sortDirection: "asc" | "desc";
  sortField: WorkspaceOverviewSavedListSortField;
  stageNames: string;
  targetDateFrom: string;
  targetDateTo: string;
}

function initialFormValues(
  definition?: WorkspaceOverviewSavedListDefinition,
): SavedListFormValues {
  return {
    archive: definition?.conditions.archive ?? "all",
    areaMatch: definition?.conditions.areaMatch ?? "any",
    columns: [...(definition?.columns ?? DEFAULT_COLUMNS)],
    groupBy: definition?.groupBy ?? "",
    lifecycleStatuses: [...(definition?.conditions.lifecycleStatuses ?? [])],
    name: definition?.name ?? "",
    nameContains: definition?.conditions.nameContains ?? "",
    projectAreas: [...(definition?.conditions.projectAreas ?? [])],
    sortDirection: definition?.sort.direction ?? "asc",
    sortField: definition?.sort.field ?? "name",
    stageNames: definition?.conditions.stageNames.join(", ") ?? "",
    targetDateFrom: definition?.conditions.targetDate?.from ?? "",
    targetDateTo: definition?.conditions.targetDate?.to ?? "",
  };
}

function listEditorError(error: unknown) {
  if (typeof error === "object" && error !== null && "issues" in error) {
    const { issues } = error;
    if (Array.isArray(issues)) {
      const [first] = issues;
      if (
        typeof first === "object" &&
        first !== null &&
        "message" in first &&
        typeof first.message === "string"
      ) {
        return first.message;
      }
    }
  }
  return "Check the list name, conditions, and view settings.";
}

export function SavedListEditor({
  definition,
  onCancel,
  onSave,
}: {
  definition?: WorkspaceOverviewSavedListDefinition;
  onCancel: () => void;
  onSave: (definition: WorkspaceOverviewSavedListDefinition) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: initialFormValues(definition),
    onSubmit: ({ value }) => {
      const parsed = workspaceOverviewSavedListDefinitionSchema.safeParse({
        columns: value.columns,
        conditions: {
          archive: value.archive,
          areaMatch: value.areaMatch,
          lifecycleStatuses: value.lifecycleStatuses,
          nameContains: value.nameContains,
          projectAreas: value.projectAreas,
          stageNames: value.stageNames
            .split(",")
            .map((stage) => stage.trim())
            .filter(Boolean),
          targetDate:
            value.targetDateFrom || value.targetDateTo
              ? {
                  from: value.targetDateFrom || null,
                  to: value.targetDateTo || null,
                }
              : undefined,
        },
        groupBy: value.groupBy || null,
        id: definition?.id ?? crypto.randomUUID(),
        name: value.name,
        sort: {
          direction: value.sortDirection,
          field: value.sortField,
        },
      });
      if (!parsed.success) {
        setFormError(listEditorError(parsed.error));
        return;
      }
      setFormError(null);
      onSave(parsed.data);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="space-y-6 rounded-lg border border-border/70 bg-card/50 p-5"
      data-workspace-overview-saved-list-editor="true"
      noValidate
      onSubmit={submit}
    >
      <div>
        <p className="surface-kicker">Saved lists</p>
        <h3 className="mt-2 font-semibold text-lg tracking-tight">
          {definition ? "Edit saved list" : "New list"}
        </h3>
        <p className="mt-1 text-muted-foreground text-sm/relaxed">
          Membership comes from list conditions. There is no manual membership
          or parent Project.
        </p>
      </div>

      {formError ? (
        <div
          className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-destructive text-sm"
          role="alert"
        >
          {formError}
        </div>
      ) : null}

      <form.Field name="name">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="saved-list-name">List name</FieldLabel>
            <Input
              autoFocus
              id="saved-list-name"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              placeholder="Release projects"
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>

      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="font-medium text-sm">Lifecycle</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <form.Field name="lifecycleStatuses">
              {(field) =>
                PROJECT_LIFECYCLE_STATUS_OPTIONS.map((status) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    htmlFor={`saved-list-status-${status.toLowerCase().replaceAll(" ", "-")}`}
                    key={status}
                  >
                    <Checkbox
                      checked={field.state.value.includes(status)}
                      id={`saved-list-status-${status.toLowerCase().replaceAll(" ", "-")}`}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          field.handleChange([...field.state.value, status]);
                          return;
                        }
                        field.handleChange(
                          field.state.value.filter((value) => value !== status),
                        );
                      }}
                    />
                    {status}
                  </label>
                ))
              }
            </form.Field>
          </div>
          <FieldDescription>
            Leave all four unchecked to include every lifecycle status.
          </FieldDescription>
        </fieldset>

        <form.Field name="nameContains">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="saved-list-name-contains">
                Project name contains
              </FieldLabel>
              <Input
                id="saved-list-name-contains"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="checkout"
                value={field.state.value}
              />
            </Field>
          )}
        </form.Field>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form.Field name="stageNames">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="saved-list-stages">Stages</FieldLabel>
              <Input
                id="saved-list-stages"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Build, Release"
                value={field.state.value}
              />
              <FieldDescription>
                Enter visible stage names separated by commas.
              </FieldDescription>
            </Field>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="archive">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="saved-list-archive">Archive</FieldLabel>
                <NativeSelect
                  id="saved-list-archive"
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as SavedListFormValues["archive"],
                    )
                  }
                  value={field.state.value}
                >
                  <NativeSelectOption value="all">
                    All Projects
                  </NativeSelectOption>
                  <NativeSelectOption value="not-archived">
                    Not archived
                  </NativeSelectOption>
                  <NativeSelectOption value="archived">
                    Archived
                  </NativeSelectOption>
                </NativeSelect>
              </Field>
            )}
          </form.Field>
          <form.Field name="areaMatch">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="saved-list-area-match">
                  Project areas match
                </FieldLabel>
                <NativeSelect
                  id="saved-list-area-match"
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value as SavedListFormValues["areaMatch"],
                    )
                  }
                  value={field.state.value}
                >
                  <NativeSelectOption value="any">Any</NativeSelectOption>
                  <NativeSelectOption value="all">All</NativeSelectOption>
                </NativeSelect>
              </Field>
            )}
          </form.Field>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset className="space-y-3">
          <legend className="font-medium text-sm">Project areas</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <form.Field name="projectAreas">
              {(field) =>
                PROJECT_AREA_OPTIONS.map((area) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    htmlFor={`saved-list-area-${area.toLowerCase().replaceAll(" ", "-")}`}
                    key={area}
                  >
                    <Checkbox
                      checked={field.state.value.includes(area)}
                      id={`saved-list-area-${area.toLowerCase().replaceAll(" ", "-")}`}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          field.handleChange([...field.state.value, area]);
                          return;
                        }
                        field.handleChange(
                          field.state.value.filter((value) => value !== area),
                        );
                      }}
                    />
                    {area}
                  </label>
                ))
              }
            </form.Field>
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="targetDateFrom">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="saved-list-date-from">
                  Target date from
                </FieldLabel>
                <DatePicker
                  ariaLabel="Target date from"
                  id="saved-list-date-from"
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
          <form.Field name="targetDateTo">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="saved-list-date-to">
                  Target date to
                </FieldLabel>
                <DatePicker
                  ariaLabel="Target date to"
                  id="saved-list-date-to"
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              </Field>
            )}
          </form.Field>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-medium text-sm">Columns</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <form.Field name="columns">
            {(field) =>
              (
                Object.keys(
                  COLUMN_LABELS,
                ) as WorkspaceOverviewSavedListColumnId[]
              ).map((column) => (
                <label
                  className="flex items-center gap-2 text-sm"
                  htmlFor={`saved-list-column-${column}`}
                  key={column}
                >
                  <Checkbox
                    checked={field.state.value.includes(column)}
                    id={`saved-list-column-${column}`}
                    onCheckedChange={(checked) => {
                      if (checked === true) {
                        field.handleChange([...field.state.value, column]);
                        return;
                      }
                      field.handleChange(
                        field.state.value.filter((value) => value !== column),
                      );
                    }}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))
            }
          </form.Field>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <form.Field name="sortField">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="saved-list-sort-field">Sort</FieldLabel>
              <NativeSelect
                id="saved-list-sort-field"
                onChange={(event) =>
                  field.handleChange(
                    event.target.value as WorkspaceOverviewSavedListSortField,
                  )
                }
                value={field.state.value}
              >
                <NativeSelectOption value="name">Project</NativeSelectOption>
                <NativeSelectOption value="status">Status</NativeSelectOption>
                <NativeSelectOption value="targetDate">
                  Target date
                </NativeSelectOption>
                <NativeSelectOption value="createdAt">
                  Created date
                </NativeSelectOption>
                <NativeSelectOption value="updatedAt">
                  Updated date
                </NativeSelectOption>
              </NativeSelect>
            </Field>
          )}
        </form.Field>
        <form.Field name="sortDirection">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="saved-list-sort-direction">
                Direction
              </FieldLabel>
              <NativeSelect
                id="saved-list-sort-direction"
                onChange={(event) =>
                  field.handleChange(
                    event.target.value as SavedListFormValues["sortDirection"],
                  )
                }
                value={field.state.value}
              >
                <NativeSelectOption value="asc">Ascending</NativeSelectOption>
                <NativeSelectOption value="desc">Descending</NativeSelectOption>
              </NativeSelect>
            </Field>
          )}
        </form.Field>
        <form.Field name="groupBy">
          {(field) => (
            <Field>
              <FieldLabel htmlFor="saved-list-group-by">Grouping</FieldLabel>
              <NativeSelect
                id="saved-list-group-by"
                onChange={(event) =>
                  field.handleChange(
                    event.target.value as SavedListFormValues["groupBy"],
                  )
                }
                value={field.state.value}
              >
                <NativeSelectOption value="">None</NativeSelectOption>
                <NativeSelectOption value="status">Status</NativeSelectOption>
                <NativeSelectOption value="stage">Stage</NativeSelectOption>
                <NativeSelectOption value="archive">Archive</NativeSelectOption>
              </NativeSelect>
            </Field>
          )}
        </form.Field>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-border/70 border-t pt-4">
        <Button onClick={onCancel} type="button" variant="ghost">
          Cancel
        </Button>
        <Button type="submit">
          <Plus aria-hidden="true" />
          Save list
        </Button>
      </div>
    </form>
  );
}
