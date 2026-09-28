// biome-ignore-all lint/performance/noJsxPropsBind: Milestone controls bind to the current Project and record.

import type { RelationPreview, RelationView } from "@cantiara/api/relations";
import type { Milestone } from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Calendar } from "@cantiara/ui/components/calendar";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { type FormEvent, useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";

interface MilestoneDraft {
  description: string;
  targetDate: string;
  title: string;
}

const EMPTY_DRAFT: MilestoneDraft = {
  description: "",
  targetDate: "",
  title: "",
};

function milestoneDraft(milestone: Milestone): MilestoneDraft {
  return {
    description: milestone.description ?? "",
    targetDate: milestone.targetDate ?? "",
    title: milestone.title,
  };
}

function invalidateMilestones(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: orpc.projectMilestones.queryOptions({
        input: { projectId },
      }).queryKey,
    }),
    queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
  ]);
}

function MilestoneTargetDatePicker({
  disabled,
  id,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseISO(value) : undefined;
  const validSelectedDate =
    selectedDate && !Number.isNaN(selectedDate.getTime())
      ? selectedDate
      : undefined;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-label="Target date"
            className="w-full justify-between font-normal"
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
          />
        }
      >
        {value || "Choose a calendar date."}
        <CalendarDays aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto min-w-72">
        <Calendar
          defaultMonth={validSelectedDate}
          mode="single"
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          selected={validSelectedDate}
        />
        {value ? (
          <Button
            className="w-full"
            disabled={disabled}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            size="xs"
            type="button"
            variant="ghost"
          >
            Clear date
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function MilestoneEditor({
  className,
  error,
  initialValues,
  onCancel,
  onSave,
  prefix,
  submitLabel,
}: {
  className: string;
  error: boolean;
  initialValues: MilestoneDraft;
  onCancel?: () => void;
  onSave: (draft: MilestoneDraft) => Promise<unknown>;
  prefix: string;
  submitLabel: string;
}) {
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      await onSave({
        ...value,
        description: value.description.trim(),
      });
      form.reset(initialValues);
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <div className="grid gap-3 sm:grid-cols-2">
            <form.Field name="title">
              {(field) => (
                <label
                  className="grid gap-1 text-sm"
                  htmlFor={`${prefix}-title`}
                >
                  Title
                  <Input
                    disabled={isSubmitting}
                    id={`${prefix}-title`}
                    maxLength={255}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name="targetDate">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={`${prefix}-target-date`}>
                    Target date
                  </FieldLabel>
                  <MilestoneTargetDatePicker
                    disabled={isSubmitting}
                    id={`${prefix}-target-date`}
                    onChange={field.handleChange}
                    value={field.state.value}
                  />
                </Field>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <label
                  className="grid gap-1 text-sm sm:col-span-2"
                  htmlFor={`${prefix}-description`}
                >
                  Description
                  <Textarea
                    disabled={isSubmitting}
                    id={`${prefix}-description`}
                    maxLength={20_000}
                    name={field.name}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </label>
              )}
            </form.Field>
          </div>
        )}
      </form.Subscribe>
      <div className="flex gap-2">
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={isSubmitting} type="submit">
              {submitLabel}
            </Button>
          )}
        </form.Subscribe>
        {onCancel ? (
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                disabled={isSubmitting}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            )}
          </form.Subscribe>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          This action could not be completed.
        </p>
      ) : null}
    </form>
  );
}

