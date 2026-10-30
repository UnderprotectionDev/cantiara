// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  EXPORT_DIAGRAM_TYPE,
  EXPORT_FORMATS,
  EXPORT_LABEL,
  EXPORT_WORK_FAMILY,
  type ExportCatalogEntry,
  type ExportFormat,
  type ExportRequest,
  exportRequestSchema,
  WORKSPACE_SCOPED_RECORD_TYPES,
} from "@cantiara/api/data-export";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";
import {
  type ExportHandoff,
  handoffRecordIds,
  handoffWorkTypes,
} from "../../lib/export-handoff";

const IDS_SEPARATOR = /[\s,]+/;

function parseIds(text: string): string[] {
  return text.split(IDS_SEPARATOR).filter((id) => id.length > 0);
}

function viewSummary(handoff: ExportHandoff, recordType: string): string {
  const ids = handoffRecordIds(handoff, recordType).length;
  const filters = Object.entries(handoff.filters);
  return [
    `${handoff.view.kind} "${handoff.view.name}"`,
    `${ids} ${recordType === EXPORT_WORK_FAMILY ? "Work (all types)" : recordType} ${ids === 1 ? "record" : "records"}`,
    filters.length > 0
      ? `Filters: ${filters.map(([key, value]) => `${key} = ${value}`).join(", ")}`
      : "No filters",
    handoff.visibleFields
      ? `Columns: ${handoff.visibleFields.join(", ")}`
      : "All columns",
  ].join(" · ");
}

/**
 * Picks the scope, the record type, optional filter and record ids, and the
 * format. The type list is the closed catalog; a type without a source stays
 * visible but cannot be chosen. Opened from a list screen, the exact view is
 * fixed (scope, filters, columns, ids) and `PDF` becomes available; a general
 * export offers `JSON` and `CSV` only.
 */
