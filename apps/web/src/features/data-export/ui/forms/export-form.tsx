// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  EXPORT_FORMATS,
  EXPORT_LABEL,
  type ExportCatalogEntry,
  type ExportFormat,
  type ExportRequest,
  exportRequestSchema,
} from "@cantiara/api/data-export";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

/**
 * Picks the one Project scope, the one record type and the format. The type
 * list is the closed catalog; a type without a source stays visible but cannot
 * be chosen.
 */
export function ExportForm({
  catalog,
  disabled,
  onPreview,
  projects,
}: {
  catalog: readonly ExportCatalogEntry[];
  disabled: boolean;
  onPreview: (request: ExportRequest) => void;
  projects: ReadonlyArray<{ id: string; name: string }>;
}) {
  const families = [...new Set(catalog.map((entry) => entry.family))];
  const form = useForm({
    defaultValues: {
      format: "JSON" as ExportFormat,
      projectId: projects[0]?.id ?? "",
      recordType: catalog.find((entry) => entry.available)?.recordType ?? "",
    },
    onSubmit: ({ value }) => {
      const parsed = exportRequestSchema.safeParse({
        format: value.format,
        recordType: value.recordType,
        scope: { kind: "project", projectId: value.projectId },
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
      <form.Field name="recordType">
        {(field) => (
          <div className="space-y-1">
            <label className="font-medium text-sm" htmlFor="export-type">
              Record type
            </label>
            <NativeSelect
              disabled={disabled}
              id="export-type"
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              {families.map((family) => (
                <optgroup key={family} label={family}>
                  {catalog
                    .filter((entry) => entry.family === family)
                    .map((entry) => (
                      <NativeSelectOption
                        disabled={!entry.available}
                        key={entry.recordType}
                        value={entry.recordType}
                      >
                        {entry.recordType}
                        {entry.available ? "" : " (not available yet)"}
                      </NativeSelectOption>
                    ))}
                </optgroup>
              ))}
            </NativeSelect>
          </div>
        )}
      </form.Field>
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
              {EXPORT_FORMATS.map((format) => (
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
              ))}
            </RadioGroup>
          </fieldset>
        )}
      </form.Field>
      <Button disabled={disabled || projects.length === 0} type="submit">
        Preview
      </Button>
    </form>
  );
}
