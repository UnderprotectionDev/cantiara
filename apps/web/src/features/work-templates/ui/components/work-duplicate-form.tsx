// biome-ignore-all lint/performance/noJsxPropsBind: Duplicate Work selections are local to one preview.

import {
  WORK_DEFAULT_TYPE,
  type WorkProfile,
} from "@cantiara/api/work-lifecycle";
import type {
  WorkDuplicateField,
  WorkDuplicatePreview,
} from "@cantiara/api/work-templates";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";

const NOT_COPIED_FIELDS = [
  "Current status",
  "Close outcome",
  "Planning memberships",
  "Relations",
  "History",
  "Absolute dates",
  "Date Custom fields",
] as const;

function updateSelection<T>(values: T[], value: T, checked: boolean) {
  return checked
    ? [...new Set([...values, value])]
    : values.filter((candidate) => candidate !== value);
}

function previewValue(field: WorkDuplicatePreview["fields"][number]): string {
  if (field.key === "checklist") {
    const count = Array.isArray(field.value) ? field.value.length : 0;
    return `${count} ${count === 1 ? "item" : "items"}`;
  }
  return typeof field.value === "string" && field.value ? field.value : "Empty";
}

function ChecklistPreview({
  field,
}: {
  field: WorkDuplicatePreview["fields"][number];
}) {
  if (field.key !== "checklist" || !Array.isArray(field.value)) {
    return previewValue(field);
  }
  return (
    <span className="space-y-1">
      <span>
        {field.value.length} {field.value.length === 1 ? "item" : "items"}
      </span>
      <span className="block text-muted-foreground">
        {field.value
          .map(
            (item) => `${item.completed ? "Completed" : "Open"}: ${item.text}`,
          )
          .join("; ")}
      </span>
    </span>
  );
}

function FieldValuePreview({
  field,
  selected,
}: {
  field: WorkDuplicatePreview["fields"][number];
  selected: boolean;
}) {
  if (field.key === "type" && !selected) {
    return <span>Will be {WORK_DEFAULT_TYPE} (default type)</span>;
  }
  return <ChecklistPreview field={field} />;
}

function customFieldValue(field: WorkDuplicatePreview["customFields"][number]) {
  switch (field.value.kind) {
    case "boolean":
      return field.value.boolean ? "Yes" : "No";
    case "number":
      return String(field.value.number);
    case "option":
      return field.value.option;
    case "options":
      return field.value.options.join(", ");
    case "text":
      return field.value.text;
    case "date":
      return "Excluded";
    default:
      return "Excluded";
  }
}

