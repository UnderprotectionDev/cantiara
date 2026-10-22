// biome-ignore-all lint/performance/noJsxPropsBind: Saved list controls close over their source list.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  type WorkspaceOverviewProject,
  type WorkspaceOverviewSavedList,
  type WorkspaceOverviewSavedListColumnId,
  type WorkspaceOverviewSavedListDefinition,
  type WorkspaceOverviewSavedListGroupField,
  workspaceOverviewProjectHref,
} from "@cantiara/api/workspace-overview";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cantiara/ui/components/table";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { AppLink } from "@/components/app-link";
import {
  formatAccountDate,
  formatAccountDateTime,
} from "@/features/account-preferences/lib/account-preferences-format";
import { COLUMN_LABELS } from "../../lib/saved-list-columns";
import { SavedListEditor } from "../forms/saved-list-editor-form";

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
        <AppLink
          className="font-medium underline-offset-4 hover:underline"
          href={workspaceOverviewProjectHref(project.id)}
        >
          {project.name}
        </AppLink>
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
          <AppLink
            className="inline-flex items-center gap-1 text-muted-foreground text-sm underline-offset-4 hover:underline"
            href="/projects"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Saved lists
          </AppLink>
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
                  <AppLink
                    className="font-medium underline-offset-4 hover:underline"
                    href={list.href}
                  >
                    {list.name}
                  </AppLink>
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
              <AppLink
                className={`${buttonVariants({ size: "sm", variant: "ghost" })} mt-3 -ml-3 min-h-10`}
                href={list.href}
              >
                Open list
              </AppLink>
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
