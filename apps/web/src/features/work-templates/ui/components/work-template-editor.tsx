// biome-ignore-all lint/performance/noJsxPropsBind: Work Template controls close over the selected definition and draft field.
import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import {
  type ParsedCreateWorkTemplateInput,
  resolveWorkTemplateDates,
  type WorkTemplate,
} from "@cantiara/api/work-templates";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useWorkTemplates } from "@/features/work-templates/hooks/use-work-templates";
import { commandVariables } from "@/lib/command-variables";
import { orpc } from "@/utils/orpc";

import { InstantiateWorkTemplateForm } from "../forms/instantiate-work-template-form";
import { WorkTemplateForm } from "../forms/work-template-form";

function browserCalendarDate() {
  return format(new Date(), "yyyy-MM-dd");
}

function customFieldLabel(
  definitions: readonly CustomFieldDefinition[],
  definitionId: string,
) {
  return (
    definitions.find((definition) => definition.id === definitionId)?.name ??
    "Unavailable Custom field"
  );
}

function datePreview(template: WorkTemplate, createDate: string) {
  return resolveWorkTemplateDates({
    createDate,
    relativeDates: template.relativeDates,
  });
}

export default function WorkTemplateEditor({
  disabled = false,
  previewDate = browserCalendarDate(),
  projectId,
}: {
  disabled?: boolean;
  previewDate?: string;
  projectId: string;
}) {
  const customFields = useQuery(
    orpc.customFields.queryOptions({ input: { projectId } }),
  );
  const [editing, setEditing] = useState<WorkTemplate | null>(null);
  const [instantiating, setInstantiating] = useState<WorkTemplate | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const templates = useWorkTemplates(projectId, {
    onCreatedWork: () => {
      setInstantiating(null);
      setValidationError(null);
    },
    onSavedTemplate: resetDraft,
  });
  const definitions = useMemo(
    () =>
      (customFields.data ?? []).filter(
        (definition) =>
          definition.trashedAt === null &&
          definition.type !== "Date" &&
          definition.recordTypes.includes("Work"),
      ),
    [customFields.data],
  );
  const pending =
    disabled ||
    templates.create.isPending ||
    templates.instantiate.isPending ||
    templates.update.isPending ||
    templates.moveToTrash.isPending;
  const [formVersion, setFormVersion] = useState(0);

  function resetDraft() {
    setFormVersion((version) => version + 1);
    setEditing(null);
    setValidationError(null);
  }

  async function saveTemplate(input: ParsedCreateWorkTemplateInput) {
    setValidationError(null);
    try {
      if (editing) {
        const { projectId: _projectId, ...rest } = input;
        await templates.update.mutateAsync(
          commandVariables(
            {
              ...rest,
              baseRevision: editing.revision,
              templateId: editing.id,
            },
            templates.update.isError ? templates.update.variables : undefined,
          ),
        );
      } else {
        await templates.create.mutateAsync(
          commandVariables(
            { ...input, baseRevision: 0 },
            templates.create.isError ? templates.create.variables : undefined,
          ),
        );
      }
    } catch {
      // Query exposes the failure and retains the submitted variables for retry.
    }
  }

  const list = templates.query.data ?? [];

  async function instantiateTemplate(template: WorkTemplate, title: string) {
    setValidationError(null);
    try {
      await templates.instantiate.mutateAsync(
        commandVariables(
          {
            baseRevision: template.revision,
            createDate: previewDate,
            templateId: template.id,
            title,
          },
          templates.instantiate.isError
            ? templates.instantiate.variables
            : undefined,
        ),
      );
    } catch {
      // Query exposes the failure and retains the submitted variables for retry.
    }
  }

  const createdWorkKey =
    templates.instantiate.data?.projectId === projectId
      ? templates.instantiate.data.key
      : undefined;
  const save = editing ? templates.update : templates.create;
  const failure = instantiating
    ? templates.instantiate.error
    : (save.error ?? templates.moveToTrash.error);
  const error =
    validationError ?? (failure instanceof Error ? failure.message : null);

  return (
    <div className="mt-3 space-y-6" data-work-template-editor="true">
      <p className="max-w-2xl text-xs/relaxed text-muted-foreground">
        Reuse a Project-specific starting point with a type, description
        skeleton, selected field defaults, checklist, and relative dates.
      </p>

      {templates.query.status === "pending" ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading Work Templates…
        </p>
      ) : null}
      {templates.query.isError ? (
        <p className="text-sm text-destructive" role="alert">
          Work Templates could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {createdWorkKey ? (
        <p className="text-sm" role="status">
          Created Work {createdWorkKey}.
        </p>
      ) : null}
      {list.length === 0 && !templates.query.isPending ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          No Work Templates yet. Define the first reusable starting point below.
        </p>
      ) : (
        <ul aria-label="Work Templates" className="grid gap-3">
          {list.map((template) => {
            const preview = datePreview(template, previewDate);
            return (
              <li
                className="rounded-md border border-border/70 bg-card/45 p-4"
                key={template.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {template.type} · {template.checklist.length} checklist
                      item{template.checklist.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setInstantiating(template);
                        templates.instantiate.reset();
                        setValidationError(null);
                      }}
                      size="xs"
                      type="button"
                    >
                      Create from template
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        templates.update.reset();
                        templates.moveToTrash.reset();
                        setEditing(template);
                        setFormVersion((version) => version + 1);
                        setValidationError(null);
                      }}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      Edit
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        templates.moveToTrash.mutate(
                          commandVariables(
                            {
                              baseRevision: template.revision,
                              templateId: template.id,
                            },
                            templates.moveToTrash.isError
                              ? templates.moveToTrash.variables
                              : undefined,
                          ),
                        )
                      }
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      Move to Trash
                    </Button>
                  </div>
                </div>
                {template.customFieldDefaults.length > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Field defaults:{" "}
                    {template.customFieldDefaults
                      .map((item) =>
                        customFieldLabel(definitions, item.definitionId),
                      )
                      .join(", ")}
                  </p>
                ) : null}
                {preview.plannedStartDate || preview.targetDate ? (
                  <dl className="mt-4 grid gap-3 border-t border-border/70 pt-3 text-xs sm:grid-cols-3">
                    <div>
                      <dt className="text-muted-foreground">Creation day</dt>
                      <dd className="mt-1 font-medium">{previewDate}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Planned start</dt>
                      <dd className="mt-1 font-medium">
                        {preview.plannedStartDate ?? "Not set"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Target</dt>
                      <dd className="mt-1 font-medium">
                        {preview.targetDate ?? "Not set"}
                      </dd>
                    </div>
                  </dl>
                ) : null}
                {instantiating?.id === template.id ? (
                  <InstantiateWorkTemplateForm
                    disabled={pending}
                    onCancel={() => {
                      setInstantiating(null);
                      templates.instantiate.reset();
                      setValidationError(null);
                    }}
                    onCreate={(title) => instantiateTemplate(template, title)}
                    onValidationError={setValidationError}
                    template={template}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <WorkTemplateForm
        customFieldsLoaded={Boolean(customFields.data)}
        definitions={definitions}
        editing={editing}
        error={error}
        key={`${editing?.id ?? "new"}:${formVersion}`}
        onCancel={() => {
          templates.create.reset();
          templates.update.reset();
          resetDraft();
        }}
        onSave={saveTemplate}
        onValidationError={setValidationError}
        pending={pending}
        previewDate={previewDate}
        projectId={projectId}
      />
    </div>
  );
}
