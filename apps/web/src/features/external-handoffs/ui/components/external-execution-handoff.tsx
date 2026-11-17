// biome-ignore-all lint/performance/noJsxPropsBind: Work-owned handoff controls close over their Work, form, and package state.

import {
  type ConfirmExternalExecutionHandoffReconcileInput,
  type ExternalExecutionHandoff,
  type ExternalExecutionHandoffHistoryEvent,
  type ExternalExecutionHandoffReconcilePreview,
  type ExternalExecutionHandoffRelatedWork,
  isTerminalExternalExecutionHandoffStatus,
  type PreviewExternalExecutionHandoffReconcileInput,
  type RecordExternalExecutionHandoffReturnInput,
} from "@cantiara/api/external-handoffs";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { useExternalExecutionHandoffs } from "@/features/external-handoffs/hooks/use-external-handoffs";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { writeTextToClipboard } from "@/lib/clipboard";
import { CancelHandoffForm } from "../forms/cancel-handoff-form";
import { HandoffReconcileForm } from "../forms/handoff-reconcile-form";
import { HandoffReturnForm } from "../forms/handoff-return-form";
import { StartHandoffForm } from "../forms/start-handoff-form";

const HISTORY_EVENT_LABELS: Record<
  ExternalExecutionHandoffHistoryEvent["eventType"],
  string
> = {
  "external-execution-handoff-canceled": "Canceled",
  "external-execution-handoff-package-exported": "Going package copied",
  "external-execution-handoff-package-produced": "Going package produced",
  "external-execution-handoff-reconciled": "Reconciled",
  "external-execution-handoff-return-recorded": "Result returned",
  "external-execution-handoff-started": "Handoff started",
};

