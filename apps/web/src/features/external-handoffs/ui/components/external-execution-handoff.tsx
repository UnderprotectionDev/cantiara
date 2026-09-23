// biome-ignore-all lint/performance/noJsxPropsBind: Work-owned handoff controls close over their Work, form, and package state.

import type {
  CancelExternalExecutionHandoffInput,
  ConfirmExternalExecutionHandoffReconcileInput,
  ExternalExecutionHandoff,
  ExternalExecutionHandoffHistoryEvent,
  ExternalExecutionHandoffReconcilePreview,
  ExternalExecutionHandoffRelatedWork,
  PreviewExternalExecutionHandoffReconcileInput,
  RecordExternalExecutionHandoffReturnInput,
} from "@cantiara/api/external-handoffs";
import {
  cancelExternalExecutionHandoffInputSchema,
  externalExecutionHandoffInputSchema,
  externalExecutionHandoffResultInputSchema,
  isTerminalExternalExecutionHandoffStatus,
} from "@cantiara/api/external-handoffs";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useRef, useState } from "react";
import { useExternalExecutionHandoffs } from "@/features/external-handoffs/hooks/use-external-handoffs";
import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { writeTextToClipboard } from "@/lib/clipboard";

interface HandoffDraft {
  constraints: string;
  executor: string;
  expectedOutput: string;
  githubContextText: string;
  includeWork: boolean;
  purpose: string;
}

const EMPTY_DRAFT: HandoffDraft = {
  constraints: "",
  executor: "",
  expectedOutput: "",
  githubContextText: "",
  includeWork: true,
  purpose: "",
};

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


function CancelHandoffForm({
  handoffId,
  onCancel,
  pending,
}: {
  handoffId: string;
  onCancel: (input: CancelExternalExecutionHandoffInput) => Promise<unknown>;
  pending: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const retryInput = useRef<{
    clientEventId: string;
    reason: string;
  } | null>(null);
  const form = useForm({
    defaultValues: { reason: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const reason = value.reason.trim();
      const clientEventId =
        retryInput.current?.reason === reason
          ? retryInput.current.clientEventId
          : crypto.randomUUID();
      const parsed = cancelExternalExecutionHandoffInputSchema.safeParse({
        clientEventId,
        handoffId,
        reason: value.reason,
      });
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ?? "Check the cancellation reason.",
        );
        return;
      }
      retryInput.current = { clientEventId, reason: parsed.data.reason };
      try {
        await onCancel(parsed.data);
        retryInput.current = null;
        form.reset();
      } catch (cancelError) {
        setError(errorMessage(cancelError));
      }
    },
  });

  return (
    <form
      aria-label="Cancel Handoff"
      className="space-y-2 rounded-sm border border-border/70 bg-card/45 p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await form.handleSubmit();
      }}
    >
      <form.Field name="reason">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={`handoff-cancel-reason-${handoffId}`}>
              Reason
            </FieldLabel>
            <Textarea
              disabled={pending}
              id={`handoff-cancel-reason-${handoffId}`}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              rows={2}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} size="sm" type="submit" variant="outline">
        Cancel Handoff
      </Button>
    </form>
  );
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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

