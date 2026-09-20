// biome-ignore-all lint/performance/noJsxPropsBind: Relation controls close over their current preview and mutation state.

import type {
  RelationPreview,
  RelationUsageView,
  RelationView,
} from "@cantiara/api/relations";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

const GENERIC_RELATION_KINDS = ["Related", "Origin"] as const;
type GenericRelationKind = (typeof GENERIC_RELATION_KINDS)[number];

interface RemovedRelation {
  baseRevision: number;
  otherRecordId: string;
  receiptId: string;
  relationId: string;
}

export default function WorkRelations({
  candidates,
  work,
}: {
  candidates: readonly WorkProfile[];
  work: WorkProfile;
}) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [relationKind, setRelationKind] =
    useState<GenericRelationKind>("Related");
  const [targetWorkId, setTargetWorkId] = useState(candidates[0]?.id ?? "");
  const [preview, setPreview] = useState<RelationPreview | null>(null);
  const [removedRelation, setRemovedRelation] =
    useState<RemovedRelation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery(
    orpc.relations.queryOptions({
      input: { recordId: work.id, recordType: "Work" },
    }),
  );
  const usagesQuery = useQuery(
    orpc.relationUsages.queryOptions({
      input: { recordId: work.id, recordType: "Work" },
    }),
  );

  useEffect(() => {
    if (
      targetWorkId === "" ||
      !candidates.some((candidate) => candidate.id === targetWorkId)
    ) {
      setTargetWorkId(candidates[0]?.id ?? "");
    }
  }, [candidates, targetWorkId]);

  function invalidateRelations(targetId = targetWorkId) {
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.relations.queryOptions({
          input: { recordId: work.id, recordType: "Work" },
        }).queryKey,
      }),
      ...(targetId
        ? [
            queryClient.invalidateQueries({
              queryKey: orpc.relations.queryOptions({
                input: { recordId: targetId, recordType: "Work" },
              }).queryKey,
            }),
          ]
        : []),
    ]);
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      client.relationPreview({
        kind: relationKind,
        source: { recordId: work.id, recordType: "Work" },
        target: { recordId: targetWorkId, recordType: "Work" },
      }),
    onError: (mutationError) => {
      setError(mutationErrorMessage(mutationError, "Relation preview failed."));
    },
    onSuccess: (nextPreview) => {
      setError(null);
      setPreview(nextPreview);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!preview) {
        throw new Error("Review the relation preview before confirming.");
      }
      return runOnlineOnlyWrite(() =>
        client.createRelation({
          baseRevision: preview.baseRevision,
          clientIdempotencyKey: crypto.randomUUID(),
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
    onError: (mutationError) => {
      setError(
        mutationErrorMessage(mutationError, "Relation could not be created."),
      );
    },
    onSuccess: async () => {
      setError(null);
      setPreview(null);
      await invalidateRelations();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (relation: RelationView) =>
      runOnlineOnlyWrite(() =>
        client.removeRelation({
          baseRevision: relation.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          relationId: relation.id,
        }),
      ),
    onError: (mutationError) => {
      setError(
        mutationErrorMessage(mutationError, "Relation could not be removed."),
      );
    },
    onSuccess: async (result, relation) => {
      setError(null);
      const otherRecordId =
        relation.source.recordId === work.id
          ? relation.target.recordId
          : relation.source.recordId;
      setRemovedRelation({
        baseRevision: relation.revision + 1,
        otherRecordId,
        receiptId: result.receiptId,
        relationId: relation.id,
      });
      await invalidateRelations(otherRecordId);
    },
  });

  const undoMutation = useMutation({
    mutationFn: () => {
      if (!removedRelation) {
        throw new Error("This relation is no longer available for Undo.");
      }
      return runOnlineOnlyWrite(() =>
        client.undoRelation({
          baseRevision: removedRelation.baseRevision,
          clientIdempotencyKey: crypto.randomUUID(),
          receiptId: removedRelation.receiptId,
          relationId: removedRelation.relationId,
        }),
      );
    },
    onError: (mutationError) => {
      setError(
        mutationErrorMessage(mutationError, "Relation could not be undone."),
      );
    },
    onSuccess: async () => {
      if (!removedRelation) {
        return;
      }
      const { otherRecordId } = removedRelation;
      setError(null);
      setRemovedRelation(null);
      await invalidateRelations(otherRecordId);
    },
  });

  const relationItems = query.data ?? [];
  const outgoing = relationItems.filter(
    (relation) => relation.direction === "outgoing",
  );
  const incoming = relationItems.filter(
    (relation) => relation.direction === "incoming",
  );
  const canCreate =
    connection !== "offline" &&
    work.archivedAt === null &&
    targetWorkId !== "" &&
    !previewMutation.isPending &&
    !createMutation.isPending;

  return (
    <section
      aria-label="Relations"
      className="space-y-3 border-border/70 border-t pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium text-sm">Relations</h4>
        <details>
          <summary className="cursor-pointer text-muted-foreground text-xs hover:text-foreground">
            Create Persistent Relation
          </summary>
          <form
            className="mt-3 grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              setPreview(null);
              previewMutation.mutate();
            }}
          >
            <label
              className="text-muted-foreground text-xs"
              htmlFor={`relation-kind-${work.id}`}
            >
              Relation type
            </label>
            <NativeSelect
              aria-label="Relation type"
              disabled={!canCreate}
              id={`relation-kind-${work.id}`}
              onChange={(event) => {
                setRelationKind(event.target.value as GenericRelationKind);
                setPreview(null);
                setError(null);
              }}
              value={relationKind}
            >
              {GENERIC_RELATION_KINDS.map((kind) => (
                <NativeSelectOption key={kind} value={kind}>
                  {kind}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <label
              className="text-muted-foreground text-xs"
              htmlFor={`relation-target-${work.id}`}
            >
              Related Work
            </label>
            <NativeSelect
              aria-label="Related Work"
              disabled={!canCreate}
              id={`relation-target-${work.id}`}
              onChange={(event) => {
                setTargetWorkId(event.target.value);
                setPreview(null);
                setError(null);
              }}
              value={targetWorkId}
            >
              <NativeSelectOption value="">Select a Work</NativeSelectOption>
              {candidates.map((candidate) => (
                <NativeSelectOption key={candidate.id} value={candidate.id}>
                  {candidate.key} {candidate.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <Button disabled={!canCreate} size="xs" type="submit">
              Preview relation
            </Button>
            {preview ? (
              <div
                aria-label="Relation preview"
                className="space-y-2 border bg-background p-3 text-xs"
                role="status"
              >
                <p>
                  {preview.label}: {preview.source.label} →{" "}
                  {preview.target.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={createMutation.isPending}
                    onClick={() => createMutation.mutate()}
                    size="xs"
                    type="button"
                  >
                    Confirm relation
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
              </div>
            ) : null}
          </form>
        </details>
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      {removedRelation ? (
        <div
          className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
          role="status"
        >
          <span>Relation removed.</span>
          <Button
            disabled={undoMutation.isPending}
            onClick={() => undoMutation.mutate()}
            size="xs"
            type="button"
            variant="outline"
          >
            Undo
          </Button>
        </div>
      ) : null}
      <RelationsContent
        incoming={incoming}
        isError={query.isError}
        isPending={query.isPending}
        onRemove={(relation) => removeMutation.mutate(relation)}
        outgoing={outgoing}
        removePending={removeMutation.isPending}
        usages={usagesQuery.data ?? []}
        workId={work.id}
      />
    </section>
  );
}

function RelationsContent({
  incoming,
  isError,
  isPending,
  onRemove,
  outgoing,
  removePending,
  usages,
  workId,
}: {
  incoming: readonly RelationView[];
  isError: boolean;
  isPending: boolean;
  onRemove: (relation: RelationView) => void;
  outgoing: readonly RelationView[];
  removePending: boolean;
  usages: readonly RelationUsageView[];
  workId: string;
}) {
  if (isPending) {
    return <p className="text-muted-foreground text-xs">Loading relations…</p>;
  }
  if (isError) {
    return (
      <p className="text-destructive text-xs" role="alert">
        Relations could not be loaded. Try loading this page again.
      </p>
    );
  }
  if (outgoing.length === 0 && incoming.length === 0 && usages.length === 0) {
    return <p className="text-muted-foreground text-xs">No relations yet.</p>;
  }
  return (
    <div className="space-y-3">
      {outgoing.length > 0 ? (
        <RelationGroup
          onRemove={onRemove}
          relations={outgoing}
          removePending={removePending}
          title="Relations"
          workId={workId}
        />
      ) : null}
      {incoming.length > 0 || usages.length > 0 ? (
        <div className="space-y-2">
          <h5 className="font-medium text-muted-foreground text-xs">Used in</h5>
          {incoming.length > 0 ? (
            <RelationItems
              onRemove={onRemove}
              relations={incoming}
              removePending={removePending}
              workId={workId}
            />
          ) : null}
          {usages.length > 0 ? (
            <ul className="space-y-2">
              {usages.map((usage) => (
                <li
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
                  key={usage.id}
                >
                  <div className="min-w-0">
                    <span className="mr-2 text-muted-foreground">
                      {usage.kind}
                    </span>
                    <UsageSurfaceText surface={usage.surface} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RelationGroup({
  onRemove,
  relations,
  removePending,
  title,
  workId,
}: {
  onRemove: (relation: RelationView) => void;
  relations: readonly RelationView[];
  removePending: boolean;
  title: "Relations" | "Used in";
  workId: string;
}) {
  return (
    <div className="space-y-2">
      <h5 className="font-medium text-muted-foreground text-xs">{title}</h5>
      <RelationItems
        onRemove={onRemove}
        relations={relations}
        removePending={removePending}
        workId={workId}
      />
    </div>
  );
}

function RelationItems({
  onRemove,
  relations,
  removePending,
  workId,
}: {
  onRemove: (relation: RelationView) => void;
  relations: readonly RelationView[];
  removePending: boolean;
  workId: string;
}) {
  return (
    <ul className="space-y-2">
      {relations.map((relation) => {
        const endpoint =
          relation.direction === "outgoing" ? relation.target : relation.source;
        return (
          <li
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
            key={relation.id}
          >
            <div className="min-w-0">
              <span className="mr-2 text-muted-foreground">
                {relation.label}
              </span>
              <RelationEndpointText endpoint={endpoint} workId={workId} />
            </div>
            <Button
              aria-label={`Remove ${relation.label}`}
              disabled={removePending}
              onClick={() => onRemove(relation)}
              size="xs"
              type="button"
              variant="ghost"
            >
              Remove
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function UsageSurfaceText({
  surface,
}: {
  surface: RelationUsageView["surface"];
}) {
  if (surface.broken) {
    return (
      <span className="text-muted-foreground">
        {surface.key && surface.title
          ? `${surface.key} ${surface.title} — ${surface.broken.reason}`
          : `Broken — ${surface.broken.reason}`}
        {surface.broken.canOpenSourceRecord ? (
          <a
            className="ml-2 underline underline-offset-2"
            href={`#work-${surface.recordId}`}
          >
            Open source record
          </a>
        ) : null}
      </span>
    );
  }
  return (
    <a
      className="underline underline-offset-2"
      href={`#work-${surface.recordId}`}
    >
      {surface.key} {surface.title}
    </a>
  );
}

function RelationEndpointText({
  endpoint,
  workId,
}: {
  endpoint: RelationView["source"];
  workId: string;
}) {
  if (endpoint.broken) {
    return (
      <span className="text-muted-foreground">
        {endpoint.key && endpoint.title
          ? `${endpoint.key} ${endpoint.title} — ${endpoint.broken.reason}`
          : `Broken — ${endpoint.broken.reason}`}
        {endpoint.broken.canOpenSourceRecord ? (
          <a
            className="ml-2 underline underline-offset-2"
            href={`#work-${endpoint.recordId}`}
          >
            Open source record
          </a>
        ) : null}
      </span>
    );
  }
  return (
    <span>
      {endpoint.key} {endpoint.title}
      {endpoint.recordId === workId ? " (current)" : ""}
    </span>
  );
}

function mutationErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
