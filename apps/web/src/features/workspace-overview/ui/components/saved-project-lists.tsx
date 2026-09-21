// biome-ignore-all lint/performance/noJsxPropsBind: Saved list controls close over their form fields and source list.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  PROJECT_AREA_OPTIONS,
  PROJECT_LIFECYCLE_STATUS_OPTIONS,
  type ProjectArea,
  type ProjectLifecycleStatus,
} from "@cantiara/api/project-shell";
import {
  type WorkspaceOverviewProject,
  type WorkspaceOverviewSavedList,
  type WorkspaceOverviewSavedListColumnId,
  type WorkspaceOverviewSavedListDefinition,
  type WorkspaceOverviewSavedListGroupField,
  type WorkspaceOverviewSavedListSortField,
  workspaceOverviewProjectHref,
  workspaceOverviewSavedListDefinitionSchema,
} from "@cantiara/api/workspace-overview";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cantiara/ui/components/table";
import { useForm } from "@tanstack/react-form";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { type FormEvent, Fragment, useMemo, useState } from "react";

import {
  formatAccountDate,
  formatAccountDateTime,
} from "@/features/account-preferences/lib/account-preferences-format";

const DEFAULT_COLUMNS: readonly WorkspaceOverviewSavedListColumnId[] = [
  "name",
  "status",
  "targetDate",
];

const COLUMN_LABELS: Record<WorkspaceOverviewSavedListColumnId, string> = {
  archive: "Archive",
  areas: "Project areas",
  name: "Project",
  stage: "Stage",
  status: "Status",
  targetDate: "Target date",
};

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

export function workspaceOverviewSavedListDefinitions(
  lists: readonly WorkspaceOverviewSavedList[],
) {
  return lists.map(
    ({ href: _href, projects: _projects, ...definition }) => definition,
  );
}