function HandoffReturnForm({
  disabled,
  handoffId,
  onRecordReturn,
}: {
  disabled: boolean;
  handoffId: string;
  onRecordReturn: (
    input: RecordExternalExecutionHandoffReturnInput,
  ) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState({
    changedAssumptions: "",
    executorSummary: "",
    externalLinks: "",
    openQuestions: "",
    producedEvidence: "",
  });
  const [error, setError] = useState<string | null>(null);
  const id = `handoff-return-${handoffId}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const parsed = externalExecutionHandoffResultInputSchema.safeParse({
      changedAssumptions: lines(draft.changedAssumptions),
      executorSummary: draft.executorSummary,
      externalLinks: lines(draft.externalLinks),
      openQuestions: lines(draft.openQuestions),
      producedEvidence: lines(draft.producedEvidence),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the return details.");
      return;
    }
    try {
      await onRecordReturn({
        ...parsed.data,
        clientEventId: crypto.randomUUID(),
        handoffId,
      });
    } catch (submitError) {
      setError(errorMessage(submitError));
    }
  }

  return (
    <form
      aria-label="Record return"
      className="space-y-3 rounded-md border border-border/70 bg-card/45 p-3"
      onSubmit={submit}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-summary`}>Executor summary</FieldLabel>
          <Textarea
            disabled={disabled}
            id={`${id}-summary`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                executorSummary: event.target.value,
              }))
            }
            required
            rows={3}
            value={draft.executorSummary}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-assumptions`}>
            Changed assumptions
          </FieldLabel>
          <Textarea
            disabled={disabled}
            id={`${id}-assumptions`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                changedAssumptions: event.target.value,
              }))
            }
            rows={3}
            value={draft.changedAssumptions}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-evidence`}>Produced evidence</FieldLabel>
          <Textarea
            disabled={disabled}
            id={`${id}-evidence`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                producedEvidence: event.target.value,
              }))
            }
            rows={3}
            value={draft.producedEvidence}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-links`}>
            Permitted external links
          </FieldLabel>
          <Textarea
            disabled={disabled}
            id={`${id}-links`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                externalLinks: event.target.value,
              }))
            }
            rows={3}
            value={draft.externalLinks}
          />
        </Field>
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor={`${id}-questions`}>Open questions</FieldLabel>
          <Textarea
            disabled={disabled}
            id={`${id}-questions`}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                openQuestions: event.target.value,
              }))
            }
            rows={3}
            value={draft.openQuestions}
          />
        </Field>
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={disabled} size="sm" type="submit">
        Record return
      </Button>
    </form>
  );
}

type RelationDraft =
  PreviewExternalExecutionHandoffReconcileInput["proposedRelations"][number];
type FollowUpWorkDraft =
  PreviewExternalExecutionHandoffReconcileInput["followUpWorks"][number];

function ReconcileFlow({
  disabled,
  handoff,
  onConfirm,
  onPreview,
  relatedWorks,
  work,
}: {
  disabled: boolean;
  handoff: ExternalExecutionHandoff;
  onConfirm: (
    input: ConfirmExternalExecutionHandoffReconcileInput,
  ) => Promise<unknown>;
  onPreview: (
    input: PreviewExternalExecutionHandoffReconcileInput,
  ) => Promise<ExternalExecutionHandoffReconcilePreview>;
  relatedWorks: readonly ExternalExecutionHandoffRelatedWork[];
  work: WorkProfile;
}) {
  const [relations, setRelations] = useState<RelationDraft[]>([]);
  const [followUpWorks, setFollowUpWorks] = useState<FollowUpWorkDraft[]>([]);
  const [preview, setPreview] =
    useState<ExternalExecutionHandoffReconcilePreview | null>(null);
  const [selectedRelationIds, setSelectedRelationIds] = useState<string[]>([]);
  const [selectedFollowUpWorkIds, setSelectedFollowUpWorkIds] = useState<
    string[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const plan: PreviewExternalExecutionHandoffReconcileInput = {
    followUpWorks: followUpWorks.map((item) => ({
      ...item,
      description: item.description?.trim() || null,
      title: item.title.trim(),
    })),
    handoffId: handoff.handoffId,
    proposedRelations: relations,
  };

  async function makePreview() {
    setError(null);
    try {
      const nextPreview = await onPreview(plan);
      setPreview(nextPreview);
      setSelectedRelationIds(nextPreview.proposedRelations.map(({ id }) => id));
      setSelectedFollowUpWorkIds(nextPreview.followUpWorks.map(({ id }) => id));
    } catch (previewError) {
      setError(errorMessage(previewError));
    }
  }

  async function confirm() {
    if (!preview) {
      return;
    }
    setError(null);
    try {
      await onConfirm({
        ...plan,
        clientEventId: crypto.randomUUID(),
        previewId: preview.previewId,
        selectedFollowUpWorkIds,
        selectedRelationIds,
      });
      setPreview(null);
    } catch (confirmError) {
      setError(errorMessage(confirmError));
    }
  }

  return (
    <details className="rounded-sm border border-border/70 bg-card/45">
      <summary className="cursor-pointer px-3 py-2 font-medium text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Reconcile
      </summary>
      <div className="space-y-3 border-border/70 border-t p-3">
        {preview ? (
          <section aria-label="Reconcile" className="space-y-3">
            <p className="text-muted-foreground text-xs">
              Review each relation and Follow-up Work before confirming.
            </p>
            {preview.proposedRelations.map((relation) => (
              <label
                className="flex items-start gap-2 text-xs"
                htmlFor={`handoff-relation-${relation.id}`}
                key={relation.id}
              >
                <Checkbox
                  checked={selectedRelationIds.includes(relation.id)}
                  disabled={disabled}
                  id={`handoff-relation-${relation.id}`}
                  onCheckedChange={(checked) =>
                    setSelectedRelationIds((current) =>
                      checked === true
                        ? [...current, relation.id]
                        : current.filter((id) => id !== relation.id),
                    )
                  }
                />
                <span>
                  {relation.kind} {relation.target.key} ·{" "}
                  {relation.target.title}
                </span>
              </label>
            ))}
            {preview.followUpWorks.map((followUpWork) => (
              <label
                className="flex items-start gap-2 text-xs"
                htmlFor={`handoff-follow-up-${followUpWork.id}`}
                key={followUpWork.id}
              >
                <Checkbox
                  checked={selectedFollowUpWorkIds.includes(followUpWork.id)}
                  disabled={disabled}
                  id={`handoff-follow-up-${followUpWork.id}`}
                  onCheckedChange={(checked) =>
                    setSelectedFollowUpWorkIds((current) =>
                      checked === true
                        ? [...current, followUpWork.id]
                        : current.filter((id) => id !== followUpWork.id),
                    )
                  }
                />
                <span>
                  Follow-up Work · {followUpWork.title} ({followUpWork.type}) ·
                  Origin {work.key}
                  {followUpWork.description
                    ? ` · ${followUpWork.description}`
                    : ""}
                </span>
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled}
                onClick={() => {
                  setError(null);
                  setPreview(null);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Reject
              </Button>
              <Button
                disabled={disabled}
                onClick={confirm}
                size="sm"
                type="button"
              >
                Reconcile
              </Button>
            </div>
          </section>
        ) : (
          <>
            <fieldset className="space-y-3 rounded-sm border border-border/70 p-3">
              <legend className="px-1 font-medium text-xs">
                Proposed relations
              </legend>
              {relations.map((relation) => (
                <div
                  className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
                  key={relation.id}
                >
                  <Field>
                    <FieldLabel
                      htmlFor={`handoff-relation-kind-${relation.id}`}
                    >
                      Relation
                    </FieldLabel>
                    <NativeSelect
                      disabled={disabled}
                      id={`handoff-relation-kind-${relation.id}`}
                      onChange={(event) =>
                        setRelations((current) =>
                          current.map((item) =>
                            item.id === relation.id
                              ? {
                                  ...item,
                                  kind: event.target
                                    .value as RelationDraft["kind"],
                                }
                              : item,
                          ),
                        )
                      }
                      value={relation.kind}
                    >
                      <NativeSelectOption value="Related">
                        Related
                      </NativeSelectOption>
                      <NativeSelectOption value="Origin">
                        Origin
                      </NativeSelectOption>
                      <NativeSelectOption value="Blocks">
                        Blocks
                      </NativeSelectOption>
                      <NativeSelectOption value="Blocked by">
                        Blocked by
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`handoff-related-work-${relation.id}`}>
                      Related Work
                    </FieldLabel>
                    <NativeSelect
                      disabled={disabled || relatedWorks.length === 0}
                      id={`handoff-related-work-${relation.id}`}
                      onChange={(event) =>
                        setRelations((current) =>
                          current.map((item) =>
                            item.id === relation.id
                              ? { ...item, targetWorkId: event.target.value }
                              : item,
                          ),
                        )
                      }
                      value={relation.targetWorkId}
                    >
                      {relatedWorks.map((candidate) => (
                        <NativeSelectOption
                          key={candidate.id}
                          value={candidate.id}
                        >
                          {candidate.key} · {candidate.title}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                  <Button
                    disabled={disabled}
                    onClick={() =>
                      setRelations((current) =>
                        current.filter((item) => item.id !== relation.id),
                      )
                    }
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Remove proposed relation
                  </Button>
                </div>
              ))}
              <Button
                disabled={
                  disabled ||
                  relatedWorks.length === 0 ||
                  relations.length >= 25
                }
                onClick={() =>
                  setRelations((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      kind: "Related",
                      targetWorkId: relatedWorks[0]?.id ?? "",
                    },
                  ])
                }
                size="sm"
                type="button"
                variant="outline"
              >
                Add proposed relation
              </Button>
            </fieldset>
            {followUpWorks.map((followUpWork) => (
              <fieldset
                className="grid gap-3 rounded-sm border border-border/70 p-3 sm:grid-cols-2"
                key={followUpWork.id}
              >
                <legend className="px-1 font-medium text-xs">
                  Follow-up Work
                </legend>
                <Field>
                  <FieldLabel
                    htmlFor={`handoff-follow-up-title-${followUpWork.id}`}
                  >
                    Title
                  </FieldLabel>
                  <Input
                    disabled={disabled}
                    id={`handoff-follow-up-title-${followUpWork.id}`}
                    onChange={(event) =>
                      setFollowUpWorks((current) =>
                        current.map((item) =>
                          item.id === followUpWork.id
                            ? { ...item, title: event.target.value }
                            : item,
                        ),
                      )
                    }
                    value={followUpWork.title}
                  />
                </Field>
                <Field>
                  <FieldLabel
                    htmlFor={`handoff-follow-up-type-${followUpWork.id}`}
                  >
                    Type
                  </FieldLabel>
                  <NativeSelect
                    disabled={disabled}
                    id={`handoff-follow-up-type-${followUpWork.id}`}
                    onChange={(event) =>
                      setFollowUpWorks((current) =>
                        current.map((item) =>
                          item.id === followUpWork.id
                            ? {
                                ...item,
                                type: event.target
                                  .value as FollowUpWorkDraft["type"],
                              }
                            : item,
                        ),
                      )
                    }
                    value={followUpWork.type}
                  >
                    <NativeSelectOption value="Task">Task</NativeSelectOption>
                    <NativeSelectOption value="Bug">Bug</NativeSelectOption>
                    <NativeSelectOption value="Feature">
                      Feature
                    </NativeSelectOption>
                    <NativeSelectOption value="Research">
                      Research
                    </NativeSelectOption>
                    <NativeSelectOption value="Improvement">
                      Improvement
                    </NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field className="sm:col-span-2">
                  <FieldLabel
                    htmlFor={`handoff-follow-up-description-${followUpWork.id}`}
                  >
                    Description
                  </FieldLabel>
                  <Textarea
                    disabled={disabled}
                    id={`handoff-follow-up-description-${followUpWork.id}`}
                    onChange={(event) =>
                      setFollowUpWorks((current) =>
                        current.map((item) =>
                          item.id === followUpWork.id
                            ? { ...item, description: event.target.value }
                            : item,
                        ),
                      )
                    }
                    rows={3}
                    value={followUpWork.description ?? ""}
                  />
                </Field>
                <Button
                  className="sm:col-span-2 sm:justify-self-start"
                  disabled={disabled}
                  onClick={() =>
                    setFollowUpWorks((current) =>
                      current.filter((item) => item.id !== followUpWork.id),
                    )
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Remove follow-up Work
                </Button>
              </fieldset>
            ))}
            <Button
              disabled={disabled || followUpWorks.length >= 25}
              onClick={() =>
                setFollowUpWorks((current) => [
                  ...current,
                  {
                    description: null,
                    id: crypto.randomUUID(),
                    title: "",
                    type: "Task",
                  },
                ])
              }
              size="sm"
              type="button"
              variant="outline"
            >
              Add follow-up Work
            </Button>
            <Button
              disabled={disabled}
              onClick={makePreview}
              size="sm"
              type="button"
            >
              Preview changes
            </Button>
          </>
        )}
        {error ? (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </details>
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
        <ReconcileFlow
          disabled={previewDisabled || confirmDisabled}
          handoff={handoff}
          onConfirm={onConfirm}
          onPreview={onPreview}
          relatedWorks={relatedWorks}
          work={work}
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

function githubIdentifiers(value: string) {
  return value
    .split("\n")
    .map((identifier) => identifier.trim())
    .filter(Boolean);
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "This handoff could not be written.";
}

export default function ExternalExecutionHandoff({
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
  const form = useForm({
    defaultValues: EMPTY_DRAFT,
    onSubmit: async ({ value }) => {
      setFormError(null);
      setWriteError(null);
      setCopyError(null);
      const parsed = externalExecutionHandoffInputSchema.safeParse({
        constraints: value.constraints,
        executor: value.executor,
        expectedOutput: value.expectedOutput,
        githubContext: githubIdentifiers(value.githubContextText),
        includeWork: value.includeWork,
        purpose: value.purpose,
        workId: work.id,
      });
      if (!parsed.success) {
        setFormError(
          parsed.error.issues[0]?.message ?? "Check the handoff details.",
        );
        return;
      }
      try {
        const { workId: _workId, ...input } = parsed.data;
        await start.mutateAsync(input);
        form.reset();
      } catch (error) {
        setWriteError(errorMessage(error));
      }
    },
  });
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

          <form
            aria-label="Start Handoff"
            className="space-y-4 rounded-md border border-border/70 bg-card/45 p-3"
            hidden={work.archivedAt !== null}
            onSubmit={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              await form.handleSubmit();
            }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h5 className="font-medium text-sm">Start Handoff</h5>
              <p className="font-mono text-[11px] text-muted-foreground">
                {work.key} · current revision {work.revision}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <form.Field name="purpose">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={`handoff-purpose-${work.id}`}>
                      Purpose
                    </FieldLabel>
                    <Textarea
                      disabled={pending}
                      id={`handoff-purpose-${work.id}`}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      rows={2}
                      value={field.state.value}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="executor">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={`handoff-executor-${work.id}`}>
                      Executor
                    </FieldLabel>
                    <Input
                      disabled={pending}
                      id={`handoff-executor-${work.id}`}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="expectedOutput">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={`handoff-output-${work.id}`}>
                      Expected output
                    </FieldLabel>
                    <Textarea
                      disabled={pending}
                      id={`handoff-output-${work.id}`}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      rows={2}
                      value={field.state.value}
                    />
                  </Field>
                )}
              </form.Field>
              <form.Field name="constraints">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={`handoff-constraints-${work.id}`}>
                      Constraints
                    </FieldLabel>
                    <Textarea
                      disabled={pending}
                      id={`handoff-constraints-${work.id}`}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      rows={2}
                      value={field.state.value}
                    />
                  </Field>
                )}
              </form.Field>
            </div>
            <fieldset className="space-y-3 rounded-sm border border-border/70 p-3">
              <legend className="px-1 font-medium text-xs">
                Selected versions
              </legend>
              <form.Field name="includeWork">
                {(field) => (
                  <label
                    className="flex items-center gap-2 text-xs"
                    htmlFor={`handoff-include-work-${work.id}`}
                  >
                    <Checkbox
                      checked={field.state.value}
                      disabled={pending}
                      id={`handoff-include-work-${work.id}`}
                      onCheckedChange={(checked) =>
                        field.handleChange(checked === true)
                      }
                    />
                    Include this Work · revision {work.revision}
                  </label>
                )}
              </form.Field>
              <form.Field name="githubContextText">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={`handoff-github-${work.id}`}>
                      GitHub context
                    </FieldLabel>
                    <Textarea
                      disabled={pending}
                      id={`handoff-github-${work.id}`}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="One permitted GitHub repository, issue, pull request, or commit URL per line"
                      rows={2}
                      value={field.state.value}
                    />
                    <FieldDescription>
                      Add only GitHub URLs you already have permission to see.
                      No repository is copied.
                    </FieldDescription>
                  </Field>
                )}
              </form.Field>
            </fieldset>
            {formError ? (
              <p className="text-destructive text-xs" role="alert">
                {formError}
              </p>
            ) : null}
            {writeError ? (
              <p className="text-destructive text-xs" role="alert">
                {writeError}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={pending} size="sm" type="submit">
                Start Handoff
              </Button>
              <p className="text-muted-foreground text-xs">
                Cantiara saves the package; it does not start an external tool.
              </p>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
