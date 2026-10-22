// biome-ignore-all lint/performance/noJsxPropsBind: Relation controls close over their current preview and mutation state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  RelationCreatePreviewInput,
  RelationPreview,
  RelationView,
  UsedInSummary,
} from "@cantiara/api/relations";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLinkProps } from "@tanstack/react-router";
import { useState } from "react";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { mutationErrorMessage } from "@/lib/mutation-messages";
import { client, orpc } from "@/utils/orpc";
import { CreateRelationForm } from "../forms/create-relation-form";
import { ResolveBlockerForm } from "../forms/resolve-blocker-form";

interface RemovedRelation {
  baseRevision: number;
  otherRecordId: string;
  receiptId: string;
  relationId: string;
}

const EMPTY_USED_IN_SUMMARY: UsedInSummary = {
  relationBacklinks: [],
  usageLinks: [],
};

export default function WorkRelations({
  candidates,
  formattingPreferences,
  work,
}: {
  candidates: readonly WorkProfile[];
  formattingPreferences: AccountPreferences;
  work: WorkProfile;
}) {
  const connection = useClientShellConnection();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<RelationPreview | null>(null);
  const [createIdempotencyKey, setCreateIdempotencyKey] = useState<
    string | null
  >(null);
  const [removedRelation, setRemovedRelation] =
    useState<RemovedRelation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery(
    orpc.relations.queryOptions({
      input: { recordId: work.id, recordType: "Work" },
    }),
  );
  const usedInQuery = useQuery(
    orpc.usedIn.queryOptions({
      input: { recordId: work.id, recordType: "Work" },
    }),
  );

  function invalidateRelations(targetId?: string) {
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.relations.queryOptions({
          input: { recordId: work.id, recordType: "Work" },
        }).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.usedIn.queryOptions({
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
            queryClient.invalidateQueries({
              queryKey: orpc.usedIn.queryOptions({
                input: { recordId: targetId, recordType: "Work" },
              }).queryKey,
            }),
          ]
        : []),
    ]);
  }

  const previewMutation = useMutation({
    mutationFn: (input: RelationCreatePreviewInput) =>
      client.relationPreview(input),
    onError: (mutationError) => {
      setError(mutationErrorMessage(mutationError, "Relation preview failed."));
    },
    onSuccess: (nextPreview) => {
      setError(null);
      setCreateIdempotencyKey(crypto.randomUUID());
      setPreview(nextPreview);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!(preview && createIdempotencyKey)) {
        throw new Error("Review the relation preview before confirming.");
      }
      return runOnlineOnlyWrite(() =>
        client.createRelation({
          baseRevision: preview.baseRevision,
          clientIdempotencyKey: createIdempotencyKey,
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
      setCreateIdempotencyKey(null);
      await invalidateRelations(
        preview
          ? [preview.source.recordId, preview.target.recordId].find(
              (recordId) => recordId !== work.id,
            )
          : undefined,
      );
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

  const resolveMutation = useMutation({
    mutationFn: ({
      relation,
      note,
    }: {
      relation: RelationView;
      note?: string;
    }) =>
      runOnlineOnlyWrite(() =>
        client.resolveBlocker({
          baseRevision: relation.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          ...(note ? { note } : {}),
          relationId: relation.id,
        }),
      ),
    onError: (mutationError) => {
      setError(
        mutationErrorMessage(mutationError, "Blocker could not be resolved."),
      );
    },
    onSuccess: async (_result, { relation }) => {
      setError(null);
      await invalidateRelations(
        relation.source.recordId === work.id
          ? relation.target.recordId
          : relation.source.recordId,
      );
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (relation: RelationView) =>
      runOnlineOnlyWrite(() =>
        client.reactivateBlocker({
          baseRevision: relation.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          relationId: relation.id,
        }),
      ),
    onError: (mutationError) => {
      setError(
        mutationErrorMessage(
          mutationError,
          "Blocker could not be reactivated.",
        ),
      );
    },
    onSuccess: async (_result, relation) => {
      setError(null);
      await invalidateRelations(
        relation.source.recordId === work.id
          ? relation.target.recordId
          : relation.source.recordId,
      );
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
  return (
    <section
      aria-label="Relations"
      className="space-y-3 border-border/70 border-t pt-3"
      id={`work-relations-${encodeURIComponent(work.id)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium text-sm">Relations</h4>
        <details>
          <summary className="cursor-pointer text-muted-foreground text-xs hover:text-foreground">
            Create Persistent Relation
          </summary>
          <CreateRelationForm
            candidates={candidates}
            disabled={
              connection === "offline" ||
              work.archivedAt !== null ||
              previewMutation.isPending ||
              createMutation.isPending
            }
            onEdit={() => {
              setPreview(null);
              setCreateIdempotencyKey(null);
              setError(null);
            }}
            onPreview={(input) => {
              setError(null);
              setPreview(null);
              setCreateIdempotencyKey(null);
              previewMutation.mutate(input);
            }}
            onPreviewInvalid={() => setError("Relation preview failed.")}
            workId={work.id}
          >
            {preview ? (
              <div
                aria-label="Relation preview"
                className="space-y-2 border bg-background p-3 text-xs"
                role="status"
              >
                <p>
                  {preview.label}: {preview.source.label} →{" "}
                  {preview.target.label}
                  {preview.blockingStatus ? ` · ${preview.blockingStatus}` : ""}
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
                    onClick={() => {
                      setPreview(null);
                      setCreateIdempotencyKey(null);
                    }}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </CreateRelationForm>
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
        blockerMutationPending={
          resolveMutation.isPending || reactivateMutation.isPending
        }
        formattingPreferences={formattingPreferences}
        isError={query.isError || usedInQuery.isError}
        isPending={query.isPending || usedInQuery.isPending}
        onReactivate={(relation) => reactivateMutation.mutate(relation)}
        onRemove={(relation) => removeMutation.mutate(relation)}
        onResolve={(relation, note) =>
          resolveMutation.mutateAsync({ relation, note })
        }
        outgoing={outgoing}
        removePending={removeMutation.isPending}
        usedIn={usedInQuery.data ?? EMPTY_USED_IN_SUMMARY}
        workId={work.id}
      />
    </section>
  );
}

function RelationsContent({
  blockerMutationPending,
  formattingPreferences,
  isError,
  isPending,
  onRemove,
  onResolve,
  onReactivate,
  outgoing,
  removePending,
  usedIn,
  workId,
}: {
  blockerMutationPending: boolean;
  formattingPreferences: AccountPreferences;
  isError: boolean;
  isPending: boolean;
  onRemove: (relation: RelationView) => void;
  onResolve: (relation: RelationView, note?: string) => Promise<unknown>;
  onReactivate: (relation: RelationView) => void;
  outgoing: readonly RelationView[];
  removePending: boolean;
  usedIn: UsedInSummary;
  workId: string;
}) {
  const { relationBacklinks, usageLinks } = usedIn;
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
  if (
    outgoing.length === 0 &&
    relationBacklinks.length === 0 &&
    usageLinks.length === 0
  ) {
    return <p className="text-muted-foreground text-xs">No relations yet.</p>;
  }
  return (
    <div className="space-y-3">
      {outgoing.length > 0 ? (
        <RelationGroup
          blockerMutationPending={blockerMutationPending}
          formattingPreferences={formattingPreferences}
          onReactivate={onReactivate}
          onRemove={onRemove}
          onResolve={onResolve}
          relations={outgoing}
          removePending={removePending}
          title="Relations"
          workId={workId}
        />
      ) : null}
      {relationBacklinks.length > 0 || usageLinks.length > 0 ? (
        <div className="space-y-2">
          <h5 className="font-medium text-muted-foreground text-xs">Used in</h5>
          {relationBacklinks.length > 0 ? (
            <RelationItems
              blockerMutationPending={blockerMutationPending}
              formattingPreferences={formattingPreferences}
              onReactivate={onReactivate}
              onRemove={onRemove}
              onResolve={onResolve}
              openSourceRecord
              relations={relationBacklinks}
              removePending={removePending}
              workId={workId}
            />
          ) : null}
          {usageLinks.length > 0 ? (
            <div className="space-y-2">
              <h6 className="font-medium text-muted-foreground text-xs">
                Usage links
              </h6>
              <ul className="space-y-2">
                {usageLinks.map((usage) => (
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
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RelationGroup({
  blockerMutationPending,
  formattingPreferences,
  onRemove,
  onResolve,
  onReactivate,
  openSourceRecord = false,
  relations,
  removePending,
  title,
  workId,
}: {
  blockerMutationPending: boolean;
  formattingPreferences: AccountPreferences;
  onRemove: (relation: RelationView) => void;
  onResolve: (relation: RelationView, note?: string) => Promise<unknown>;
  onReactivate: (relation: RelationView) => void;
  openSourceRecord?: boolean;
  relations: readonly RelationView[];
  removePending: boolean;
  title: "Relations" | "Used in";
  workId: string;
}) {
  return (
    <div className="space-y-2">
      <h5 className="font-medium text-muted-foreground text-xs">{title}</h5>
      <RelationItems
        blockerMutationPending={blockerMutationPending}
        formattingPreferences={formattingPreferences}
        onReactivate={onReactivate}
        onRemove={onRemove}
        onResolve={onResolve}
        openSourceRecord={openSourceRecord}
        relations={relations}
        removePending={removePending}
        workId={workId}
      />
    </div>
  );
}

function RelationItems({
  blockerMutationPending,
  formattingPreferences,
  onRemove,
  onResolve,
  onReactivate,
  openSourceRecord = false,
  relations,
  removePending,
  workId,
}: {
  blockerMutationPending: boolean;
  formattingPreferences: AccountPreferences;
  onRemove: (relation: RelationView) => void;
  onResolve: (relation: RelationView, note?: string) => Promise<unknown>;
  onReactivate: (relation: RelationView) => void;
  openSourceRecord?: boolean;
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
              {relation.blockingStatus ? (
                <span className="mr-2 rounded-sm bg-muted px-1.5 py-0.5 font-medium text-foreground">
                  {relation.blockingStatus}
                </span>
              ) : null}
              <RelationEndpointText
                endpoint={endpoint}
                openSourceRecord={openSourceRecord}
                workId={workId}
              />
              <BlockerResolutionSummary
                formattingPreferences={formattingPreferences}
                relation={relation}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BlockerActions
                disabled={blockerMutationPending}
                onReactivate={() => onReactivate(relation)}
                onResolve={(note) => onResolve(relation, note)}
                relation={relation}
              />
              <Button
                aria-label={
                  relation.kind === "Blocks"
                    ? "Remove relation"
                    : `Remove ${relation.label}`
                }
                disabled={removePending}
                onClick={() => onRemove(relation)}
                size="xs"
                type="button"
                variant="ghost"
              >
                {relation.kind === "Blocks" ? "Remove relation" : "Remove"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function BlockerResolutionSummary({
  formattingPreferences,
  relation,
}: {
  formattingPreferences: AccountPreferences;
  relation: Pick<
    RelationView,
    | "blockingHistory"
    | "blockingResolutionNote"
    | "blockingResolvedAt"
    | "blockingStatus"
    | "kind"
  >;
}) {
  if (relation.kind !== "Blocks") {
    return null;
  }
  return (
    <div className="mt-1 space-y-1 text-muted-foreground">
      {relation.blockingStatus === "Resolved" ? (
        <p>
          Resolved{" "}
          {relation.blockingResolvedAt ? (
            <time dateTime={relation.blockingResolvedAt}>
              {formatAccountDateTime(
                relation.blockingResolvedAt,
                formattingPreferences,
              )}
            </time>
          ) : null}
          {relation.blockingResolutionNote
            ? ` · ${relation.blockingResolutionNote}`
            : ""}
        </p>
      ) : null}
      {relation.blockingHistory.length > 2 ? (
        <details>
          <summary className="cursor-pointer text-xs">Blocker history</summary>
          <ol className="mt-1 space-y-1 pl-4">
            {relation.blockingHistory.map((event) => (
              <li key={event.id}>
                {event.isUndo ? "Undo · " : ""}
                {event.status}{" "}
                <time dateTime={event.occurredAt}>
                  {formatAccountDateTime(
                    event.occurredAt,
                    formattingPreferences,
                  )}
                </time>
                {event.isUndo && event.resolutionAt ? (
                  <>
                    {" · Resolution date "}
                    <time dateTime={event.resolutionAt}>
                      {formatAccountDateTime(
                        event.resolutionAt,
                        formattingPreferences,
                      )}
                    </time>
                  </>
                ) : null}
                {event.note ? ` · ${event.note}` : ""}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

function BlockerActions({
  disabled,
  onReactivate,
  onResolve,
  relation,
}: {
  disabled: boolean;
  onReactivate: () => void;
  onResolve: (note?: string) => Promise<unknown>;
  relation: RelationView;
}) {
  const [isResolving, setIsResolving] = useState(false);

  if (relation.kind !== "Blocks") {
    return null;
  }
  if (relation.blockingStatus === "Resolved") {
    return (
      <Button
        disabled={disabled}
        onClick={onReactivate}
        size="xs"
        type="button"
        variant="outline"
      >
        Reactivate blocker
      </Button>
    );
  }
  if (relation.blockingStatus !== "Active") {
    return null;
  }
  if (!isResolving) {
    return (
      <Button
        disabled={disabled}
        onClick={() => setIsResolving(true)}
        size="xs"
        type="button"
        variant="outline"
      >
        Mark blocker resolved
      </Button>
    );
  }
  return (
    <ResolveBlockerForm
      disabled={disabled}
      onCancel={() => setIsResolving(false)}
      onResolve={async (note) => {
        await onResolve(note);
        setIsResolving(false);
      }}
      relationId={relation.id}
    />
  );
}

function UsageSurfaceText({
  surface,
}: {
  surface: UsedInSummary["usageLinks"][number]["surface"];
}) {
  if (surface.broken) {
    return (
      <span className="text-muted-foreground">
        {surface.key && surface.title
          ? `${surface.key} ${surface.title} — ${surface.broken.reason}`
          : `Broken — ${surface.broken.reason}`}
        {surface.broken.canOpenSourceRecord && surface.projectId ? (
          <OpenSourceRecordLink
            projectId={surface.projectId}
            recordId={surface.recordId}
          />
        ) : null}
      </span>
    );
  }
  return (
    <span>
      {surface.key} {surface.title}
      {surface.projectId ? (
        <OpenSourceRecordLink
          projectId={surface.projectId}
          recordId={surface.recordId}
        />
      ) : null}
    </span>
  );
}

function RelationEndpointText({
  endpoint,
  openSourceRecord = false,
  workId,
}: {
  endpoint: RelationView["source"];
  openSourceRecord?: boolean;
  workId: string;
}) {
  if (endpoint.broken) {
    return (
      <span className="text-muted-foreground">
        {endpoint.key && endpoint.title
          ? `${endpoint.key} ${endpoint.title} — ${endpoint.broken.reason}`
          : `Broken — ${endpoint.broken.reason}`}
        {endpoint.broken.canOpenSourceRecord && endpoint.projectId ? (
          <OpenSourceRecordLink
            projectId={endpoint.projectId}
            recordId={endpoint.recordId}
          />
        ) : null}
      </span>
    );
  }
  return (
    <span>
      {endpoint.key} {endpoint.title}
      {endpoint.recordId === workId ? " (current)" : ""}
      {openSourceRecord && endpoint.projectId ? (
        <OpenSourceRecordLink
          projectId={endpoint.projectId}
          recordId={endpoint.recordId}
        />
      ) : null}
    </span>
  );
}

function OpenSourceRecordLink({
  projectId,
  recordId,
}: {
  projectId: string;
  recordId: string;
}) {
  const linkProps = useLinkProps({
    activeOptions: { exact: true, includeHash: true },
    hash: `work-${encodeURIComponent(recordId)}`,
    params: { projectId },
    to: "/projects/$projectId",
  });

  return (
    <a {...linkProps} className="ml-2 underline underline-offset-2">
      Open source record
    </a>
  );
}
