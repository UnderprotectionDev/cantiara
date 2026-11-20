// biome-ignore-all lint/performance/noJsxPropsBind: Layout controls close over their current section and draft state.

import {
  type ProjectShellConfiguration,
  workContextLayoutChangeSchema,
} from "@cantiara/api/project-shell";
import {
  cloneWorkContextLayout,
  getWorkContextLayout,
  WORK_CONTEXT_INITIAL_FIELDS,
  type WorkContextCustomSection,
  type WorkContextCustomSectionCondition,
  type WorkContextLayout,
} from "@cantiara/api/work-context";
import { WORK_TYPE_OPTIONS, type WorkType } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { fetchFresh } from "@/lib/fetch-fresh";
import { submitForm } from "@/lib/submit-form";

import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import { WorkContextCustomSectionForm } from "../forms/work-context-custom-section-form";

export default function WorkContextCardLayoutEditor({
  baseRevision,
  configuration,
  disabled,
  error,
  projectId,
}: {
  baseRevision: number;
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: {
      workType: "Feature" as WorkType,
      layout: getWorkContextLayout("Feature", configuration.workContextLayouts),
    },
    onSubmitMeta: { action: "preview" } as { action: "preview" | "confirm" },
    onSubmit: async ({ value, meta }) => {
      const parsed = workContextLayoutChangeSchema.safeParse({
        kind: "set-work-context-layout",
        layout: value.layout,
        workType: value.workType,
      });
      if (!parsed.success) {
        setValidationError(
          parsed.error.issues[0]?.message ??
            "Check the Work Context Card layout.",
        );
        return;
      }
      if (meta.action === "confirm") {
        if (preview) {
          await applyMutation.mutateAsync(parsed.data);
        }
        return;
      }
      applyMutation.reset();
      undoMutation.reset();
      await previewMutation.mutateAsync({
        baseRevision: currentRevision,
        change: parsed.data,
        projectId,
      });
    },
  });
  const { workType, layout: draft } = useSelector(
    form.store,
    (state) => state.values,
  );
  const validationError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const submitting = useSelector(form.store, (state) => state.isSubmitting);

  function setValidationError(message: string | null) {
    form.setErrorMap({
      onSubmit: message ? { form: message, fields: {} } : undefined,
    });
  }

  const committedLayout = useMemo(
    () => getWorkContextLayout(workType, configuration.workContextLayouts),
    [configuration.workContextLayouts, workType],
  );
  const isDirty = JSON.stringify(draft) !== JSON.stringify(committedLayout);
  const projectQueryKey = orpc.project.queryOptions({
    input: { projectId },
  }).queryKey;

  useEffect(() => {
    form.setFieldValue("layout", cloneWorkContextLayout(committedLayout), {
      dontUpdateMeta: true,
    });
  }, [committedLayout, form]);

  const previewMutation = useMutation({
    mutationKey: orpc.previewWorkContextLayout.mutationKey(),
    mutationFn: (
      input: Parameters<typeof client.previewWorkContextLayout>[0],
    ) =>
      fetchFresh(queryClient, {
        ...orpc.previewWorkContextLayout.queryOptions({ input }),
        gcTime: 0,
      }),
    meta: { presentsSupportFailure: true },
  });

  const applyMutation = usePreparedMutation(
    orpc.updateProjectConfiguration.mutationOptions({
      mutationFn: (input) => client.updateProjectConfiguration(input),
      onSuccess: async (nextProject) => {
        previewMutation.reset();
        queryClient.setQueryData(projectQueryKey, nextProject);
        await queryClient.invalidateQueries({ queryKey: projectQueryKey });
      },
    }),
    (
      change: Parameters<typeof client.previewWorkContextLayout>[0]["change"],
    ) => ({
      baseRevision: currentRevision,
      change,
      projectId,
    }),
  );

  const undoMutation = usePreparedMutation(
    orpc.undoWorkContextLayout.mutationOptions({
      mutationFn: (input) => client.undoWorkContextLayout(input),
      onSuccess: async (nextProject) => {
        applyMutation.reset();
        queryClient.setQueryData(projectQueryKey, nextProject);
        await queryClient.invalidateQueries({ queryKey: projectQueryKey });
      },
    }),
    (receipt: string) => ({
      baseRevision: currentRevision,
      projectId,
      receiptId: receipt,
    }),
  );

  const currentRevision = Math.max(
    baseRevision,
    applyMutation.data?.revision ?? 0,
    undoMutation.data?.revision ?? 0,
  );
  const applied = applyMutation.data;
  const receiptId =
    applied && "receiptId" in applied ? applied.receiptId : null;
  const preview =
    previewMutation.variables?.baseRevision === currentRevision
      ? previewMutation.data?.preview
      : undefined;
  let localError = validationError;
  if (previewMutation.isError) {
    localError = errorMessage(
      previewMutation.error,
      "Preview could not be loaded.",
    );
  }
  if (applyMutation.isError) {
    localError = errorMessage(
      applyMutation.error,
      "Work Context Card layout could not be changed.",
    );
  }
  if (undoMutation.isError) {
    localError = errorMessage(
      undoMutation.error,
      "Work Context Card layout could not be undone.",
    );
  }

  function resetLayoutActions() {
    previewMutation.reset();
    applyMutation.reset();
    undoMutation.reset();
    setValidationError(null);
  }
  const busy =
    disabled ||
    submitting ||
    previewMutation.isPending ||
    applyMutation.isPending ||
    undoMutation.isPending;

  function updateDraft(
    updater: (current: WorkContextLayout) => WorkContextLayout,
  ) {
    form.setFieldValue("layout", (current) =>
      updater(cloneWorkContextLayout(current)),
    );
    resetLayoutActions();
  }

  function toggleSection(sectionKey: string) {
    updateDraft((current) => ({
      ...current,
      hiddenSections: current.hiddenSections.includes(sectionKey)
        ? current.hiddenSections.filter((key) => key !== sectionKey)
        : [...current.hiddenSections, sectionKey],
    }));
  }

  function moveSection(sectionKey: string, direction: -1 | 1) {
    const index = draft.sectionOrder.indexOf(sectionKey);
    const nextIndex = index + direction;
    if (index >= 0 && nextIndex >= 0 && nextIndex < draft.sectionOrder.length) {
      form.moveFieldValues("layout.sectionOrder", index, nextIndex);
      resetLayoutActions();
    }
  }

  function addCustomSection(section: WorkContextCustomSection) {
    updateDraft((current) => ({
      ...current,
      customSections: [...current.customSections, section],
      sectionOrder: [...current.sectionOrder, section.id],
    }));
  }

  const customSections = new Map(
    draft.customSections.map((section) => [section.id, section]),
  );
  const sectionLabels = new Map(
    draft.sectionOrder.map((key) => [
      key,
      customSections.get(key)?.title ?? key,
    ]),
  );

  return (
    <div className="mt-3 space-y-5">
      <p className="text-xs/relaxed text-muted-foreground">
        Configure the same Work Context Card presentation for every Work of a
        selected type. Work fields, relations, status semantics, and evidence
        stay unchanged.
      </p>
      <label
        className="grid max-w-xs gap-1 text-xs"
        htmlFor="work-context-layout-type"
      >
        Work type
        <NativeSelect
          disabled={busy}
          id="work-context-layout-type"
          onChange={(event) => {
            resetLayoutActions();
            form.setFieldValue("workType", event.target.value as WorkType);
          }}
          value={workType}
        >
          {WORK_TYPE_OPTIONS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </label>

      <section aria-labelledby="work-context-section-order-heading">
        <h5
          className="text-sm font-medium"
          id="work-context-section-order-heading"
        >
          Sections
        </h5>
        <ul aria-label="Work Context Card sections" className="mt-2 space-y-2">
          {draft.sectionOrder.map((sectionKey, index) => {
            const custom = customSections.get(sectionKey);
            const label = sectionLabels.get(sectionKey) ?? sectionKey;
            const hidden = draft.hiddenSections.includes(sectionKey);
            return (
              <li
                className="flex flex-wrap items-center gap-2 border bg-background p-3"
                key={sectionKey}
              >
                <div className="min-w-48 flex-1">
                  <p
                    className={
                      hidden
                        ? "text-sm text-muted-foreground line-through"
                        : "text-sm"
                    }
                  >
                    {label}
                  </p>
                  {custom ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Custom · {conditionLabel(custom.condition)}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prepared section
                    </p>
                  )}
                </div>
                <Button
                  aria-label={`${hidden ? "Show" : "Hide"} ${label}`}
                  disabled={busy}
                  onClick={() => toggleSection(sectionKey)}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  {hidden ? "Show" : "Hide"}
                </Button>
                <Button
                  aria-label={`Move up ${label}`}
                  disabled={busy || index === 0}
                  onClick={() => moveSection(sectionKey, -1)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  ↑
                </Button>
                <Button
                  aria-label={`Move down ${label}`}
                  disabled={busy || index === draft.sectionOrder.length - 1}
                  onClick={() => moveSection(sectionKey, 1)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  ↓
                </Button>
              </li>
            );
          })}
        </ul>
      </section>

      <WorkContextCustomSectionForm
        busy={busy}
        onAdd={addCustomSection}
        onError={setValidationError}
      />

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!busy && isDirty) {
            submitForm(form, { action: "preview" }).catch(() => undefined);
          }
        }}
      >
        <Button disabled={busy || !isDirty} type="submit" variant="outline">
          Preview
        </Button>
        <Button
          disabled={busy || !isDirty || !preview}
          onClick={() =>
            submitForm(form, { action: "confirm" }).catch(() => undefined)
          }
          type="button"
        >
          Confirm
        </Button>
        {receiptId ? (
          <Button
            disabled={busy}
            onClick={() => undoMutation.mutate(receiptId)}
            type="button"
            variant="outline"
          >
            Undo
          </Button>
        ) : null}
      </form>

      {preview ? (
        <div
          aria-label="Layout preview"
          className="space-y-2 border border-primary/25 bg-primary/5 p-3 text-sm"
          role="status"
        >
          <p className="font-medium">Layout preview</p>
          <p className="text-muted-foreground">
            Affected Work type: {workType}
          </p>
          <p className="text-muted-foreground">
            Added: {preview.added.join(", ") || "None"}
          </p>
          <p className="text-muted-foreground">
            Hidden: {preview.hidden.join(", ") || "None"}
          </p>
          <p className="text-muted-foreground">
            Shown: {preview.shown.join(", ") || "None"}
          </p>
          <p className="text-muted-foreground">
            Moved: {preview.moved.join(", ") || "None"}
          </p>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Initial Work fields: {WORK_CONTEXT_INITIAL_FIELDS.join(", ")}
      </p>
      <ConfigurationMutationError error={error ?? localError ?? null} />
    </div>
  );
}

function conditionLabel(condition: WorkContextCustomSectionCondition) {
  switch (condition.kind) {
    case "record-type":
      return `${condition.recordType}${condition.status ? ` · ${condition.status}` : ""}`;
    case "relation":
      return `${condition.relation}${condition.status ? ` · ${condition.status}` : ""}`;
    case "evidence-role":
      return `${condition.evidenceRole}${condition.status ? ` · ${condition.status}` : ""}`;
    default:
      throw new Error("Unsupported Work Context Card condition.");
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function ConfigurationMutationError({ error }: { error: string | null }) {
  return error ? (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  ) : null;
}