function projectCountLabel(count: number) {
  return `${count} ${count === 1 ? "Project" : "Projects"}`;
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

function SavedListEditor({
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
                <Input
                  id="saved-list-date-from"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  type="date"
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
                <Input
                  id="saved-list-date-to"
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  type="date"
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

function displayDate(
  value: string | null | undefined,
  preferences: AccountPreferences,
) {
  if (!value) {
    return "—";
  }
  try {
    return value.length === 10
      ? formatAccountDate(value, preferences)
      : formatAccountDateTime(value, preferences);
  } catch {
    return value;
  }
}

function projectStageLabel(project: WorkspaceOverviewProject) {
  const stages =
    project.stages?.map((stage) => stage.name).filter(Boolean) ?? [];
  return stages.length > 0 ? stages.join(", ") : "—";
}

function projectGroupLabel(
  project: WorkspaceOverviewProject,
  groupBy: WorkspaceOverviewSavedListGroupField,
) {
  switch (groupBy) {
    case "archive":
      return projectArchiveLabel(project);
    case "stage":
      return projectStageLabel(project);
    case "status":
      return project.status;
    default:
      return "";
  }
}

function projectArchiveLabel(project: WorkspaceOverviewProject) {
  return project.archivedAt ? "Archived" : "Not archived";
}

function renderProjectCell(
  project: WorkspaceOverviewProject,
  column: WorkspaceOverviewSavedListColumnId,
  formattingPreferences: AccountPreferences,
) {
  switch (column) {
    case "archive":
      return projectArchiveLabel(project);
    case "areas":
      return project.areas?.join(", ") || "—";
    case "name":
      return (
        <a
          className="font-medium underline-offset-4 hover:underline"
          href={workspaceOverviewProjectHref(project.id)}
        >
          {project.name}
        </a>
      );
    case "stage":
      return projectStageLabel(project);
    case "status":
      return project.status;
    case "targetDate":
      return displayDate(project.targetDate, formattingPreferences);
    default:
      return null;
  }
}

function SavedListTable({
  formattingPreferences,
  list,
}: {
  formattingPreferences: AccountPreferences;
  list: WorkspaceOverviewSavedList;
}) {
  const { groupBy, projects } = list;
  const orderedProjects = useMemo(() => {
    if (!groupBy) {
      return [...projects];
    }

    return projects
      .map((project, index) => ({
        group: projectGroupLabel(project, groupBy),
        index,
        project,
      }))
      .sort(
        (left, right) =>
          left.group.localeCompare(right.group) || left.index - right.index,
      )
      .map(({ project }) => project);
  }, [groupBy, projects]);
  const columns = useMemo<ColumnDef<WorkspaceOverviewProject>[]>(
    () =>
      list.columns.map((column) => ({
        cell: ({ row }) =>
          renderProjectCell(row.original, column, formattingPreferences),
        header: COLUMN_LABELS[column],
        id: column,
      })),
    [formattingPreferences, list.columns],
  );
  const table = useReactTable({
    columns,
    data: orderedProjects,
    getCoreRowModel: getCoreRowModel(),
  });
  const previousGroups = new Set<string>();

  return orderedProjects.length > 0 ? (
    <div className="rounded-lg border border-border/70">
      <Table
        className="min-w-[42rem] text-left text-sm"
        data-saved-list-table="true"
      >
        <TableHeader className="border-border/70 bg-muted/20">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  className="px-4 py-3 text-muted-foreground"
                  key={header.id}
                  scope="col"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="divide-y divide-border/70">
          {table.getRowModel().rows.map((row) => {
            const group = list.groupBy
              ? projectGroupLabel(row.original, list.groupBy)
              : null;
            const groupKey = group ? `${list.groupBy}:${group}` : null;
            const showGroup =
              groupKey !== null && !previousGroups.has(groupKey);
            if (groupKey) {
              previousGroups.add(groupKey);
            }
            return (
              <Fragment key={row.id}>
                {showGroup ? (
                  <TableRow key={`${row.id}-group`}>
                    <TableHead
                      className="bg-muted/10 px-4 py-2 text-muted-foreground text-xs uppercase tracking-[0.12em]"
                      colSpan={list.columns.length}
                      scope="rowgroup"
                    >
                      {group}
                    </TableHead>
                  </TableRow>
                ) : null}
                <TableRow className="align-top">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell className="px-4 py-3" key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  ) : (
    <div className="rounded-lg border border-border/70 border-dashed bg-muted/15 px-5 py-8 text-muted-foreground text-sm">
      No Projects match these conditions yet.
    </div>
  );
}

function SavedListDetail({
  formattingPreferences,
  list,
  onEdit,
}: {
  formattingPreferences: AccountPreferences;
  list: WorkspaceOverviewSavedList;
  onEdit: () => void;
}) {
  return (
    <section
      aria-labelledby="workspace-overview-saved-list-heading"
      className="space-y-6"
      data-workspace-overview-saved-list-detail={list.id}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <a
            className="inline-flex items-center gap-1 text-muted-foreground text-sm underline-offset-4 hover:underline"
            href="/projects"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Saved lists
          </a>
          <h2
            className="mt-4 font-semibold text-2xl tracking-tight"
            id="workspace-overview-saved-list-heading"
          >
            {list.name}
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            {projectCountLabel(list.projects.length)} · Membership comes from
            list conditions.
          </p>
        </div>
        <Button onClick={onEdit} type="button" variant="outline">
          <Pencil aria-hidden="true" />
          Edit list
        </Button>
      </header>
      <SavedListTable
        formattingPreferences={formattingPreferences}
        list={list}
      />
    </section>
  );
}

export default function SavedProjectLists({
  formattingPreferences,
  lists,
  onChange,
  selectedListId,
}: {
  formattingPreferences: AccountPreferences;
  lists: readonly WorkspaceOverviewSavedList[];
  onChange: (lists: readonly WorkspaceOverviewSavedListDefinition[]) => void;
  selectedListId?: string;
}) {
  const [editing, setEditing] = useState<
    WorkspaceOverviewSavedListDefinition | "new" | null
  >(null);
  const selectedList = lists.find((list) => list.id === selectedListId);

  function saveList(definition: WorkspaceOverviewSavedListDefinition) {
    const definitions = workspaceOverviewSavedListDefinitions(lists);
    const next = [
      ...definitions.filter((candidate) => candidate.id !== definition.id),
      definition,
    ];
    onChange(next);
    setEditing(null);
  }

  if (editing) {
    return (
      <SavedListEditor
        definition={editing === "new" ? undefined : editing}
        onCancel={() => setEditing(null)}
        onSave={saveList}
      />
    );
  }

  if (selectedList) {
    return (
      <SavedListDetail
        formattingPreferences={formattingPreferences}
        list={selectedList}
        onEdit={() =>
          setEditing(
            workspaceOverviewSavedListDefinitions(lists).find(
              (item) => item.id === selectedList.id,
            ) ?? null,
          )
        }
      />
    );
  }

  return (
    <section
      aria-labelledby="workspace-overview-saved-lists-heading"
      className="space-y-4 border-border/70 border-t pt-8"
      data-workspace-overview-saved-lists="true"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2
            className="font-semibold text-xl tracking-tight"
            id="workspace-overview-saved-lists-heading"
          >
            Saved lists
          </h2>
          <p className="mt-1 text-muted-foreground text-sm/relaxed">
            Cross-Project views stay live from visible Workspace conditions.
          </p>
        </div>
        <Button
          onClick={() => setEditing("new")}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" />
          New list
        </Button>
      </header>

      {lists.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2" data-saved-list-cards="true">
          {lists.map((list) => (
            <li
              className="rounded-lg border border-border/70 bg-card/50 p-4"
              key={list.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    className="font-medium underline-offset-4 hover:underline"
                    href={list.href}
                  >
                    {list.name}
                  </a>
                  <p className="mt-1 text-muted-foreground text-xs">
                    {projectCountLabel(list.projects.length)} · Membership comes
                    from list conditions.
                  </p>
                </div>
                <Button
                  aria-label={`Edit saved list: ${list.name}`}
                  onClick={() => setEditing(list)}
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <Pencil aria-hidden="true" />
                </Button>
              </div>
              <a
                className={`${buttonVariants({ size: "sm", variant: "ghost" })} mt-3 -ml-3`}
                href={list.href}
              >
                Open list
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-border/80 border-dashed bg-muted/15 px-5 py-8 text-muted-foreground text-sm">
          No saved lists yet. Create one to keep a live cross-Project view.
        </div>
      )}
    </section>
  );
}
