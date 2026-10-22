// biome-ignore-all lint/performance/noJsxPropsBind: Milestone controls bind to the current Project and record.

import type { RelationPreview, RelationView } from "@cantiara/api/relations";
import type { Milestone } from "@cantiara/api/roadmap-horizon";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
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
    onSuccess: async () => {
      await Promise.all([
        invalidateMilestones(queryClient, projectId),
        ...invalidateSmartCollectionMembership(queryClient),
      ]);
    },
  });
  const relationPreviewMutation = useMutation({
    mutationFn: (workId: string) =>
      client.relationPreview({
        kind: "Contributes to Milestone",
        source: { recordId: workId, recordType: "Work" },
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
            input: {
              recordId: preview?.source.recordId ?? "",
              recordType: "Work",
            },
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

      <MilestoneWorkRelations
        linkedWorks={linkedWorks}
        milestone={milestone}
        preview={preview}
        projectId={projectId}
        relationCreateMutation={relationCreateMutation}
        relationPreviewMutation={relationPreviewMutation}
        relationsQuery={relationsQuery}
        setPreview={setPreview}
        setRelationIdempotencyKey={setRelationIdempotencyKey}
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

function MilestoneWorkRelations({
  projectId,
  milestone,
  relationsQuery,
  linkedWorks,
  works,
  relationPreviewMutation,
  relationCreateMutation,
  setPreview,
  setRelationIdempotencyKey,
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
  relationCreateMutation: import("@tanstack/react-query").UseMutationResult<
    import("@cantiara/api/relations").RelationMutationResult,
    Error,
    void,
    unknown
  >;
  setPreview: import("react").Dispatch<
    import("react").SetStateAction<RelationPreview | null>
  >;
  setRelationIdempotencyKey: import("react").Dispatch<
    import("react").SetStateAction<string | null>
  >;
  preview: RelationPreview | null;
}) {
  return (
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
        <MilestoneWorkPicker
          disabled={
            relationPreviewMutation.isPending ||
            relationCreateMutation.isPending
          }
          milestoneId={milestone.id}
          onPreview={(workId) => relationPreviewMutation.mutate(workId)}
          onSelect={() => {
            setPreview(null);
            setRelationIdempotencyKey(null);
          }}
          works={works}
        />
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
  );
}
