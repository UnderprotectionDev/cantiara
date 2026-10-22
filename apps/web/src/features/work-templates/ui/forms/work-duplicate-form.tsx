// biome-ignore-all lint/performance/noJsxPropsBind: Work duplicate controls close over the selected Work and preview state.
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import {
  type DuplicateWorkInput,
  duplicateWorkMutationInputSchema,
} from "@cantiara/api/work-templates";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useEffect } from "react";

export default function WorkDuplicateForm({
  duplicate,
  preview,
  work,
  pending,
  setError,
  setOpen,
}: {
  duplicate: import("@tanstack/react-query").UseMutationResult<
    WorkProfile,
    Error,
    DuplicateWorkInput,
    unknown
  >;
  preview: import("@tanstack/react-query").UseQueryResult<
    import("@cantiara/api/work-templates").DuplicateWorkPreview,
    Error
  >;
  work: WorkProfile;
  pending: boolean;
  setError: import("react").Dispatch<
    import("react").SetStateAction<string | null>
  >;
  setOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}) {
  const previewDefinitionIds = preview.data?.customFields.map(
    (field) => field.definitionId,
  );
  const form = useForm({
    defaultValues: {
      customFieldDefinitionIds: previewDefinitionIds ?? ([] as string[]),
    },
    onSubmit: async ({ value }) => {
      const parsed = duplicateWorkMutationInputSchema.safeParse({
        baseRevision: preview.data?.sourceRevision ?? work.revision,
        clientIdempotencyKey: crypto.randomUUID(),
        customFieldDefinitionIds: value.customFieldDefinitionIds,
        sourceWorkId: work.id,
      });
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ??
            "Work could not be duplicated. Try again.",
        );
        return;
      }
      await duplicate.mutateAsync(parsed.data).catch(() => undefined);
    },
  });
  useEffect(() => {
    if (preview.data) {
      form.setFieldValue(
        "customFieldDefinitionIds",
        preview.data.customFields.map((field) => field.definitionId),
      );
    }
  }, [form, preview.data]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label="Duplicate Work"
      className="w-full space-y-3 rounded-md border border-border/70 bg-background/80 p-3 text-left"
      onSubmit={handleSubmit}
    >
      {preview.isPending ? (
        <p className="text-muted-foreground text-xs" role="status">
          Loading copy preview…
        </p>
      ) : null}
      {preview.isError ? (
        <p className="text-destructive text-xs" role="alert">
          Copy preview could not be loaded. Try again.
        </p>
      ) : null}
      {preview.data ? (
        <>
          <p className="text-muted-foreground text-xs">
            Copies title, type, description, the checklist, and the selected
            Custom fields into a new Work with a new key. History, relations,
            close outcome, current status, and dates are not copied.
          </p>
          <dl className="space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Title</dt>
              <dd className="font-medium">{preview.data.title}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium">{preview.data.type}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="font-medium">
                {preview.data.description ?? "Not set"}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Checklist</dt>
              <dd className="font-medium">
                {preview.data.checklist.length} item
                {preview.data.checklist.length === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
          {preview.data.customFields.length > 0 ? (
            <fieldset className="space-y-2">
              <legend className="text-muted-foreground text-xs">
                Selected field values
              </legend>
              <form.Field name="customFieldDefinitionIds">
                {(idsField) => (
                  <>
                    {preview.data?.customFields.map((field) => {
                      const checkboxId = `work-duplicate-${work.id}-${field.definitionId}`;
                      return (
                        <label
                          className="flex items-center gap-2 text-xs"
                          htmlFor={checkboxId}
                          key={field.definitionId}
                        >
                          <Checkbox
                            checked={idsField.state.value.includes(
                              field.definitionId,
                            )}
                            disabled={pending}
                            id={checkboxId}
                            onCheckedChange={(checked) =>
                              idsField.handleChange(
                                checked === true
                                  ? [
                                      ...idsField.state.value,
                                      field.definitionId,
                                    ]
                                  : idsField.state.value.filter(
                                      (candidate) =>
                                        candidate !== field.definitionId,
                                    ),
                              )
                            }
                          />
                          {field.name}
                        </label>
                      );
                    })}
                  </>
                )}
              </form.Field>
            </fieldset>
          ) : null}
          <div className="flex gap-2">
            <Button disabled={pending} size="xs" type="submit">
              Duplicate Work
            </Button>
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              size="xs"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}