function HandoffHistory({
  events,
}: {
  events: readonly ExternalExecutionHandoffHistoryEvent[];
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section aria-label="Handoff history" className="space-y-2">
      <h5 className="font-medium text-xs">Handoff history</h5>
      <ul className="space-y-1 text-muted-foreground text-xs">
        {events.map((event) => (
          <li key={event.eventId}>
            {HISTORY_EVENT_LABELS[event.eventType]} by You
            {" · "}
            <time dateTime={event.occurredAt}>{event.occurredAt}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReturnList({
  items,
  label,
}: {
  items: readonly string[];
  label: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div>
      <h6 className="font-medium text-xs">{label}</h6>
      <ul className="list-inside list-disc text-muted-foreground text-xs">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function HandoffResult({ handoff }: { handoff: ExternalExecutionHandoff }) {
  if (!handoff.result) {
    return null;
  }

  return (
    <section
      aria-label="Result returned"
      className="space-y-2 rounded-sm bg-muted/35 p-3"
    >
      <div>
        <h6 className="font-medium text-xs">Executor summary</h6>
        <p className="whitespace-pre-wrap text-xs">
          {handoff.result.executorSummary}
        </p>
      </div>
      <ReturnList
        items={handoff.result.changedAssumptions}
        label="Changed assumptions"
      />
      <ReturnList
        items={handoff.result.producedEvidence}
        label="Produced evidence"
      />
      <ReturnList
        items={handoff.result.externalLinks}
        label="Permitted external links"
      />
      <ReturnList items={handoff.result.openQuestions} label="Open questions" />
      <time
        className="block font-mono text-[11px] text-muted-foreground"
        dateTime={handoff.result.returnedAt}
      >
        {handoff.result.returnedAt}
      </time>
    </section>
  );
}

function HandoffStatusControls({
  confirmDisabled,
  handoff,
  onConfirm,
  onPreview,
  onRecordReturn,
  previewDisabled,
  recordReturnDisabled,
  relatedWorks,
  work,
}: {
  confirmDisabled: boolean;
  handoff: ExternalExecutionHandoff;
  onConfirm: (
    input: ConfirmExternalExecutionHandoffReconcileInput,
  ) => Promise<unknown>;
  onPreview: (
    input: PreviewExternalExecutionHandoffReconcileInput,
  ) => Promise<ExternalExecutionHandoffReconcilePreview>;
  onRecordReturn: (
    input: RecordExternalExecutionHandoffReturnInput,
  ) => Promise<unknown>;
  previewDisabled: boolean;
  recordReturnDisabled: boolean;
  relatedWorks: readonly ExternalExecutionHandoffRelatedWork[];
  work: WorkProfile;
}) {
  if (work.archivedAt !== null) {
    return null;
  }

  switch (handoff.status) {
    case "Open":
      return (
        <HandoffReturnForm
          disabled={recordReturnDisabled}
          handoffId={handoff.handoffId}
          onRecordReturn={onRecordReturn}
        />
      );
    case "Result returned":
      return (
        <HandoffReconcileForm
          disabled={previewDisabled || confirmDisabled}
          handoffId={handoff.handoffId}
          onConfirm={onConfirm}
          onPreview={onPreview}
          relatedWorks={relatedWorks}
          workKey={work.key}
        />
      );
    case "Reconciled":
      if (!handoff.reconcileDecision) {
        return null;
      }
      return (
        <section
          aria-label="Reconciled"
          className="space-y-1 rounded-sm bg-muted/35 p-3"
        >
          <p className="font-medium text-xs">Reconciled</p>
          <time
            className="block font-mono text-[11px] text-muted-foreground"
            dateTime={handoff.reconcileDecision.confirmedAt}
          >
            {handoff.reconcileDecision.confirmedAt}
          </time>
          {handoff.reconcileDecision.createdFollowUpWorks.map((createdWork) => (
            <p className="text-xs" key={createdWork.id}>
              {createdWork.key} · {createdWork.title}
            </p>
          ))}
        </section>
      );
    default:
      return null;
  }
}

export default function ExternalExecutionHandoffPanel({
  defaultExpanded = false,
  work,
}: {
  defaultExpanded?: boolean;
  work: WorkProfile;
}) {
  const connection = useClientShellConnection();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [formError, setFormError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [copiedHandoffId, setCopiedHandoffId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const {
    cancel,
    confirmReconcile,
    history,
    previewReconcile,
    query,
    recordPackageExport,
    recordReturn,
    relatedWorks,
    start,
  } = useExternalExecutionHandoffs(work, expanded);
  const pending =
    start.isPending ||
    cancel.isPending ||
    recordPackageExport.isPending ||
    connection === "offline";

  async function copyPackage(handoffId: string, markdown: string) {
    setCopyError(null);
    setCopiedHandoffId(null);
    try {
      await writeTextToClipboard(markdown);
    } catch {
      setCopyError("Going package could not be copied.");
      return;
    }
    setCopiedHandoffId(handoffId);
    try {
      await recordPackageExport.mutateAsync({
        clientEventId: crypto.randomUUID(),
        handoffId,
      });
    } catch {
      setCopyError(
        "Going package was copied, but its Work history could not be recorded.",
      );
    }
  }

  return (
    <section
      aria-labelledby={`external-execution-handoff-${work.id}-heading`}
      className="rounded-md border border-border/70 bg-background/45 p-3"
      data-external-execution-handoff="true"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4
            className="font-medium text-sm"
            id={`external-execution-handoff-${work.id}-heading`}
          >
            External Execution Handoff
          </h4>
          <p className="text-muted-foreground text-xs">
            A dated package stays attached to {work.key}.
          </p>
        </div>
        <Button
          disabled={connection === "offline"}
          onClick={() => {
            setExpanded(true);
            setWriteError(null);
            setFormError(null);
          }}
          size="xs"
          type="button"
          variant="outline"
        >
          {work.archivedAt === null ? "Start Handoff" : "View Handoffs"}
        </Button>
      </header>

      {expanded ? (
        <div className="mt-4 space-y-4 border-border/70 border-t pt-4">
          {query.isPending ? (
            <p className="text-muted-foreground text-xs" role="status">
              Loading External Execution Handoffs…
            </p>
          ) : null}
          {query.isError ? (
            <p className="text-destructive text-xs" role="alert">
              External Execution Handoffs could not be loaded. Try again.
            </p>
          ) : null}
          <HandoffHistory events={history.data ?? []} />
          {history.isError ? (
            <p className="text-destructive text-xs" role="alert">
              Handoff history could not be loaded. Try again.
            </p>
          ) : null}
          {query.data?.map((handoff) => (
            <article
              className="space-y-3 border-border/70 border-l-2 pl-3"
              key={handoff.handoffId}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="min-w-0 font-medium text-xs">
                  {handoff.purpose}{" "}
                  <span className="text-muted-foreground">
                    · {handoff.status}
                  </span>
                </p>
                <div className="text-right">
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {handoff.handoffId}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {handoff.packageProducedAt}
                  </p>
                </div>
              </div>
              {handoff.selectedWorkRevision === null ? null : (
                <p className="font-mono text-[11px] text-muted-foreground">
                  {work.key} · revision {handoff.selectedWorkRevision}
                </p>
              )}
              {handoff.status === "Canceled" ? (
                <p className="text-muted-foreground text-xs">
                  <span className="font-medium">Reason</span>:{" "}
                  {handoff.cancellationReason}
                </p>
              ) : null}
              {work.archivedAt === null &&
              !isTerminalExternalExecutionHandoffStatus(handoff.status) ? (
                <CancelHandoffForm
                  handoffId={handoff.handoffId}
                  onCancel={(input) => cancel.mutateAsync(input)}
                  pending={pending}
                />
              ) : null}
              <details
                className="group rounded-sm border border-border/70 bg-card/55"
                open
              >
                <summary className="cursor-pointer px-3 py-2 font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Going package
                </summary>
                <div className="space-y-2 border-border/70 border-t p-3">
                  <p className="text-muted-foreground text-xs" role="note">
                    Free text is copied as entered and is not scanned for
                    secrets. Review the package before sharing.
                  </p>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                    {handoff.packageMarkdown}
                  </pre>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      copyPackage(handoff.handoffId, handoff.packageMarkdown)
                    }
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    Copy going package
                  </Button>
                  {copiedHandoffId === handoff.handoffId ? (
                    <p className="text-muted-foreground text-xs" role="status">
                      Going package copied.
                    </p>
                  ) : null}
                </div>
              </details>
              <HandoffResult handoff={handoff} />
              <HandoffStatusControls
                confirmDisabled={confirmReconcile.isPending}
                handoff={handoff}
                onConfirm={(input) => confirmReconcile.mutateAsync(input)}
                onPreview={(input) => previewReconcile.mutateAsync(input)}
                onRecordReturn={(input) => recordReturn.mutateAsync(input)}
                previewDisabled={
                  previewReconcile.isPending || connection === "offline"
                }
                recordReturnDisabled={
                  recordReturn.isPending || connection === "offline"
                }
                relatedWorks={relatedWorks.data ?? []}
                work={work}
              />
            </article>
          ))}
          {copyError ? (
            <p className="text-destructive text-xs" role="alert">
              {copyError}
            </p>
          ) : null}

          <StartHandoffForm
            formError={formError}
            onClearErrors={() => {
              setFormError(null);
              setWriteError(null);
              setCopyError(null);
            }}
            onFormError={setFormError}
            onStart={(input) => start.mutateAsync(input)}
            onWriteError={setWriteError}
            pending={pending}
            work={work}
            writeError={writeError}
          />
        </div>
      ) : null}
    </section>
  );
}
