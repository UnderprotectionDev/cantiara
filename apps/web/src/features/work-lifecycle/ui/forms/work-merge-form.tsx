// biome-ignore-all lint/performance/noJsxPropsBind: Merge controls close over their current Work and preview state.

import type {
  WorkMergeField,
  WorkMergePreview,
  WorkMergeResolution,
  WorkMergeResult,
  WorkProfile,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

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
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<WorkMergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      fieldResolutions: {} as Partial<
        Record<WorkMergeField, WorkMergeResolution>
      >,
      survivingWorkId: candidates[0]?.id ?? "",
    },
    onSubmit: async ({ value }) => {
      if (!value.survivingWorkId) {
        return;
      }
      setError(null);
      try {
        if (!preview) {
          const nextPreview = await client.workMergePreview({
            duplicateWorkId: work.id,
            survivingWorkId: value.survivingWorkId,
          });
          setPreview(nextPreview);
          form.setFieldValue("fieldResolutions", {});
          return;
        }

        const unresolvedFields = preview.fields.filter(
          (field) => field.conflict && !value.fieldResolutions[field.key],
        );
        if (unresolvedFields.length > 0) {
          setError("Resolve every Field conflict before confirming the merge.");
          return;
        }

        const result = await runOnlineOnlyWrite(() =>
          client.mergeWork({
            baseRevision: preview.survivingWork.revision,
            clientIdempotencyKey: crypto.randomUUID(),
            duplicateRevision: preview.duplicateWork.revision,
            duplicateWorkId: preview.duplicateWork.id,
            fieldResolutions: value.fieldResolutions,
            previewId: preview.previewId,
            survivingWorkId: preview.survivingWork.id,
          }),
        );
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryOptions({
              input: { archived: false, projectId: work.projectId },
            }).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryOptions({
              input: { archived: true, projectId: work.projectId },
            }).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.work.queryOptions({
              input: { workId: preview.survivingWork.id },
            }).queryKey,
          }),
        ]);
        onMerged?.(result);
        reset();
      } catch (submitError) {
        setError(mergeErrorMessage(submitError));
      }
    },
  });

  function reset() {
    setOpen(false);
    setPreview(null);
    setError(null);
    form.reset();
    form.setFieldValue("survivingWorkId", candidates[0]?.id ?? "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
                  <p className="font-medium text-sm">Merge as duplicate</p>
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
                        setPreview(null);
                        form.setFieldValue("fieldResolutions", {});
                        setError(null);
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
                    <p className="font-medium text-sm">Merge Preview</p>
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
                      setPreview(null);
                      form.setFieldValue("fieldResolutions", {});
                      setError(null);
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