export function WorkDuplicatePreviewPanel({
  disabled,
  onCancel,
  onConfirm,
  preview,
}: {
  disabled: boolean;
  onCancel: () => void;
  onConfirm: (
    selectedFields: WorkDuplicateField[],
    selectedCustomFieldIds: string[],
  ) => void;
  preview: WorkDuplicatePreview;
}) {
  const [selectedFields, setSelectedFields] = useState<WorkDuplicateField[]>(
    preview.fields
      .filter((field) => field.selectedByDefault)
      .map((field) => field.key),
  );
  const [selectedCustomFieldIds, setSelectedCustomFieldIds] = useState(
    preview.customFields
      .filter((field) => field.selectedByDefault)
      .map((field) => field.definitionId),
  );
  const hasTitle = selectedFields.includes("title");

  return (
    <section aria-label="Duplicate Work preview" className="space-y-3">
      <p className="font-medium text-sm">Duplicate Work preview</p>
      <fieldset className="space-y-2">
        <legend className="font-medium">Fields to copy</legend>
        {preview.fields.map((field) => (
          <label
            className="flex items-start gap-2"
            htmlFor={`duplicate-field-${preview.sourceWork.id}-${field.key}`}
            key={field.key}
          >
            <Checkbox
              checked={selectedFields.includes(field.key)}
              id={`duplicate-field-${preview.sourceWork.id}-${field.key}`}
              onCheckedChange={(checked) =>
                setSelectedFields((current) =>
                  updateSelection(current, field.key, checked),
                )
              }
            />
            <span>
              <strong>{field.label}</strong>:{" "}
              <FieldValuePreview
                field={field}
                selected={selectedFields.includes(field.key)}
              />
            </span>
          </label>
        ))}
        {preview.customFields.map((field) => (
          <label
            className="flex items-start gap-2"
            htmlFor={`duplicate-custom-field-${preview.sourceWork.id}-${field.definitionId}`}
            key={field.definitionId}
          >
            <Checkbox
              checked={selectedCustomFieldIds.includes(field.definitionId)}
              id={`duplicate-custom-field-${preview.sourceWork.id}-${field.definitionId}`}
              onCheckedChange={(checked) =>
                setSelectedCustomFieldIds((current) =>
                  updateSelection(current, field.definitionId, checked),
                )
              }
            />
            <span>
              <strong>{field.label}</strong>: {customFieldValue(field)}
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <p className="font-medium">Not copied</p>
        <p className="text-muted-foreground">{NOT_COPIED_FIELDS.join(", ")}.</p>
      </div>
      {hasTitle ? null : (
        <p className="text-destructive" role="alert">
          Title must be selected.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={disabled || !hasTitle}
          onClick={() => onConfirm(selectedFields, selectedCustomFieldIds)}
          size="xs"
          type="button"
        >
          Confirm Duplicate
        </Button>
        <Button onClick={onCancel} size="xs" type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function duplicateErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Work could not be duplicated. Try again.";
}

export default function WorkDuplicateForm({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<WorkDuplicatePreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicatedKey, setDuplicatedKey] = useState<string | null>(null);
  const pendingDuplicate = useRef<{
    clientIdempotencyKey: string;
    selection: string;
  } | null>(null);

  async function loadPreview() {
    setPending(true);
    setError(null);
    try {
      const nextPreview = await client.workDuplicatePreview({
        sourceWorkId: work.id,
      });
      setPreview(nextPreview);
      pendingDuplicate.current = null;
    } catch (previewError) {
      setError(duplicateErrorMessage(previewError));
    } finally {
      setPending(false);
    }
  }

  async function confirmDuplicate(
    selectedFields: WorkDuplicateField[],
    selectedCustomFieldIds: string[],
  ) {
    if (!preview) {
      return;
    }
    const selection = JSON.stringify({
      previewId: preview.previewId,
      selectedCustomFieldIds: [...selectedCustomFieldIds].sort(),
      selectedFields: [...selectedFields].sort(),
    });
    const { current } = pendingDuplicate;
    const clientIdempotencyKey =
      current?.selection === selection
        ? current.clientIdempotencyKey
        : crypto.randomUUID();
    pendingDuplicate.current = { clientIdempotencyKey, selection };
    setPending(true);
    setError(null);
    try {
      const duplicated = await runOnlineOnlyWrite(() =>
        client.duplicateWork({
          baseRevision: 0,
          clientIdempotencyKey,
          previewId: preview.previewId,
          selectedCustomFieldIds,
          selectedFields,
          sourceWorkId: work.id,
        }),
      );
      pendingDuplicate.current = null;
      setDuplicatedKey(duplicated.key);
      setPreview(null);
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: projectWorksQueryPrefix,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.customFieldProjectValues.queryOptions({
            input: { projectId: work.projectId, recordType: "Work" },
          }).queryKey,
        }),
      ]);
    } catch (duplicateError) {
      setError(duplicateErrorMessage(duplicateError));
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          disabled={connection === "offline"}
          onClick={() => {
            setOpen(true);
            setDuplicatedKey(null);
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          Duplicate Work
        </Button>
        {duplicatedKey ? (
          <p className="text-muted-foreground text-xs" role="status">
            Work {duplicatedKey} was duplicated.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <section
      aria-label={`Duplicate ${work.key}`}
      className="w-full space-y-3 rounded-md border bg-muted/20 p-3 text-left text-xs"
    >
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {preview ? (
        <WorkDuplicatePreviewPanel
          disabled={pending}
          onCancel={() => {
            setPreview(null);
            pendingDuplicate.current = null;
          }}
          onConfirm={(selectedFields, selectedCustomFieldIds) => {
            confirmDuplicate(selectedFields, selectedCustomFieldIds).catch(
              () => undefined,
            );
          }}
          preview={preview}
        />
      ) : (
        <>
          <p className="font-medium text-sm">Duplicate Work</p>
          <p className="text-muted-foreground">
            Preview the fields before creating an independent Work in this
            Project.
          </p>
          <div className="flex gap-2">
            <Button
              disabled={pending}
              onClick={() => loadPreview().catch(() => undefined)}
              size="xs"
              type="button"
            >
              Preview
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              size="xs"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