function MilestoneCard({
  milestone,
  projectId,
  works,
}: {
  milestone: Milestone;
  projectId: string;
  works: WorkProfile[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [selectedWorkId, setSelectedWorkId] = useState(works[0]?.id ?? "");
  const [preview, setPreview] = useState<RelationPreview | null>(null);
  const [relationIdempotencyKey, setRelationIdempotencyKey] = useState<
    string | null
  >(null);
  const relationsQuery = useQuery(
    orpc.relations.queryOptions({
      input: { recordId: milestone.id, recordType: "Milestone" },
    }),
  );
  const updateMutation = useMutation({
    mutationFn: (draft: MilestoneDraft) =>
      runOnlineOnlyWrite(() =>
        client.updateMilestone({
          baseRevision: milestone.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          description: draft.description || null,
          milestoneId: milestone.id,
          projectId,
          targetDate: draft.targetDate || null,
          title: draft.title,
        }),
      ),
    onSuccess: async () => {
      setEditing(false);
      await invalidateMilestones(queryClient, projectId);
    },
  });
  const statusMutation = useMutation({
    mutationFn: (status: "Reached" | "Abandoned") =>
      runOnlineOnlyWrite(() =>
        client.updateMilestoneStatus({
          baseRevision: milestone.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          milestoneId: milestone.id,
          projectId,
          status,
        }),
      ),
    onSuccess: () => invalidateMilestones(queryClient, projectId),
  });
  const relationPreviewMutation = useMutation({
    mutationFn: () =>
      client.relationPreview({
        kind: "Contributes to Milestone",
        source: { recordId: selectedWorkId, recordType: "Work" },
        target: { recordId: milestone.id, recordType: "Milestone" },
      }),
    onSuccess: (nextPreview) => {
      setPreview(nextPreview);
      setRelationIdempotencyKey(crypto.randomUUID());
    },
  });
  const relationCreateMutation = useMutation({
    mutationFn: () => {
      if (!(preview && relationIdempotencyKey)) {
        throw new Error("Review the relation before confirming.");
      }
      return runOnlineOnlyWrite(() =>
        client.createRelation({
          baseRevision: preview.baseRevision,
          clientIdempotencyKey: relationIdempotencyKey,
          kind: preview.kind,
          previewId: preview.previewId,
          source: {
            recordId: preview.source.recordId,
            recordType: preview.source.recordType,
          },
          target: {
            recordId: preview.target.recordId,
            recordType: preview.target.recordType,
          },
        }),
      );
    },
    onSuccess: async () => {
      setPreview(null);
      setRelationIdempotencyKey(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.relations.queryOptions({
            input: { recordId: milestone.id, recordType: "Milestone" },
          }).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: orpc.relations.queryOptions({
            input: { recordId: selectedWorkId, recordType: "Work" },
          }).queryKey,
        }),
      ]);
    },
  });

  const linkedWorks = (relationsQuery.data ?? []).filter(
    (relation: RelationView) => relation.kind === "Contributes to Milestone",
  );

  return (
    <article
      className="grid gap-4 rounded-lg border bg-card p-4"
      id={milestone.id}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-muted-foreground text-xs">
            Milestone · {milestone.status}
          </p>
          <h3 className="font-medium">{milestone.title}</h3>
          {milestone.targetDate ? (
            <p className="text-muted-foreground text-sm">
              Target date · {milestone.targetDate}
            </p>
          ) : null}
          {milestone.description ? (
            <p className="text-muted-foreground text-sm">
              {milestone.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setEditing(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            Edit
          </Button>
          {milestone.status === "Planned" ? (
            <>
              <Button
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("Reached")}
                size="sm"
                type="button"
              >
                Reach
              </Button>
              <Button
                disabled={statusMutation.isPending}
                onClick={() => statusMutation.mutate("Abandoned")}
                size="sm"
                type="button"
                variant="outline"
              >
                Abandon
              </Button>
            </>
          ) : null}
        </div>
      </header>

      {editing ? (
        <MilestoneEditor
          className="grid gap-3 border-t pt-4"
          error={updateMutation.isError}
          initialValues={milestoneDraft(milestone)}
          onCancel={() => setEditing(false)}
          onSave={(draft) => updateMutation.mutateAsync(draft)}
          prefix={`milestone-edit-${milestone.id}`}
          submitLabel="Save"
        />
      ) : null}
      {statusMutation.isError ? (
        <p className="text-destructive text-sm" role="alert">
          This action could not be completed.
        </p>
      ) : null}

      <section
        aria-label={`Work in ${milestone.title}`}
        className="grid gap-2 border-t pt-4"
      >
        <h4 className="font-medium text-sm">In Milestone</h4>
        {relationsQuery.isPending ? (
          <p role="status">Loading relations…</p>
        ) : null}
        {relationsQuery.isError ? (
          <p role="alert">
            Relations could not be loaded. Try loading this page again.
          </p>
        ) : null}
        {!(relationsQuery.isPending || relationsQuery.isError) &&
        linkedWorks.length === 0 ? (
          <p className="text-muted-foreground text-sm">No relations yet.</p>
        ) : null}
        {linkedWorks.map((relation: RelationView) => (
          <Link
            className="text-sm underline-offset-4 hover:underline"
            hash={workRecordHash(relation.source.recordId)}
            key={relation.id}
            params={{ projectId }}
            to="/projects/$projectId"
          >
            {relation.source.title} · {relation.label}
          </Link>
        ))}
        {works.length ? (
          <div className="flex flex-wrap items-end gap-2">
            <label
              className="grid gap-1 text-xs"
              htmlFor={`milestone-work-${milestone.id}`}
            >
              Work
              <select
                className="min-h-10 rounded-md border bg-background px-2 text-sm"
                disabled={
                  relationPreviewMutation.isPending ||
                  relationCreateMutation.isPending
                }
                id={`milestone-work-${milestone.id}`}
                onChange={(event) => {
                  setSelectedWorkId(event.target.value);
                  setPreview(null);
                  setRelationIdempotencyKey(null);
                }}
                value={selectedWorkId}
              >
                {works.map((work) => (
                  <option key={work.id} value={work.id}>
                    {work.key} · {work.title}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={
                !selectedWorkId ||
                relationPreviewMutation.isPending ||
                relationCreateMutation.isPending
              }
              onClick={() => relationPreviewMutation.mutate()}
              size="sm"
              type="button"
              variant="outline"
            >
              Preview relation
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No Work yet.</p>
        )}
        {preview ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
            <p>
              {preview.source.label} · {preview.kind} · {preview.target.label}
            </p>
            <Button
              disabled={relationCreateMutation.isPending}
              onClick={() => relationCreateMutation.mutate()}
              size="sm"
              type="button"
            >
              Confirm relation
            </Button>
            <Button
              onClick={() => {
                setPreview(null);
                setRelationIdempotencyKey(null);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        ) : null}
        {relationPreviewMutation.isError || relationCreateMutation.isError ? (
          <p className="text-destructive text-sm" role="alert">
            This action could not be completed.
          </p>
        ) : null}
      </section>
    </article>
  );
}

export default function ProjectMilestones({
  projectId,
  works,
}: {
  projectId: string;
  works: WorkProfile[];
}) {
  const queryClient = useQueryClient();
  const query = useQuery(
    orpc.projectMilestones.queryOptions({ input: { projectId } }),
  );
  const createMutation = useMutation({
    mutationFn: (draft: MilestoneDraft) =>
      runOnlineOnlyWrite(() =>
        client.createMilestone({
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          description: draft.description || null,
          id: crypto.randomUUID(),
          projectId,
          targetDate: draft.targetDate || null,
          title: draft.title,
        }),
      ),
    onSuccess: async () => {
      await invalidateMilestones(queryClient, projectId);
    },
  });

  if (query.isPending) {
    return <p role="status">Loading…</p>;
  }
  if (query.isError) {
    return <p role="alert">This action could not be completed.</p>;
  }

  return (
    <section aria-label="Milestones" className="grid gap-4 border-t pt-6">
      <header className="grid gap-1">
        <h3 className="font-semibold text-xl">Milestones</h3>
        <p className="text-muted-foreground text-sm">
          Milestones describe intermediate outcomes. Their status changes only
          through an explicit action.
        </p>
      </header>
      <MilestoneEditor
        className="grid gap-3 rounded-lg border bg-card p-4"
        error={createMutation.isError}
        initialValues={EMPTY_DRAFT}
        onSave={(draft) => createMutation.mutateAsync(draft)}
        prefix={`milestone-create-${projectId}`}
        submitLabel="Create Milestone"
      />
      {(query.data ?? []).length ? (
        <div className="grid gap-3">
          {(query.data ?? []).map((milestone: Milestone) => (
            <MilestoneCard
              key={milestone.id}
              milestone={milestone}
              projectId={projectId}
              works={works}
            />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No Milestone yet.</p>
      )}
    </section>
  );
}
