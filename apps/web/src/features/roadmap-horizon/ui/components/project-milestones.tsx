// biome-ignore-all lint/performance/noJsxPropsBind: Milestone controls bind to the current Project and record.

import type { RelationPreview, RelationView } from "@cantiara/api/relations";
import type { Milestone } from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
  projectWorksQueryPrefix,
} from "@/utils/orpc";
import {
  EMPTY_DRAFT,
  type MilestoneDraft,
  MilestoneEditor,
  milestoneDraft,
} from "../forms/milestone-form";
import { MilestoneWorkPicker } from "../forms/milestone-work-form";

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
  const relationsQuery = useQuery(
    orpc.relations.queryOptions({
      input: { recordId: milestone.id, recordType: "Milestone" },
    }),
  );
  const updateMutation = usePreparedMutation(
    orpc.updateMilestone.mutationOptions({
      mutationFn: (input) => client.updateMilestone(input),
      onSuccess: async () => {
        setEditing(false);
        await invalidateMilestones(queryClient, projectId);
      },
    }),
    (draft: MilestoneDraft) => ({
      baseRevision: milestone.revision,
      description: draft.description || null,
      milestoneId: milestone.id,
      projectId,
      targetDate: draft.targetDate || null,
      title: draft.title,
    }),
  );
  const statusMutation = usePreparedMutation(
    orpc.updateMilestoneStatus.mutationOptions({
      mutationFn: (input) => client.updateMilestoneStatus(input),
      onSuccess: async () => {
        await Promise.all([
          invalidateMilestones(queryClient, projectId),
          ...invalidateSmartCollectionMembership(queryClient),
        ]);
      },
    }),
    (status: "Reached" | "Abandoned") => ({
      baseRevision: milestone.revision,
      milestoneId: milestone.id,
      projectId,
      status,
    }),
  );
  const relationPreviewMutation = useMutation({
    mutationKey: orpc.relationPreview.mutationKey(),
    mutationFn: (workId: string) =>
      client.relationPreview({
        kind: "Contributes to Milestone",
        source: { recordId: workId, recordType: "Work" },
        target: { recordId: milestone.id, recordType: "Milestone" },
      }),
  });
  const relationCreateMutation = usePreparedMutation(
    orpc.createRelation.mutationOptions({
      mutationFn: (input) => client.createRelation(input),
      onSuccess: async (_, { source, target }) => {
        await Promise.all(
          [source, target].map((input) =>
            queryClient.invalidateQueries({
              queryKey: orpc.relations.queryKey({ input }),
            }),
          ),
        );
      },
    }),
    (reviewed: RelationPreview) => ({
      baseRevision: reviewed.baseRevision,
      kind: reviewed.kind,
      previewId: reviewed.previewId,
      source: {
        recordId: reviewed.source.recordId,
        recordType: reviewed.source.recordType,
      },
      target: {
        recordId: reviewed.target.recordId,
        recordType: reviewed.target.recordType,
      },
    }),
  );
  const preview = relationCreateMutation.isSuccess
    ? null
    : (relationPreviewMutation.data ?? null);

  function resetRelationPreview() {
    relationPreviewMutation.reset();
    relationCreateMutation.reset();
  }

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
          <p className="text-xs text-muted-foreground">
            Milestone · {milestone.status}
          </p>
          <h3 className="font-medium">{milestone.title}</h3>
          {milestone.targetDate ? (
            <p className="text-sm text-muted-foreground">
              Target date · {milestone.targetDate}
            </p>
          ) : null}
          {milestone.description ? (
            <p className="text-sm text-muted-foreground">
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
        <p className="text-sm text-destructive" role="alert">
          This action could not be completed.
        </p>
      ) : null}

      <MilestoneWorkRelations
        linkedWorks={linkedWorks}
        milestone={milestone}
        preview={preview}
        projectId={projectId}
        relationCreateMutation={relationCreateMutation}
        relationPreviewMutation={relationPreviewMutation}
        relationsQuery={relationsQuery}
        resetRelationPreview={resetRelationPreview}
        works={works}
      />
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
  const createMutation = usePreparedMutation(
    orpc.createMilestone.mutationOptions({
      mutationFn: (input) => client.createMilestone(input),
      onSuccess: async () => {
        await invalidateMilestones(queryClient, projectId);
      },
    }),
    (draft: MilestoneDraft) => ({
      baseRevision: 0,
      description: draft.description || null,
      id: crypto.randomUUID(),
      projectId,
      targetDate: draft.targetDate || null,
      title: draft.title,
    }),
  );

  if (query.status === "pending") {
    return <p role="status">Loading…</p>;
  }
  if (query.isError) {
    return <p role="alert">This action could not be completed.</p>;
  }

  return (
    <section aria-label="Milestones" className="grid gap-4 border-t pt-6">
      <header className="grid gap-1">
        <h3 className="text-xl font-semibold">Milestones</h3>
        <p className="text-sm text-muted-foreground">
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
        <p className="text-sm text-muted-foreground">No Milestone yet.</p>
      )}
    </section>
  );
}

function MilestoneWorkRelations({
  projectId,
  milestone,
  relationsQuery,
  linkedWorks,
  works,
  relationPreviewMutation,
  relationCreateMutation,
  resetRelationPreview,
  preview,
}: {
  projectId: string;
  milestone: Milestone;
  relationsQuery: import("@tanstack/react-query").UseQueryResult<
    RelationView[],
    Error
  >;
  linkedWorks: RelationView[];
  works: WorkProfile[];
  relationPreviewMutation: import("@tanstack/react-query").UseMutationResult<
    RelationPreview,
    Error,
    string,
    unknown
  >;
  relationCreateMutation: {
    isError: boolean;
    isPending: boolean;
    mutate: (preview: RelationPreview) => void;
  };
  resetRelationPreview: () => void;
  preview: RelationPreview | null;
}) {
  return (
    <section
      aria-label={`Work in ${milestone.title}`}
      className="grid gap-2 border-t pt-4"
    >
      <h4 className="text-sm font-medium">In Milestone</h4>
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
        <p className="text-sm text-muted-foreground">No relations yet.</p>
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
        <MilestoneWorkPicker
          disabled={
            relationPreviewMutation.isPending ||
            relationCreateMutation.isPending
          }
          milestoneId={milestone.id}
          onPreview={(workId) => {
            resetRelationPreview();
            relationPreviewMutation.mutate(workId);
          }}
          onSelect={resetRelationPreview}
          works={works}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No Work yet.</p>
      )}
      {preview ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
          <p>
            {preview.source.label} · {preview.kind} · {preview.target.label}
          </p>
          <Button
            disabled={relationCreateMutation.isPending}
            onClick={() => relationCreateMutation.mutate(preview)}
            size="sm"
            type="button"
          >
            Confirm relation
          </Button>
          <Button
            onClick={resetRelationPreview}
            size="sm"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {relationPreviewMutation.isError || relationCreateMutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          This action could not be completed.
        </p>
      ) : null}
    </section>
  );
}
