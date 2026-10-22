// biome-ignore-all lint/performance/noJsxPropsBind: Controls close over one Work and its previewed trail.

import type { WorkContextSource } from "@cantiara/api/work-context";
import { buildWorkContextModel } from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import {
  WORK_NOT_NOW_GROUND_RECORD_TYPES,
  type WorkNotNowReviewLaterHandling,
  type WorkNotNowTrail,
} from "@cantiara/api/work-not-now";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cantiara/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AppLink } from "@/components/app-link";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";
import {
  type NotNowDraft,
  NotNowEntryForm,
  type NotNowPreview,
} from "../forms/not-now-entry-form";
import { NotNowReconsideration } from "../forms/not-now-reconsideration-form";
import { reviewLaterHandlingPreview } from "./not-now-review-later-field";

type Mode = "details" | "form" | "preview";

const groundRecordTypes = new Set<string>(WORK_NOT_NOW_GROUND_RECORD_TYPES);

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Not now could not be saved.";
}

function sourceForGround(
  sources: readonly WorkContextSource[],
  relationId: string,
) {
  return sources.find((source) => source.relationId === relationId);
}

function GroundList({
  grounds,
  sources,
}: {
  grounds: WorkNotNowTrail["grounds"];
  sources: readonly WorkContextSource[];
}) {
  if (grounds.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">No supporting records.</p>
    );
  }

  return (
    <ul className="space-y-1">
      {grounds.map((ground) => {
        const source = sourceForGround(sources, ground.relationId);
        return (
          <li key={`${ground.relationId}-${ground.recordId}`}>
            {source?.openPath ? (
              <AppLink
                className="underline-offset-4 hover:underline"
                href={source.openPath}
              >
                {ground.recordType}: {ground.title}
              </AppLink>
            ) : (
              <span>
                {ground.recordType}: {ground.title}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TrailHistory({
  history,
  sources,
}: {
  history: readonly WorkNotNowTrail[];
  sources: readonly WorkContextSource[];
}) {
  if (history.length === 0) {
    return null;
  }

  return (
    <section aria-label="History" className="space-y-3 border-t pt-3">
      <h3 className="font-medium text-xs">History</h3>
      <ol className="space-y-3">
        {history.map((trail) => (
          <li
            className="space-y-1 rounded-md border border-border/70 p-3"
            key={trail.id}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
              <Badge
                variant={trail.status === "Active" ? "secondary" : "outline"}
              >
                {trail.closedBy ?? "Not now"}
              </Badge>
              <span>by You</span>
              <time dateTime={trail.createdAt}>{trail.createdAt}</time>
            </div>
            <p className="whitespace-pre-wrap text-sm">{trail.reason}</p>
            {trail.condition ? (
              <p className="text-muted-foreground text-xs">
                Re-evaluation condition: {trail.condition}
              </p>
            ) : null}
            {trail.closedAt ? (
              <p className="text-muted-foreground text-xs">
                {trail.closedBy} ·{" "}
                <time dateTime={trail.closedAt}>{trail.closedAt}</time>
              </p>
            ) : null}
            <GroundList grounds={trail.grounds} sources={sources} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function NotNowHistoryPanel({
  activeFromWork,
  archived,
  canStart,
  currentTrail,
  history,
  historyError,
  historyPending,
  onReconsider,
  onStartNew,
  connection,
  reconsiderPending,
  reviewLaterHandling,
  onReviewLaterHandlingChange,
  sources,
  workId,
  workContextError,
}: {
  activeFromWork: WorkNotNowTrail | null;
  archived: boolean;
  canStart: boolean;
  currentTrail: WorkNotNowTrail | null;
  history: readonly WorkNotNowTrail[] | undefined;
  historyError: boolean;
  historyPending: boolean;
  onReconsider: () => void;
  onStartNew: () => void;
  connection: string;
  reconsiderPending: boolean;
  reviewLaterHandling: WorkNotNowReviewLaterHandling;
  onReviewLaterHandlingChange: (
    handling: WorkNotNowReviewLaterHandling,
  ) => void;
  sources: readonly WorkContextSource[];
  workId: string;
  workContextError: boolean;
}) {
  let visibleHistory = history ?? [];
  if (historyError) {
    visibleHistory = activeFromWork ? [activeFromWork] : [];
  }

  return (
    <div className="space-y-4">
      {historyError ? (
        <p className="text-destructive text-sm" role="alert">
          Not now history could not be loaded.
        </p>
      ) : null}
      {historyPending ? (
        <p className="text-muted-foreground text-sm" role="status">
          Loading history…
        </p>
      ) : null}
      <TrailHistory history={visibleHistory} sources={sources} />
      {workContextError ? (
        <p className="text-muted-foreground text-xs" role="status">
          Supporting record links could not be loaded.
        </p>
      ) : null}
      <NotNowReconsideration
        archived={archived}
        canStart={canStart}
        connection={connection}
        currentTrail={currentTrail}
        historyPending={historyPending}
        onReconsider={onReconsider}
        onReviewLaterHandlingChange={onReviewLaterHandlingChange}
        onStartNew={onStartNew}
        reconsiderPending={reconsiderPending}
        reviewLaterHandling={reviewLaterHandling}
        workId={workId}
      />
    </div>
  );
}

function NotNowPreviewPanel({
  connection,
  currentTrail,
  error,
  groundOptions,
  onConfirm,
  onEdit,
  pending,
  preview,
}: {
  connection: string;
  currentTrail: WorkNotNowTrail | null;
  error: string | null;
  groundOptions: readonly WorkContextSource[];
  onConfirm: () => void;
  onEdit: () => void;
  pending: boolean;
  preview: NotNowPreview;
}) {
  return (
    <div className="space-y-4">
      {currentTrail ? (
        <p className="rounded-md border border-border/70 px-3 py-2 text-muted-foreground text-xs">
          The existing reason, condition, and supporting records will remain in
          history. {reviewLaterHandlingPreview(preview.reviewLaterHandling)}
        </p>
      ) : null}
      <dl className="space-y-3 rounded-md border border-border/70 p-3 text-sm">
        <div>
          <dt className="font-medium text-xs">Reason</dt>
          <dd className="mt-1 whitespace-pre-wrap">{preview.reason}</dd>
        </div>
        {preview.condition ? (
          <div>
            <dt className="font-medium text-xs">Re-evaluation condition</dt>
            <dd className="mt-1 whitespace-pre-wrap">{preview.condition}</dd>
          </div>
        ) : null}
        <div>
          <dt className="font-medium text-xs">Supporting records</dt>
          <dd className="mt-1">
            <ul className="space-y-1">
              {preview.groundRelationIds.map((relationId) => {
                const source = groundOptions.find(
                  (candidate) => candidate.relationId === relationId,
                );
                return source ? (
                  <li key={relationId}>
                    {source.recordType}: {source.title ?? source.label}
                  </li>
                ) : null;
              })}
            </ul>
            {preview.groundRelationIds.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                No supporting records selected.
              </p>
            ) : null}
          </dd>
        </div>
      </dl>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          disabled={pending}
          onClick={onEdit}
          type="button"
          variant="outline"
        >
          Edit
        </Button>
        <Button
          disabled={pending || connection === "offline"}
          onClick={onConfirm}
          type="button"
        >
          Confirm Not now
        </Button>
      </DialogFooter>
    </div>
  );
}

function shouldRenderNotNowControl(
  compact: boolean,
  canStart: boolean,
  hasActiveTrail: boolean,
  hasHistory: boolean,
) {
  return compact ? hasActiveTrail : canStart || hasActiveTrail || hasHistory;
}

export function initialNotNowDialogMode(
  canStart: boolean,
  hasActiveTrail: boolean,
): Mode {
  return hasActiveTrail || !canStart ? "details" : "form";
}

function WorkNotNowDialog({
  activeFromWork,
  onOpenChange,
  work,
}: {
  activeFromWork: WorkNotNowTrail | null;
  onOpenChange: (open: boolean) => void;
  work: WorkProfile;
}) {
  const canStart = work.status !== "Closed" && work.archivedAt === null;
  const [mode, setMode] = useState<Mode>(
    initialNotNowDialogMode(canStart, activeFromWork !== null),
  );
  const [draft, setDraft] = useState<NotNowDraft>({
    condition: "",
    groundRelationIds: [],
    reason: "",
    reviewLaterHandling: "Keep Review later",
  });
  const [preview, setPreview] = useState<NotNowPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recordRetry = useRef<{ fingerprint: string; key: string } | null>(null);
  const reconsiderRetry = useRef<{ event: string; key: string } | null>(null);
  const queryClient = useQueryClient();
  const connection = useClientShellConnection();
  const historyQuery = useQuery({
    ...orpc.workNotNowHistory.queryOptions({ input: { workId: work.id } }),
  });
  const workContextQuery = useQuery({
    ...orpc.workContext.queryOptions({ input: { workId: work.id } }),
  });

  const history = historyQuery.data;
  const currentTrail = history
    ? (history.find((trail) => trail.status === "Active") ?? null)
    : activeFromWork;
  const latestRevision =
    history?.reduce(
      (revision, trail) => Math.max(revision, trail.revision),
      0,
    ) ??
    work.notNow?.revision ??
    0;
  const workContext = workContextQuery.data
    ? buildWorkContextModel({
        priorityValues: workContextQuery.data.priorityValues,
        relations: workContextQuery.data.relations,
        work,
      })
    : null;
  const groundOptions = (workContext?.sources ?? []).filter(
    (source) =>
      source.relationId !== null &&
      source.broken === null &&
      groundRecordTypes.has(source.recordType),
  );

  async function refreshWorkNotNow() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
      queryClient.invalidateQueries({
        queryKey: orpc.workNotNowHistory.queryOptions({
          input: { workId: work.id },
        }).queryKey,
      }),
    ]);
  }

  const recordNotNow = useMutation({
    mutationFn: (input: Parameters<typeof client.recordWorkNotNow>[0]) =>
      runOnlineOnlyWrite(() => client.recordWorkNotNow(input)),
    onError: (mutationError) => setError(errorMessage(mutationError)),
    onSuccess: async () => {
      recordRetry.current = null;
      setError(null);
      setMode("details");
      await refreshWorkNotNow();
    },
  });

  const reconsiderNotNow = useMutation({
    mutationFn: (input: Parameters<typeof client.reconsiderWorkNotNow>[0]) =>
      runOnlineOnlyWrite(() => client.reconsiderWorkNotNow(input)),
    onError: (mutationError) => setError(errorMessage(mutationError)),
    onSuccess: async () => {
      reconsiderRetry.current = null;
      setError(null);
      setMode("details");
      await refreshWorkNotNow();
    },
  });

  function startNewTrail() {
    setDraft({
      condition: "",
      groundRelationIds: [],
      reason: "",
      reviewLaterHandling: "Keep Review later",
    });
    setPreview(null);
    setError(null);
    setMode("form");
  }

  function confirmNotNow() {
    if (!preview) {
      return;
    }
    const fingerprint = JSON.stringify({
      condition: preview.condition,
      groundRelationIds: preview.groundRelationIds,
      reason: preview.reason,
      workId: preview.workId,
    });
    const clientIdempotencyKey =
      recordRetry.current?.fingerprint === fingerprint
        ? recordRetry.current.key
        : crypto.randomUUID();
    recordRetry.current = { fingerprint, key: clientIdempotencyKey };
    setError(null);
    recordNotNow.mutate({ ...preview, clientIdempotencyKey });
  }

  function confirmReconsidering() {
    if (!currentTrail) {
      return;
    }
    const event = JSON.stringify({
      baseRevision: latestRevision,
      trailId: currentTrail.id,
      reviewLaterHandling: draft.reviewLaterHandling,
      workId: work.id,
    });
    const clientIdempotencyKey =
      reconsiderRetry.current?.event === event
        ? reconsiderRetry.current.key
        : crypto.randomUUID();
    reconsiderRetry.current = { event, key: clientIdempotencyKey };
    setError(null);
    reconsiderNotNow.mutate({
      baseRevision: latestRevision,
      clientIdempotencyKey,
      reviewLaterHandling: draft.reviewLaterHandling,
      trailId: currentTrail.id,
      workId: work.id,
    });
  }

  function previewDraft(nextPreview: NotNowPreview) {
    setPreview(nextPreview);
    setMode("preview");
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setError(null);
        }
        onOpenChange(nextOpen);
      }}
      open
    >
      <DialogContent className="max-h-[calc(100svh-2rem)] max-w-xl overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>Not now</DialogTitle>
          <DialogDescription>
            Record a reason and optional re-evaluation condition. Work status,
            priority, Backlog order, Roadmap horizon, dates, and planning
            membership stay unchanged.
          </DialogDescription>
        </DialogHeader>
        {mode === "details" ? (
          <NotNowHistoryPanel
            activeFromWork={activeFromWork}
            archived={work.archivedAt !== null}
            canStart={canStart}
            connection={connection}
            currentTrail={currentTrail}
            history={history}
            historyError={historyQuery.isError}
            historyPending={historyQuery.isPending}
            onReconsider={confirmReconsidering}
            onReviewLaterHandlingChange={(reviewLaterHandling) =>
              setDraft((current) => ({ ...current, reviewLaterHandling }))
            }
            onStartNew={startNewTrail}
            reconsiderPending={reconsiderNotNow.isPending}
            reviewLaterHandling={draft.reviewLaterHandling}
            sources={workContext?.sources ?? []}
            workContextError={workContextQuery.isError}
            workId={work.id}
          />
        ) : null}
        {mode === "form" ? (
          <NotNowEntryForm
            baseRevision={latestRevision}
            connection={connection}
            draft={draft}
            error={error}
            groundOptions={groundOptions}
            hasActiveTrail={currentTrail !== null}
            hasHistory={(history?.length ?? 0) > 0}
            onDraftChange={setDraft}
            onError={setError}
            onPreview={previewDraft}
            onShowHistory={() => setMode("details")}
            pending={recordNotNow.isPending}
            workContextError={workContextQuery.isError}
            workContextPending={workContextQuery.isPending}
            workId={work.id}
          />
        ) : null}
        {mode === "preview" && preview ? (
          <NotNowPreviewPanel
            connection={connection}
            currentTrail={currentTrail}
            error={error}
            groundOptions={groundOptions}
            onConfirm={confirmNotNow}
            onEdit={() => setMode("form")}
            pending={recordNotNow.isPending}
            preview={preview}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function WorkNotNowControl({
  compact = false,
  work,
}: {
  compact?: boolean;
  work: WorkProfile;
}) {
  const activeFromWork = work.notNow?.activeTrail ?? null;
  const canStart = work.status !== "Closed" && work.archivedAt === null;
  const shouldShow = shouldRenderNotNowControl(
    compact,
    canStart,
    activeFromWork !== null,
    (work.notNow?.revision ?? 0) > 0,
  );
  const [open, setOpen] = useState(false);

  if (!shouldShow) {
    return null;
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={
          activeFromWork ? `Not now: ${activeFromWork.reason}` : "Not now"
        }
        className={compact ? "h-6 shrink-0 px-2 text-[11px]" : ""}
        onClick={() => setOpen(true)}
        size={compact ? "xs" : "sm"}
        type="button"
        variant={activeFromWork ? "secondary" : "outline"}
      >
        {activeFromWork ? <Badge variant="outline">Not now</Badge> : "Not now"}
      </Button>
      {open ? (
        <WorkNotNowDialog
          activeFromWork={activeFromWork}
          onOpenChange={setOpen}
          work={work}
        />
      ) : null}
    </>
  );
}
