// biome-ignore-all lint/performance/noJsxPropsBind: Controls close over one Work and its previewed trail.

import type { WorkContextSource } from "@cantiara/api/work-context";
import { buildWorkContextModel } from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import {
  recordWorkNotNowInputSchema,
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
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc, projectWorksQueryPrefix } from "@/utils/orpc";

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
              <a
                className="underline-offset-4 hover:underline"
                href={source.openPath}
              >
                {ground.recordType}: {ground.title}
              </a>
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

interface NotNowDraft {
  condition: string;
  groundRelationIds: string[];
  reason: string;
  reviewLaterHandling: WorkNotNowReviewLaterHandling;
}

type NotNowPreview = ReturnType<typeof recordWorkNotNowInputSchema.parse>;

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
      {!archived && (currentTrail || canStart) ? (
        <div className="space-y-3 border-t pt-3">
          {currentTrail ? (
            <ReviewLaterHandlingField
              name={`not-now-review-later-handling-${workId}`}
              onChange={onReviewLaterHandlingChange}
              pending={reconsiderPending || historyPending}
              value={reviewLaterHandling}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {currentTrail ? (
              <Button
                disabled={
                  reconsiderPending ||
                  historyPending ||
                  connection === "offline"
                }
                onClick={onReconsider}
                type="button"
                variant="outline"
              >
                Reconsidering
              </Button>
            ) : null}
            {canStart ? (
              <Button onClick={onStartNew} type="button">
                Not now
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

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
    defaultValues: { condition: draft.condition, reason: draft.reason },
    onSubmit: ({ value }) => {
      const parsed = recordWorkNotNowInputSchema.safeParse({
        baseRevision,
        clientIdempotencyKey: "preview",
        condition: value.condition,
        groundRelationIds: draft.groundRelationIds,
        reason: value.reason,
        reviewLaterHandling: draft.reviewLaterHandling,
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
      <SupportingRecordsField
        draft={draft}
        groundOptions={groundOptions}
        onDraftChange={onDraftChange}
        pending={pending}
        workContextError={workContextError}
        workContextPending={workContextPending}
      />
      {hasActiveTrail ? (
        <ReviewLaterHandlingField
          name={`not-now-review-later-handling-${workId}`}
          onChange={(reviewLaterHandling) =>
            onDraftChange((current) => ({
              ...current,
              reviewLaterHandling,
            }))
          }
          pending={pending}
          value={draft.reviewLaterHandling}
        />
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
  draft,
  groundOptions,
  onDraftChange,
  pending,
  workContextError,
  workContextPending,
}: {
  draft: NotNowDraft;
  groundOptions: readonly WorkContextSource[];
  onDraftChange: (update: (draft: NotNowDraft) => NotNowDraft) => void;
  pending: boolean;
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
            key={relationId}
          >
            <input
              checked={draft.groundRelationIds.includes(relationId)}
              onChange={(event) => {
                const { checked } = event.currentTarget;
                onDraftChange((current) => ({
                  ...current,
                  groundRelationIds: checked
                    ? [...current.groundRelationIds, relationId]
                    : current.groundRelationIds.filter(
                        (id) => id !== relationId,
                      ),
                }));
              }}
              type="checkbox"
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

function reviewLaterHandlingPreview(handling: WorkNotNowReviewLaterHandling) {
  return handling === "Keep Review later"
    ? "Planned Review Later reminders will stay scheduled."
    : "Planned Review Later reminders for this Work will be cancelled.";
}

function ReviewLaterHandlingField({
  name,
  onChange,
  pending,
  value,
}: {
  name: string;
  onChange: (handling: WorkNotNowReviewLaterHandling) => void;
  pending: boolean;
  value: WorkNotNowReviewLaterHandling;
}) {
  return (
    <fieldset className="space-y-2" disabled={pending}>
      <legend className="font-medium text-xs">Review Later reminders</legend>
      {(
        [
          [
            "Keep Review later",
            "Leave planned Review Later reminders scheduled.",
          ],
          [
            "Remove Review later",
            "Cancel planned Review Later reminders for this Work.",
          ],
        ] as const
      ).map(([handling, description]) => (
        <label
          className="flex items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-xs"
          key={handling}
        >
          <input
            checked={value === handling}
            name={name}
            onChange={() => onChange(handling)}
            type="radio"
          />
          <span>
            <span className="block font-medium">{handling}</span>
            <span className="text-muted-foreground">{description}</span>
          </span>
        </label>
      ))}
      <p aria-live="polite" className="text-muted-foreground text-xs">
        Preview: {reviewLaterHandlingPreview(value)}
      </p>
    </fieldset>
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
