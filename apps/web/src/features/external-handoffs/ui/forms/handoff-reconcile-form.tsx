// biome-ignore-all lint/performance/noJsxPropsBind: Work-owned handoff controls close over their Work and form state.

import {
  type ConfirmExternalExecutionHandoffReconcileInput,
  confirmExternalExecutionHandoffReconcileInputSchema,
  type ExternalExecutionHandoffReconcilePreview,
  type ExternalExecutionHandoffRelatedWork,
  type PreviewExternalExecutionHandoffReconcileInput,
  previewExternalExecutionHandoffReconcileInputSchema,
} from "@cantiara/api/external-handoffs";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { errorMessage } from "../../lib/error-message";
import { HandoffFollowUpFields } from "../components/handoff-follow-up-fields";
import { HandoffRelationFields } from "../components/handoff-relation-fields";

type RelationDraft =
  PreviewExternalExecutionHandoffReconcileInput["proposedRelations"][number];
type FollowUpWorkDraft =
  PreviewExternalExecutionHandoffReconcileInput["followUpWorks"][number];

const DEFAULT_VALUES = {
  followUpWorks: [] as FollowUpWorkDraft[],
  relations: [] as RelationDraft[],
  selectedFollowUpWorkIds: [] as string[],
  selectedRelationIds: [] as string[],
};

/**
 * Reconcile: proposed relations and Follow-up Work are edited, previewed, then
 * confirmed. The first submit previews; the second confirms the previewed plan.
 */
export function HandoffReconcileForm({
  disabled,
  handoffId,
  onConfirm,
  onPreview,
  relatedWorks,
  workKey,
}: {
  disabled: boolean;
  handoffId: string;
  onConfirm: (
    input: ConfirmExternalExecutionHandoffReconcileInput,
  ) => Promise<unknown>;
  onPreview: (
    input: PreviewExternalExecutionHandoffReconcileInput,
  ) => Promise<ExternalExecutionHandoffReconcilePreview>;
  relatedWorks: readonly ExternalExecutionHandoffRelatedWork[];
  workKey: string;
}) {
  const [preview, setPreview] =
    useState<ExternalExecutionHandoffReconcilePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: DEFAULT_VALUES,
    onSubmit: async ({ value }) => {
      setError(null);
      const plan = {
        followUpWorks: value.followUpWorks.map((item) => ({
          ...item,
          description: item.description?.trim() || null,
          title: item.title.trim(),
        })),
        handoffId,
        proposedRelations: value.relations,
      };
      if (!preview) {
        const parsed =
          previewExternalExecutionHandoffReconcileInputSchema.safeParse(plan);
        if (!parsed.success) {
          // Preview changes stays disabled for an untitled Follow-up Work; only
          // the API's own duplicate-proposal messages remain to show.
          const issue = parsed.error.issues.find(
            ({ code }) => code === "custom",
          );
          setError(issue?.message ?? null);
          return;
        }
        try {
          const nextPreview = await onPreview(parsed.data);
          setPreview(nextPreview);
          form.setFieldValue(
            "selectedRelationIds",
            nextPreview.proposedRelations.map(({ id }) => id),
          );
          form.setFieldValue(
            "selectedFollowUpWorkIds",
            nextPreview.followUpWorks.map(({ id }) => id),
          );
        } catch (previewError) {
          setError(errorMessage(previewError));
        }
        return;
      }
      const parsed =
        confirmExternalExecutionHandoffReconcileInputSchema.safeParse({
          ...plan,
          clientEventId: crypto.randomUUID(),
          previewId: preview.previewId,
          selectedFollowUpWorkIds: value.selectedFollowUpWorkIds,
          selectedRelationIds: value.selectedRelationIds,
        });
      // The checkboxes only offer items shown in the preview.
      if (!parsed.success) {
        return;
      }
      try {
        await onConfirm(parsed.data);
        setPreview(null);
      } catch (confirmError) {
        setError(errorMessage(confirmError));
      }
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <details className="rounded-sm border border-border/70 bg-card/45">
      <summary className="cursor-pointer px-3 py-2 font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Reconcile
      </summary>
      <form
        className="space-y-3 border-border/70 border-t p-3"
        noValidate
        onSubmit={submit}
      >
        {preview ? (
          <section aria-label="Reconcile" className="space-y-3">
            <p className="text-muted-foreground text-xs">
              Review each relation and Follow-up Work before confirming.
            </p>
            <form.Field name="selectedRelationIds">
              {(field) => (
                <>
                  {preview.proposedRelations.map((relation) => (
                    <label
                      className="flex items-start gap-2 text-xs"
                      htmlFor={`handoff-relation-${relation.id}`}
                      key={relation.id}
                    >
                      <Checkbox
                        checked={field.state.value.includes(relation.id)}
                        disabled={disabled}
                        id={`handoff-relation-${relation.id}`}
                        onCheckedChange={(checked) =>
                          field.handleChange(
                            checked === true
                              ? [...field.state.value, relation.id]
                              : field.state.value.filter(
                                  (id) => id !== relation.id,
                                ),
                          )
                        }
                      />
                      <span>
                        {relation.kind} {relation.target.key} ·{" "}
                        {relation.target.title}
                      </span>
                    </label>
                  ))}
                </>
              )}
            </form.Field>
            <form.Field name="selectedFollowUpWorkIds">
              {(field) => (
                <>
                  {preview.followUpWorks.map((followUpWork) => (
                    <label
                      className="flex items-start gap-2 text-xs"
                      htmlFor={`handoff-follow-up-${followUpWork.id}`}
                      key={followUpWork.id}
                    >
                      <Checkbox
                        checked={field.state.value.includes(followUpWork.id)}
                        disabled={disabled}
                        id={`handoff-follow-up-${followUpWork.id}`}
                        onCheckedChange={(checked) =>
                          field.handleChange(
                            checked === true
                              ? [...field.state.value, followUpWork.id]
                              : field.state.value.filter(
                                  (id) => id !== followUpWork.id,
                                ),
                          )
                        }
                      />
                      <span>
                        Follow-up Work · {followUpWork.title} (
                        {followUpWork.type}) · Origin {workKey}
                        {followUpWork.description
                          ? ` · ${followUpWork.description}`
                          : ""}
                      </span>
                    </label>
                  ))}
                </>
              )}
            </form.Field>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled}
                onClick={() => {
                  setError(null);
                  setPreview(null);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Reject
              </Button>
              <Button disabled={disabled} size="sm" type="submit">
                Reconcile
              </Button>
            </div>
          </section>
        ) : (
          <>
            <form.Field name="relations">
              {(field) => (
                <HandoffRelationFields
                  disabled={disabled}
                  onChange={field.handleChange}
                  relatedWorks={relatedWorks}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Field name="followUpWorks">
              {(field) => (
                <HandoffFollowUpFields
                  disabled={disabled}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.followUpWorks}>
              {(followUpWorks) => (
                <Button
                  disabled={
                    disabled ||
                    followUpWorks.some((item) => item.title.trim() === "")
                  }
                  size="sm"
                  type="submit"
                >
                  Preview changes
                </Button>
              )}
            </form.Subscribe>
          </>
        )}
        {error ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </details>
  );
}
