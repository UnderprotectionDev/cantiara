// biome-ignore-all lint/performance/noJsxPropsBind: Work Template controls close over the selected definition and draft field.
import type { CustomFieldDefinition } from "@cantiara/api/custom-fields";
import {
  type ParsedCreateWorkTemplateInput,
  resolveWorkTemplateDates,
  type WorkTemplate,
} from "@cantiara/api/work-templates";
import { Button } from "@cantiara/ui/components/button";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { useWorkTemplates } from "@/features/work-templates/hooks/use-work-templates";
import { useCustomFields } from "@/lib/use-custom-fields";
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
  const templates = useWorkTemplates(projectId);
  const customFields = useCustomFields(projectId);
  const [editing, setEditing] = useState<WorkTemplate | null>(null);
  const [instantiating, setInstantiating] = useState<WorkTemplate | null>(null);
  const [createdWorkKey, setCreatedWorkKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const definitions = useMemo(
    () =>
      (customFields.query.data ?? []).filter(
        (definition) =>
          definition.trashedAt === null &&
          definition.type !== "Date" &&
          definition.recordTypes.includes("Work"),
      ),
    [customFields.query.data],
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
    setError(null);
  }

  async function saveTemplate(input: ParsedCreateWorkTemplateInput) {
    setError(null);
    try {
      if (editing) {
        const { projectId: _projectId, ...rest } = input;
        await templates.update.mutateAsync({
          ...rest,
          baseRevision: editing.revision,
          templateId: editing.id,
        });
      } else {
        await templates.create.mutateAsync(input);
      }
      resetDraft();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Work Template could not be saved.",
      );
    }
  }

  const list = templates.query.data ?? [];

  async function instantiateTemplate(template: WorkTemplate, title: string) {
    setError(null);
    try {
      const work = await templates.instantiate.mutateAsync({
        baseRevision: template.revision,
        createDate: previewDate,
        templateId: template.id,
        title,
      });
      setCreatedWorkKey(work.key);
      setInstantiating(null);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Work could not be created from this template.",
      );
    }
  }

  return (
    <div className="mt-3 space-y-6" data-work-template-editor="true">
      <p className="max-w-2xl text-muted-foreground text-xs/relaxed">
        Reuse a Project-specific starting point with a type, description
        skeleton, selected field defaults, checklist, and relative dates.
      </p>

      {templates.query.isPending ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading Work Templates…
        </p>
      ) : null}
      {templates.query.isError ? (
        <p className="text-destructive text-sm" role="alert">
          Work Templates could not be loaded. Try loading this page again.
        </p>
      ) : null}
      {createdWorkKey ? (
        <p className="text-sm" role="status">
          Created Work {createdWorkKey}.
        </p>
      ) : null}
      {list.length === 0 && !templates.query.isPending ? (
        <p className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
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
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="mt-1 text-muted-foreground text-xs">
                      {template.type} · {template.checklist.length} checklist
                      item{template.checklist.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setInstantiating(template);
                        setCreatedWorkKey(null);
                        setError(null);
                      }}
                      size="xs"
                      type="button"
                    >
                      Create from template
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => {
                        setEditing(template);
                        setFormVersion((version) => version + 1);
                        setError(null);
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
                          {
                            baseRevision: template.revision,
                            templateId: template.id,
                          },
                          {
                            onError: (mutationError) =>
                              setError(
                                mutationError instanceof Error
                                  ? mutationError.message
                                  : "Work Template could not be moved to Trash.",
                              ),
                          },
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
                  <p className="mt-3 text-muted-foreground text-xs">
                    Field defaults:{" "}
                    {template.customFieldDefaults
                      .map((item) =>
                        customFieldLabel(definitions, item.definitionId),
                      )
                      .join(", ")}
                  </p>
                ) : null}
                {preview.plannedStartDate || preview.targetDate ? (
                  <dl className="mt-4 grid gap-3 border-border/70 border-t pt-3 text-xs sm:grid-cols-3">
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
                      setError(null);
                    }}
                    onCreate={(title) => instantiateTemplate(template, title)}
                    onValidationError={setError}
                    template={template}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <WorkTemplateForm
        customFieldsLoaded={Boolean(customFields.query.data)}
        definitions={definitions}
        editing={editing}
        error={error}
        key={`${editing?.id ?? "new"}:${formVersion}`}
        onCancel={resetDraft}
        onSave={saveTemplate}
        onValidationError={setError}
        pending={pending}
        previewDate={previewDate}
        projectId={projectId}
      />
    </div>
  );
}