export function ExportForm({
  catalog,
  disabled,
  handoff,
  onPreview,
  projects,
}: {
  catalog: readonly ExportCatalogEntry[];
  disabled: boolean;
  handoff?: ExportHandoff | null;
  onPreview: (request: ExportRequest) => void;
  projects: ReadonlyArray<{ id: string; name: string }>;
}) {
  const families = [...new Set(catalog.map((entry) => entry.family))];
  // Two or more Work types in one list export together: Work is one family.
  const mixedWork = handoff ? handoffWorkTypes(handoff).length > 1 : false;
  const viewTypes = handoff
    ? [
        ...(mixedWork ? [EXPORT_WORK_FAMILY as string] : []),
        ...Object.keys(handoff.recordIdsByType).filter((type) =>
          catalog.some((entry) => entry.recordType === type && entry.available),
        ),
      ]
    : [];
  const formats = handoff
    ? EXPORT_FORMATS
    : EXPORT_FORMATS.filter((format) => format !== "PDF");
  const form = useForm({
    defaultValues: {
      format: (handoff ? "CSV" : "JSON") as ExportFormat,
      projectId: projects[0]?.id ?? "",
      recordIds: "",
      recordType:
        viewTypes[0] ??
        catalog.find((entry) => entry.available)?.recordType ??
        "",
      status: "",
    },
    onSubmit: ({ value }) => {
      const base = handoff
        ? {
            filters: handoff.filters,
            recordIds: handoffRecordIds(handoff, value.recordType),
            scope: handoff.scope,
            view: handoff.view,
            visibleFields: handoff.visibleFields,
          }
        : {
            filters: value.status.trim() ? { status: value.status.trim() } : {},
            recordIds: parseIds(value.recordIds),
            scope: WORKSPACE_SCOPED_RECORD_TYPES.some(
              (type) => type === value.recordType,
            )
              ? { kind: "workspace" }
              : { kind: "project", projectId: value.projectId },
          };
      const parsed = exportRequestSchema.safeParse({
        ...base,
        format: value.format,
        recordIds: base.recordIds.length > 0 ? base.recordIds : undefined,
        recordType: value.recordType,
      });
      if (parsed.success) {
        onPreview(parsed.data);
      }
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label={`${EXPORT_LABEL} selection`}
      className="space-y-4"
      onSubmit={submit}
    >
      {handoff ? null : (
        <form.Field name="projectId">
          {(field) => (
            <div className="space-y-1">
              <label className="font-medium text-sm" htmlFor="export-project">
                Project
              </label>
              <NativeSelect
                disabled={disabled}
                id="export-project"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              >
                {projects.map((project) => (
                  <NativeSelectOption key={project.id} value={project.id}>
                    {project.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
        </form.Field>
      )}
      <form.Field name="recordType">
        {(field) => (
          <div className="space-y-1">
            <label className="font-medium text-sm" htmlFor="export-type">
              Record type
            </label>
            <NativeSelect
              disabled={disabled}
              id="export-type"
              onChange={(event) => {
                field.handleChange(event.target.value);
                if (event.target.value === EXPORT_DIAGRAM_TYPE) {
                  // Export-only: JSON is the one format a diagram offers.
                  form.setFieldValue("format", "JSON");
                }
              }}
              value={field.state.value}
            >
              {families.map((family) => (
                <optgroup key={family} label={family}>
                  {mixedWork && family === "Work" ? (
                    <NativeSelectOption value={EXPORT_WORK_FAMILY}>
                      Work (all types)
                    </NativeSelectOption>
                  ) : null}
                  {catalog
                    .filter(
                      (entry) =>
                        entry.family === family &&
                        (!handoff || viewTypes.includes(entry.recordType)),
                    )
                    .map((entry) => (
                      <NativeSelectOption
                        disabled={!entry.available}
                        key={entry.recordType}
                        value={entry.recordType}
                      >
                        {entry.recordType}
                        {entry.exportOnly ? " (export only, JSON)" : ""}
                        {entry.available ? "" : " (not available yet)"}
                      </NativeSelectOption>
                    ))}
                </optgroup>
              ))}
            </NativeSelect>
          </div>
        )}
      </form.Field>
      {handoff ? (
        <form.Subscribe selector={(state) => state.values.recordType}>
          {(recordType) => (
            <p className="text-sm" id="export-view-summary">
              {viewSummary(handoff, recordType)}
            </p>
          )}
        </form.Subscribe>
      ) : (
        <>
          <form.Field name="status">
            {(field) => (
              <div className="space-y-1">
                <label className="font-medium text-sm" htmlFor="export-status">
                  Status filter (optional)
                </label>
                <Input
                  disabled={disabled}
                  id="export-status"
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="recordIds">
            {(field) => (
              <div className="space-y-1">
                <label className="font-medium text-sm" htmlFor="export-ids">
                  Record ids (optional)
                </label>
                <Textarea
                  aria-describedby="export-ids-help"
                  disabled={disabled}
                  id="export-ids"
                  onChange={(event) => field.handleChange(event.target.value)}
                  rows={3}
                  value={field.state.value}
                />
                <p
                  className="text-muted-foreground text-xs"
                  id="export-ids-help"
                >
                  Separate ids with spaces, commas or new lines. Leave empty to
                  export every record of the type that matches.
                </p>
              </div>
            )}
          </form.Field>
        </>
      )}
      <form.Field name="format">
        {(field) => (
          <fieldset className="space-y-2">
            <legend className="font-medium text-sm">Format</legend>
            <RadioGroup
              className="flex gap-4"
              disabled={disabled}
              name="export-format"
              onValueChange={(value) =>
                field.handleChange(value as ExportFormat)
              }
              value={field.state.value}
            >
              <form.Subscribe selector={(state) => state.values.recordType}>
                {(recordType) =>
                  formats
                    .filter(
                      (format) =>
                        recordType !== EXPORT_DIAGRAM_TYPE || format === "JSON",
                    )
                    .map((format) => (
                      <label
                        className="flex items-center gap-2 text-sm"
                        htmlFor={`export-format-${format}`}
                        key={format}
                      >
                        <RadioGroupItem
                          id={`export-format-${format}`}
                          value={format}
                        />
                        {format}
                      </label>
                    ))
                }
              </form.Subscribe>
            </RadioGroup>
          </fieldset>
        )}
      </form.Field>
      <Button
        disabled={
          disabled || (handoff ? viewTypes.length === 0 : projects.length === 0)
        }
        type="submit"
      >
        Preview
      </Button>
    </form>
  );
}
