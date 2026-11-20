// biome-ignore-all lint/performance/noJsxPropsBind: Merge controls close over their current Work and preview state.

import {
  mergeWorkInputSchema,
  type WorkMergeField,
  type WorkMergePreviewInput,
  type WorkMergeResolution,
  type WorkMergeResult,
  type WorkProfile,
  workMergePreviewInputSchema,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type SubmitEvent, useRef, useState } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { commandVariables } from "@/lib/command-variables";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

function mergeErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Work could not be merged. Try again.";
}

function displayMergeValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Empty";
  }
  if (Array.isArray(value)) {
    return `${value.length} ${value.length === 1 ? "item" : "items"}`;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function isMergeFieldResolution(value: string): value is WorkMergeResolution {
  return value === "surviving" || value === "duplicate";
}

export default function WorkMergeForm({
  candidates,
  onMerged,
  work,
}: {
  candidates: WorkProfile[];
  onMerged?: (result: WorkMergeResult) => void;
  work: WorkProfile;
}) {
  const activeConfirmation = useRef<string | undefined>(undefined);
  const mergeWorkMutation = useMutation(
    orpc.mergeWork.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.mergeWork(input),
      onSuccess: async (
        result,
        { clientIdempotencyKey, duplicateWorkId, survivingWorkId },
      ) => {
        const projectId = result.work.projectId ?? work.projectId;
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryOptions({ input: { projectId } })
              .queryKey,
          }),
          ...[duplicateWorkId, survivingWorkId].map((workId) =>
            queryClient.invalidateQueries({
              queryKey: orpc.work.queryOptions({ input: { workId } }).queryKey,
            }),
          ),
          ...invalidateSmartCollectionMembership(queryClient),
        ]);
        onMerged?.(result);
        if (activeConfirmation.current === clientIdempotencyKey) {
          reset();
        }
      },
    }),
  );
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inspect = useMutation({
    mutationKey: orpc.workMergePreview.mutationKey(),
    mutationFn: (input: WorkMergePreviewInput) =>
      client.workMergePreview(input),
  });
  const preview = inspect.data;
  const writeError = mergeWorkMutation.error ?? inspect.error;
  const error =
    validationError ?? (writeError ? mergeErrorMessage(writeError) : null);

  const form = useForm({
    defaultValues: {
      fieldResolutions: {} as Partial<
        Record<WorkMergeField, WorkMergeResolution>
      >,
      survivingWorkId: candidates[0]?.id ?? "",
    },
    onSubmit: async ({ value }) => {
      const previewInput = workMergePreviewInputSchema.safeParse({
        duplicateWorkId: work.id,
        survivingWorkId: value.survivingWorkId,
      });
      if (!previewInput.success) {
        return;
      }
      setValidationError(null);
      try {
        if (!preview) {
          await inspect.mutateAsync(previewInput.data);
          form.setFieldValue("fieldResolutions", {});
          return;
        }

        const unresolvedFields = preview.fields.filter(
          (field) => field.conflict && !value.fieldResolutions[field.key],
        );
        if (unresolvedFields.length > 0) {
          setValidationError(
            "Resolve every Field conflict before confirming the merge.",
          );
          return;
        }

        const mergeInput = mergeWorkInputSchema.safeParse(
          commandVariables(
            {
              baseRevision: preview.survivingWork.revision,
              duplicateRevision: preview.duplicateWork.revision,
              duplicateWorkId: preview.duplicateWork.id,
              fieldResolutions: value.fieldResolutions,
              previewId: preview.previewId,
              survivingWorkId: preview.survivingWork.id,
            },
            mergeWorkMutation.isError ? mergeWorkMutation.variables : undefined,
          ),
        );
        if (!mergeInput.success) {
          setValidationError(mergeErrorMessage(null));
          return;
        }
        activeConfirmation.current = mergeInput.data.clientIdempotencyKey;
        await mergeWorkMutation.mutateAsync(mergeInput.data);
      } catch {
        // The observer reports request errors, including after Retry.
      }
    },
  });

  function resetPreview() {
    activeConfirmation.current = undefined;
    inspect.reset();
    mergeWorkMutation.reset();
    setValidationError(null);
  }

  function reset() {
    setOpen(false);
    resetPreview();
    form.reset();
    form.setFieldValue("survivingWorkId", candidates[0]?.id ?? "");
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  if (!open) {
    return (
      <Button
        disabled={connection === "offline" || candidates.length === 0}
        onClick={() => setOpen(true)}
        size="xs"
        type="button"
        variant="outline"
      >
        Merge as duplicate
      </Button>
    );
  }

  const conflictFields =
    preview?.fields.filter((field) => field.conflict) ?? [];
  const stableFields = preview?.fields.filter((field) => !field.conflict) ?? [];

  return (
    <section aria-label={`Merge ${work.key}`} className="w-full">
      <form
        className="w-full space-y-3 rounded-md border border-foreground/15 bg-muted/20 p-3 text-left text-xs"
        noValidate
        onSubmit={handleSubmit}
      >
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Merge as duplicate</p>
                  <p className="mt-1 text-muted-foreground">
                    Choose the Surviving record. Nothing changes until you
                    confirm the current Merge Preview.
                  </p>
                </div>
                <Button
                  disabled={isSubmitting}
                  onClick={reset}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>

              <form.Field name="survivingWorkId">
                {(field) => (
                  <label
                    className="grid gap-1"
                    htmlFor={`merge-survivor-${work.id}`}
                  >
                    <span className="font-medium">Surviving record</span>
                    <NativeSelect
                      disabled={isSubmitting || candidates.length === 0}
                      id={`merge-survivor-${work.id}`}
                      name={field.name}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                        resetPreview();
                        form.setFieldValue("fieldResolutions", {});
                        setValidationError(null);
                      }}
                      value={field.state.value}
                    >
                      <NativeSelectOption value="">
                        Surviving record
                      </NativeSelectOption>
                      {candidates.map((candidate) => (
                        <NativeSelectOption
                          key={candidate.id}
                          value={candidate.id}
                        >
                          {candidate.key} — {candidate.title}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </label>
                )}
              </form.Field>

              {preview ? (
                <section
                  aria-label="Merge Preview"
                  className="space-y-3"
                  role="status"
                >
                  <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
                    <p className="text-sm font-medium">Merge Preview</p>
                    <p className="mt-1">
                      Surviving record: {preview.survivingWork.key} —{" "}
                      {preview.survivingWork.title}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Duplicate: {preview.duplicateWork.key} —{" "}
                      {preview.duplicateWork.title}
                    </p>
                  </div>

                  <form.Field name="fieldResolutions">
                    {(field) => (
                      <fieldset className="space-y-2">
                        <legend className="font-medium">Field conflicts</legend>
                        {conflictFields.length === 0 ? (
                          <p className="text-muted-foreground">
                            No Field conflicts.
                          </p>
                        ) : (
                          conflictFields.map((conflictField) => (
                            <label
                              className="grid gap-1 rounded-sm border border-border/70 p-2"
                              htmlFor={`merge-field-${work.id}-${conflictField.key}`}
                              key={conflictField.key}
                            >
                              <span className="font-medium">
                                {conflictField.label}
                              </span>
                              <span className="text-muted-foreground">
                                Surviving:{" "}
                                {displayMergeValue(
                                  conflictField.survivingValue,
                                )}
                              </span>
                              <span className="text-muted-foreground">
                                Duplicate:{" "}
                                {displayMergeValue(
                                  conflictField.duplicateValue,
                                )}
                              </span>
                              <NativeSelect
                                aria-label={`${conflictField.label} resolution for ${work.key}`}
                                disabled={isSubmitting}
                                id={`merge-field-${work.id}-${conflictField.key}`}
                                name={`${field.name}.${conflictField.key}`}
                                onChange={(event) => {
                                  const { value } = event.target;
                                  if (!isMergeFieldResolution(value)) {
                                    return;
                                  }
                                  field.handleChange({
                                    ...field.state.value,
                                    [conflictField.key]: value,
                                  });
                                }}
                                value={
                                  field.state.value[conflictField.key] ?? ""
                                }
                              >
                                <NativeSelectOption value="">
                                  Choose a value
                                </NativeSelectOption>
                                <NativeSelectOption value="surviving">
                                  Use surviving record
                                </NativeSelectOption>
                                <NativeSelectOption value="duplicate">
                                  Use duplicate
                                </NativeSelectOption>
                              </NativeSelect>
                            </label>
                          ))
                        )}
                      </fieldset>
                    )}
                  </form.Field>

                  <fieldset className="space-y-1">
                    <legend className="font-medium">
                      Fields without conflicts
                    </legend>
                    {stableFields.map((field) => (
                      <p className="text-muted-foreground" key={field.key}>
                        {field.label}: {displayMergeValue(field.survivingValue)}
                      </p>
                    ))}
                  </fieldset>

                  <fieldset className="space-y-1">
                    <legend className="font-medium">Relations</legend>
                    {preview.relations.length === 0 &&
                    preview.inclusions.length === 0 ? (
                      <p className="text-muted-foreground">No relations yet.</p>
                    ) : (
                      <>
                        {preview.relations.map((relation) => (
                          <p
                            className="text-muted-foreground"
                            key={relation.id}
                          >
                            {relation.action}: {relation.targetLabel}
                          </p>
                        ))}
                        {preview.inclusions.map((inclusion) => (
                          <p
                            className="text-muted-foreground"
                            key={inclusion.childWorkId}
                          >
                            {inclusion.action}: {inclusion.childWorkKey} —{" "}
                            {inclusion.childWorkTitle}
                          </p>
                        ))}
                      </>
                    )}
                  </fieldset>
                </section>
              ) : null}

              {error ? (
                <p className="text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    connection === "offline" ||
                    isSubmitting ||
                    !form.getFieldValue("survivingWorkId")
                  }
                  size="xs"
                  type="submit"
                >
                  {preview ? "Confirm" : "Preview"}
                </Button>
                {preview ? (
                  <Button
                    disabled={isSubmitting}
                    onClick={() => {
                      resetPreview();
                      form.setFieldValue("fieldResolutions", {});
                      setValidationError(null);
                    }}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Edit selection
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </form.Subscribe>
      </form>
    </section>
  );
}
