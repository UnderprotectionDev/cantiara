// biome-ignore-all lint/performance/noJsxPropsBind: Field render props close over the current recreate form state.
import type {
  WorkProfile,
  WorkRecreateField,
  WorkRecreatePreview,
} from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  runOnlineOnlyWrite,
  useClientShellConnection,
} from "@/features/web-macos-client/views/client-shell";
import { client, orpc, projectsQueryOptions } from "@/utils/orpc";

function recreateErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Work could not be recreated. Try again.";
}

function recreateFieldValue(field: WorkRecreatePreview["fields"][number]) {
  if (field.key === "checklist") {
    const itemCount = Array.isArray(field.value) ? field.value.length : 0;
    return `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  }
  return typeof field.value === "string" && field.value ? field.value : "Empty";
}

function updateSelection<T>(values: T[], value: T, checked: boolean) {
  return checked
    ? [...new Set([...values, value])]
    : values.filter((candidate) => candidate !== value);
}

export default function WorkRecreateForm({ work }: { work: WorkProfile }) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const projectsQuery = useQuery(projectsQueryOptions());
  const targetProjects = useMemo(
    () =>
      (projectsQuery.data ?? []).filter(
        (project) =>
          project.id !== work.projectId && project.status === "Active",
      ),
    [projectsQuery.data, work.projectId],
  );
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<WorkRecreatePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recreatedKey, setRecreatedKey] = useState<string | null>(null);
  const pendingRecreate = useRef<{
    clientIdempotencyKey: string;
    selection: string;
  } | null>(null);

  const form = useForm({
    defaultValues: {
      selectedFields: [] as WorkRecreateField[],
      selectedRelationIds: [] as string[],
      targetProjectId: "",
    },
    onSubmit: async ({ value }) => {
      try {
        setError(null);
        if (!preview) {
          const nextPreview = await client.workRecreatePreview({
            sourceWorkId: work.id,
            targetProjectId: value.targetProjectId,
          });
          setPreview(nextPreview);
          pendingRecreate.current = null;
          form.setFieldValue(
            "selectedFields",
            nextPreview.fields
              .filter((field) => field.selectedByDefault)
              .map((field) => field.key),
          );
          form.setFieldValue("selectedRelationIds", []);
          return;
        }

        const selection = JSON.stringify({
          previewId: preview.previewId,
          selectedFields: [...value.selectedFields].sort(),
          selectedRelationIds: [...value.selectedRelationIds].sort(),
        });
        const pending = pendingRecreate.current;
        const clientIdempotencyKey =
          pending?.selection === selection
            ? pending.clientIdempotencyKey
            : crypto.randomUUID();
        pendingRecreate.current = { clientIdempotencyKey, selection };
        const recreatedWork = await runOnlineOnlyWrite(() =>
          client.recreateWork({
            baseRevision: 0,
            clientIdempotencyKey,
            previewId: preview.previewId,
            selectedFields: value.selectedFields,
            selectedRelationIds: value.selectedRelationIds,
            sourceWorkId: work.id,
            targetProjectId: preview.targetProject.id,
          }),
        );
        pendingRecreate.current = null;
        setRecreatedKey(recreatedWork.key);
        setPreview(null);
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryOptions({
              input: { projectId: work.projectId },
            }).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.projectWorks.queryOptions({
              input: { projectId: recreatedWork.projectId },
            }).queryKey,
          }),
          queryClient.invalidateQueries({
            queryKey: projectsQueryOptions().queryKey,
          }),
        ]);
      } catch (submitError) {
        setError(recreateErrorMessage(submitError));
      }
    },
  });

  useEffect(() => {
    const currentProjectId = form.getFieldValue("targetProjectId");
    if (
      currentProjectId &&
      targetProjects.some((project) => project.id === currentProjectId)
    ) {
      return;
    }
    form.setFieldValue("targetProjectId", targetProjects[0]?.id ?? "");
  }, [form, targetProjects]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  if (!open) {
    return (
      <Button
        disabled={connection === "offline"}
        onClick={() => setOpen(true)}
        size="xs"
        type="button"
        variant="outline"
      >
        Recreate in another Project
      </Button>
    );
  }

  return (
    <section aria-label={`Recreate ${work.key}`}>
      <form
        className="w-full space-y-3 border bg-muted/20 p-3 text-left text-xs"
        noValidate
        onSubmit={handleSubmit}
      >
        <p className="font-medium text-sm">Recreate in another Project</p>
        {recreatedKey ? (
          <p role="status">Work {recreatedKey} was recreated.</p>
        ) : null}
        {error ? (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <form.Field name="targetProjectId">
          {(field) => (
            <label
              className="grid gap-1"
              htmlFor={`recreate-project-${work.id}`}
            >
              <span>Project</span>
              <NativeSelect
                id={`recreate-project-${work.id}`}
                name={field.name}
                onChange={(event) => {
                  field.handleChange(event.target.value);
                  setPreview(null);
                  setRecreatedKey(null);
                  pendingRecreate.current = null;
                }}
                value={field.state.value}
              >
                {targetProjects.map((project) => (
                  <NativeSelectOption key={project.id} value={project.id}>
                    {project.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
          )}
        </form.Field>
        {targetProjects.length === 0 ? (
          <p className="text-muted-foreground">
            Another active Project is required.
          </p>
        ) : null}
        {preview ? (
          <section aria-label="Recreate preview" className="space-y-3">
            <p>
              Target Project: <strong>{preview.targetProject.name}</strong>
            </p>
            <form.Field name="selectedFields">
              {(field) => (
                <fieldset className="space-y-2">
                  <legend className="font-medium">Portable content</legend>
                  {preview.fields.map((candidate) => (
                    <label
                      className="flex items-start gap-2"
                      htmlFor={`recreate-field-${work.id}-${candidate.key}`}
                      key={candidate.key}
                    >
                      <Checkbox
                        checked={field.state.value.includes(candidate.key)}
                        id={`recreate-field-${work.id}-${candidate.key}`}
                        onCheckedChange={(checked) =>
                          field.handleChange(
                            updateSelection(
                              field.state.value,
                              candidate.key,
                              checked,
                            ),
                          )
                        }
                      />
                      <span>
                        <strong>{candidate.label}</strong>:{" "}
                        {recreateFieldValue(candidate)}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </form.Field>
            <form.Field name="selectedRelationIds">
              {(field) => (
                <fieldset className="space-y-2">
                  <legend className="font-medium">Relations</legend>
                  {preview.relations.length === 0 ? (
                    <p className="text-muted-foreground">No relations yet.</p>
                  ) : (
                    preview.relations.map((relation) => (
                      <label
                        className="flex items-start gap-2"
                        htmlFor={`recreate-relation-${work.id}-${relation.id}`}
                        key={relation.id}
                      >
                        <Checkbox
                          checked={field.state.value.includes(relation.id)}
                          disabled={!relation.portable}
                          id={`recreate-relation-${work.id}-${relation.id}`}
                          onCheckedChange={(checked) =>
                            field.handleChange(
                              updateSelection(
                                field.state.value,
                                relation.id,
                                checked,
                              ),
                            )
                          }
                        />
                        <span>
                          <strong>{relation.label}</strong>:{" "}
                          {relation.targetLabel} ({relation.targetProjectName})
                          {relation.nonPortableReason
                            ? ` — ${relation.nonPortableReason}`
                            : ""}
                        </span>
                      </label>
                    ))
                  )}
                </fieldset>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.selectedFields}>
              {(selectedFields) => (
                <>
                  {selectedFields.includes("title") ? null : (
                    <p className="text-destructive" role="alert">
                      Title must be selected.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      disabled={!selectedFields.includes("title")}
                      size="xs"
                      type="submit"
                    >
                      Confirm
                    </Button>
                    <Button
                      onClick={() => setPreview(null)}
                      size="xs"
                      type="button"
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </form.Subscribe>
          </section>
        ) : (
          <form.Subscribe
            selector={(state) => ({
              isSubmitting: state.isSubmitting,
              targetProjectId: state.values.targetProjectId,
            })}
          >
            {({ isSubmitting, targetProjectId }) => (
              <div className="flex gap-2">
                <Button
                  disabled={!targetProjectId || isSubmitting}
                  size="xs"
                  type="submit"
                >
                  Preview
                </Button>
                <Button
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                    setRecreatedKey(null);
                  }}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            )}
          </form.Subscribe>
        )}
      </form>
    </section>
  );
}
