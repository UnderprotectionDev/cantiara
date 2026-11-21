// biome-ignore-all lint/performance/noJsxPropsBind: Relation controls close over their current preview and mutation state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  RelationCreatePreviewInput,
  RelationView,
  UsedInSummary,
} from "@cantiara/api/relations";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLinkProps } from "@tanstack/react-router";
import { useState } from "react";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { commandVariables } from "@/lib/command-variables";
import { fetchFresh } from "@/lib/fetch-fresh";
import { mutationErrorMessage } from "@/lib/mutation-messages";
import { useCollapsibleState } from "@/lib/use-collapsible-state";
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
  const [invalidPreview, setInvalidPreview] = useState(false);
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
    mutationKey: orpc.relationPreview.mutationKey(),
    mutationFn: (input: RelationCreatePreviewInput) =>
      fetchFresh(queryClient, {
        ...orpc.relationPreview.queryOptions({ input }),
        gcTime: 0,
      }),
    meta: { presentsSupportFailure: true },
  });

  const createMutation = useMutation(
    orpc.createRelation.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createRelation(input),
      onSuccess: async (_, input) => {
        previewMutation.reset();
        await invalidateRelations(
          [input.source.recordId, input.target.recordId].find(
            (id) => id !== work.id,
          ),
        );
      },
    }),
  );

  const removeMutation = useMutation({
    mutationKey: orpc.removeRelation.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      relation,
      clientIdempotencyKey,
    }: {
      relation: RelationView;
      clientIdempotencyKey: string;
    }) =>
      client.removeRelation({
        baseRevision: relation.revision,
        clientIdempotencyKey,
        relationId: relation.id,
      }),
    onSuccess: async (_, { relation }) => {
      undoMutation.reset();
      await invalidateRelations(
        relation.source.recordId === work.id
          ? relation.target.recordId
          : relation.source.recordId,
      );
    },
  });
  const resolveMutation = useMutation({
    mutationKey: orpc.resolveBlocker.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      relation,
      clientIdempotencyKey,
      note,
    }: {
      relation: RelationView;
      note: string | undefined;
      clientIdempotencyKey: string;
    }) =>
      client.resolveBlocker({
        baseRevision: relation.revision,
        clientIdempotencyKey,
        ...(note ? { note } : {}),
        relationId: relation.id,
      }),
    onSuccess: async (_result, { relation }) => {
      await invalidateRelations(
        relation.source.recordId === work.id
          ? relation.target.recordId
          : relation.source.recordId,
      );
    },
  });

  const reactivateMutation = useMutation({
    mutationKey: orpc.reactivateBlocker.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      relation,
      clientIdempotencyKey,
    }: {
      relation: RelationView;
      clientIdempotencyKey: string;
    }) =>
      client.reactivateBlocker({
        baseRevision: relation.revision,
        clientIdempotencyKey,
        relationId: relation.id,
      }),
    onSuccess: async (_result, { relation }) => {
      await invalidateRelations(
        relation.source.recordId === work.id
          ? relation.target.recordId
          : relation.source.recordId,
      );
    },
  });

  const undoMutation = useMutation({
    mutationKey: orpc.undoRelation.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      otherRecordId: _,
      ...input
    }: RemovedRelation & {
      clientIdempotencyKey: string;
    }) => client.undoRelation(input),
    onSuccess: async (_, { otherRecordId }) => {
      removeMutation.reset();
      await invalidateRelations(otherRecordId);
    },
  });

  const { data: preview } = previewMutation;
  const removed = removeMutation.variables?.relation;
  const removedRelation =
    removeMutation.data && removed
      ? {
          baseRevision: removed.revision + 1,
          otherRecordId:
            removed.source.recordId === work.id
              ? removed.target.recordId
              : removed.source.recordId,
          receiptId: removeMutation.data.receiptId,
          relationId: removed.id,
        }
      : null;
  const [latest] = [
    { ...previewMutation, fallback: "Relation preview failed." },
    { ...createMutation, fallback: "Relation could not be created." },
    { ...removeMutation, fallback: "Relation could not be removed." },
    { ...resolveMutation, fallback: "Blocker could not be resolved." },
    { ...reactivateMutation, fallback: "Blocker could not be reactivated." },
    { ...undoMutation, fallback: "Relation could not be undone." },
  ].sort((left, right) => right.submittedAt - left.submittedAt);
  const error = invalidPreview
    ? "Relation preview failed."
    : latest?.isError && mutationErrorMessage(latest.error, latest.fallback);

  function clearPreview() {
    setInvalidPreview(false);
    previewMutation.reset();
    createMutation.reset();
  }
  const relationItems = query.data ?? [];
  const outgoing = relationItems.filter(
    (relation) => relation.direction === "outgoing",
  );
  return (
    <section
      aria-label="Relations"
      className="space-y-3 border-t border-border/70 pt-3"
      id={`work-relations-${encodeURIComponent(work.id)}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium">Relations</h4>
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
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
            onEdit={clearPreview}
            onPreview={(input) => {
              clearPreview();
              previewMutation.mutate(input);
            }}
            onPreviewInvalid={() => setInvalidPreview(true)}
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
                    onClick={() => {
                      if (!preview) {
                        return;
                      }
                      createMutation.mutate(
                        commandVariables(
                          {
                            baseRevision: preview.baseRevision,
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
                          },
                          createMutation.isError
                            ? createMutation.variables
                            : undefined,
                        ),
                      );
                    }}
                    size="xs"
                    type="button"
                  >
                    Confirm relation
                  </Button>
                  <Button
                    onClick={clearPreview}
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
        <p className="text-xs text-destructive" role="alert">
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
            onClick={() =>
              undoMutation.mutate(
                commandVariables(
                  removedRelation,
                  undoMutation.isError ? undoMutation.variables : undefined,
                ),
              )
            }
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
        isPending={query.status === "pending" || usedInQuery.isPending}
        onReactivate={(relation) =>
          reactivateMutation.mutate(
            commandVariables(
              { relation },
              reactivateMutation.isError
                ? reactivateMutation.variables
                : undefined,
            ),
          )
        }
        onRemove={(relation) =>
          removeMutation.mutate(
            commandVariables(
              { relation },
              removeMutation.isError ? removeMutation.variables : undefined,
            ),
          )
        }
        onResolve={(relation, note) =>
          resolveMutation.mutateAsync(
            commandVariables(
              { relation, note },
              resolveMutation.isError ? resolveMutation.variables : undefined,
            ),
          )
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
    return <p className="text-xs text-muted-foreground">Loading relations…</p>;
  }
  if (isError) {
    return (
      <p className="text-xs text-destructive" role="alert">
        Relations could not be loaded. Try loading this page again.
      </p>
    );
  }
  if (
    outgoing.length === 0 &&
    relationBacklinks.length === 0 &&
    usageLinks.length === 0
  ) {
    return <p className="text-xs text-muted-foreground">No relations yet.</p>;
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
          <h5 className="text-xs font-medium text-muted-foreground">Used in</h5>
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
              <h6 className="text-xs font-medium text-muted-foreground">
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
      <h5 className="text-xs font-medium text-muted-foreground">{title}</h5>
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
  const [isResolving, setIsResolving] = useCollapsibleState();

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

  return (
    <Collapsible onOpenChange={setIsResolving} open={isResolving}>
      {isResolving ? null : (
        <CollapsibleTrigger
          disabled={disabled}
          render={<Button size="xs" variant="outline" />}
        >
          Mark blocker resolved
        </CollapsibleTrigger>
      )}
      <CollapsibleContent>
        <ResolveBlockerForm
          disabled={disabled}
          onCancel={() => setIsResolving(false)}
          onResolve={async (note) => {
            await onResolve(note);
            setIsResolving(false);
          }}
          relationId={relation.id}
        />
      </CollapsibleContent>
    </Collapsible>
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
