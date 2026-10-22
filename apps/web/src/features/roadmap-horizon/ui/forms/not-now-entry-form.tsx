// biome-ignore-all lint/performance/noJsxPropsBind: Controls close over one Work and its previewed trail.

import type { WorkContextSource } from "@cantiara/api/work-context";
import {
  recordWorkNotNowInputSchema,
  type WorkNotNowReviewLaterHandling,
} from "@cantiara/api/work-not-now";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { DialogFooter } from "@cantiara/ui/components/dialog";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { ReviewLaterHandlingField } from "../components/not-now-review-later-field";

export interface NotNowDraft {
  condition: string;
  groundRelationIds: string[];
  reason: string;
  reviewLaterHandling: WorkNotNowReviewLaterHandling;
}

export type NotNowPreview = ReturnType<
  typeof recordWorkNotNowInputSchema.parse
>;

export function NotNowEntryForm({
  baseRevision,
  connection,
  draft,
  error,
  hasActiveTrail,
  hasHistory,
  groundOptions,
  workContextError,
  workContextPending,
  onError,
  onShowHistory,
  onPreview,
  onDraftChange,
  pending,
  workId,
}: {
  baseRevision: number;
  connection: string;
  draft: NotNowDraft;
  error: string | null;
  hasActiveTrail: boolean;
  hasHistory: boolean;
  groundOptions: readonly WorkContextSource[];
  workContextError: boolean;
  workContextPending: boolean;
  onError: (error: string | null) => void;
  onShowHistory: () => void;
  onPreview: (preview: NotNowPreview) => void;
  onDraftChange: (update: (draft: NotNowDraft) => NotNowDraft) => void;
  pending: boolean;
  workId: string;
}) {
  const form = useForm({
    defaultValues: {
      condition: draft.condition,
      groundRelationIds: draft.groundRelationIds,
      reason: draft.reason,
      reviewLaterHandling: draft.reviewLaterHandling,
    },
    onSubmit: ({ value }) => {
      const parsed = recordWorkNotNowInputSchema.safeParse({
        baseRevision,
        clientIdempotencyKey: "preview",
        condition: value.condition,
        groundRelationIds: value.groundRelationIds,
        reason: value.reason,
        reviewLaterHandling: value.reviewLaterHandling,
        workId,
      });
      if (!parsed.success) {
        onError(
          parsed.error.issues[0]?.message ?? "Check the Not now details.",
        );
        return;
      }
      onError(null);
      onPreview(parsed.data);
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        return form.handleSubmit();
      }}
    >
      <form.Field name="reason">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={`not-now-reason-${workId}`}>Reason</FieldLabel>
            <Textarea
              disabled={pending}
              id={`not-now-reason-${workId}`}
              maxLength={500}
              onChange={(event) => {
                const { value } = event.target;
                field.handleChange(value);
                onDraftChange((current) => ({ ...current, reason: value }));
              }}
              required
              rows={3}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="condition">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={`not-now-condition-${workId}`}>
              Re-evaluation condition
            </FieldLabel>
            <Textarea
              disabled={pending}
              id={`not-now-condition-${workId}`}
              maxLength={2000}
              onChange={(event) => {
                const { value } = event.target;
                field.handleChange(value);
                onDraftChange((current) => ({ ...current, condition: value }));
              }}
              rows={2}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="groundRelationIds">
        {(field) => (
          <SupportingRecordsField
            groundOptions={groundOptions}
            onChange={(groundRelationIds) => {
              field.handleChange(groundRelationIds);
              onDraftChange((current) => ({ ...current, groundRelationIds }));
            }}
            pending={pending}
            value={field.state.value}
            workContextError={workContextError}
            workContextPending={workContextPending}
          />
        )}
      </form.Field>
      {hasActiveTrail ? (
        <form.Field name="reviewLaterHandling">
          {(field) => (
            <ReviewLaterHandlingField
              name={`not-now-review-later-handling-${workId}`}
              onChange={(reviewLaterHandling) => {
                field.handleChange(reviewLaterHandling);
                onDraftChange((current) => ({
                  ...current,
                  reviewLaterHandling,
                }));
              }}
              pending={pending}
              value={field.state.value}
            />
          )}
        </form.Field>
      ) : null}
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        {hasHistory ? (
          <Button
            disabled={pending}
            onClick={onShowHistory}
            type="button"
            variant="outline"
          >
            History
          </Button>
        ) : null}
        <Button disabled={pending || connection === "offline"} type="submit">
          Preview
        </Button>
      </DialogFooter>
    </form>
  );
}

function SupportingRecordsField({
  groundOptions,
  onChange,
  pending,
  value,
  workContextError,
  workContextPending,
}: {
  groundOptions: readonly WorkContextSource[];
  onChange: (groundRelationIds: string[]) => void;
  pending: boolean;
  value: string[];
  workContextError: boolean;
  workContextPending: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={pending}>
      <legend className="font-medium text-xs">Supporting records</legend>
      {workContextPending ? (
        <p className="text-muted-foreground text-xs" role="status">
          Loading supporting records…
        </p>
      ) : null}
      {workContextError ? (
        <p className="text-destructive text-xs" role="alert">
          Supporting records could not be loaded.
        </p>
      ) : null}
      {!(workContextPending || workContextError) &&
      groundOptions.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No supporting records are linked to this Work.
        </p>
      ) : null}
      {groundOptions.map((source) => {
        const { relationId } = source;
        if (relationId === null) {
          return null;
        }
        return (
          <label
            className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-xs"
            htmlFor={`not-now-ground-${relationId}`}
            key={relationId}
          >
            <Checkbox
              checked={value.includes(relationId)}
              id={`not-now-ground-${relationId}`}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...value, relationId]
                    : value.filter((id) => id !== relationId),
                )
              }
            />
            <span>
              {source.recordType}: {source.title ?? source.label}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
