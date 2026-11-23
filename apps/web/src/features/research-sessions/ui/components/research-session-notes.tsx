// biome-ignore-all lint/performance/noJsxPropsBind: Note controls bind to the current session draft.

import type { ResearchEvidenceBinding } from "@cantiara/api/research-session-bindings";
import {
  type ResearchSessionNoteInput,
  type ResearchSessionRecord,
  researchSessionConsentGates,
  researchSessionNoteInputSchema,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { VirtualList } from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { ResearchBindingFeedbackView } from "@/features/feedback/ui/components/research-binding-feedback";
import {
  projectSourceRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";
import { orpc } from "@/utils/orpc";
import {
  type ResearchBindingActions,
  type ResearchBindingPreviewState,
  ResearchNoteBindingEditor,
} from "../forms/research-note-binding-form";
import {
  ResearchSessionNoteEditor,
  type SaveResearchNote,
} from "../forms/research-session-note-form";
import type { ResearchWriteState } from "../views/research-sessions-view";

type NoteKind = ResearchSessionNoteInput["kind"];
const noteStyles: Record<NoteKind, string> = {
  "Participant quote": "border-l-4 border-l-primary bg-muted/30",
  Observation: "border-l-4 border-l-border",
  "Founder interpretation": "border-dashed bg-muted/50",
};

export function ResearchSessionNotes({
  record,
  readOnly,
  onSave,
  onStartEditing,
  bindingActions,
  bindingPreview,
  bindingWrite,
  noteWrite,
}: {
  record: ResearchSessionRecord;
  readOnly: boolean;
  onSave: SaveResearchNote;
  onStartEditing: () => void;
  bindingActions?: ResearchBindingActions;
  bindingPreview?: ResearchBindingPreviewState;
  bindingWrite?: ResearchWriteState;
  noteWrite?: ResearchWriteState;
}) {
  const [draft, setEditing] = useState<{
    record: ResearchSessionRecord;
    note?: ResearchSessionNoteInput;
  } | null>(null);
  const saved = noteWrite?.isSuccess;
  const editing = saved ? null : draft;
  const [binding, setBindingDraft] = useState<{
    record: ResearchSessionRecord;
    note: ResearchSessionNoteInput;
    mode: "create" | "bind";
  }>();
  const bound = bindingWrite?.isSuccess;
  const bindingDraft = bound ? undefined : binding;
  const targetOptions = orpc.researchSessionBindingTargets.queryOptions({
    input: { id: record.id, projectId: record.projectId },
  });
  const targets = useQuery({
    ...targetOptions,
    enabled: Boolean(bindingActions && bindingDraft),
    gcTime: 0,
    queryFn: () =>
      bindingActions?.targets(record) ??
      Promise.reject(new Error("Targets are unavailable.")),
    staleTime: 0,
  });
  const bindingPending = Boolean(bindingDraft && targets.isFetching);
  function startBinding(
    note: ResearchSessionNoteInput,
    mode: "create" | "bind",
  ) {
    bindingWrite?.reset();
    bindingPreview?.reset();
    setBindingDraft({ record, note, mode });
  }
  async function confirmBinding(
    preview: Parameters<ResearchBindingActions["confirm"]>[1],
    key: string,
  ) {
    if (!(bindingActions && bindingDraft)) {
      throw new Error("Preview is unavailable.");
    }
    const result = await bindingActions.confirm(
      bindingDraft.record,
      preview,
      key,
    );
    setBindingDraft(undefined);
    return result;
  }
  const notes = record.content.flatMap(({ content }) => {
    const parsed = researchSessionNoteInputSchema.safeParse(content);
    return parsed.success ? [parsed.data] : [];
  });
  async function save(note: ResearchSessionNoteInput) {
    if (!editing) {
      return;
    }
    await onSave(note, editing.record, !editing.note);
    setEditing(null);
  }
  function start(note?: ResearchSessionNoteInput) {
    onStartEditing();
    setEditing({ record, note });
  }
  return (
    <section
      aria-label={`Notes for ${record.title}`}
      className="space-y-3 pt-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium">Notes</h4>
        <Button
          disabled={readOnly || !!editing || !!bindingDraft || bindingPending}
          onClick={() => start()}
          variant="outline"
        >
          Add note
        </Button>
      </div>
      {saved ? <p role="status">Note saved.</p> : null}
      <VirtualList
        as="div"
        estimateSize={130}
        gap={12}
        getKey={virtualRowId}
        rows={notes}
      >
        {(note, rowProps) => (
          <article
            aria-label={note.kind}
            className={`space-y-2 rounded-md border p-4 ${noteStyles[note.kind]}`}
            {...rowProps}
          >
            <div className="flex items-start justify-between gap-3">
              <h5 className="font-medium">{note.kind}</h5>
              <Button
                disabled={
                  readOnly || !!editing || !!bindingDraft || bindingPending
                }
                onClick={() => start(note)}
                variant="outline"
              >
                Edit note
              </Button>
            </div>
            {bindingActions ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    readOnly ||
                    !!editing ||
                    !!bindingDraft ||
                    bindingPending ||
                    !researchSessionConsentGates(record.consent).convert ||
                    !researchSessionConsentGates(
                      record.content.find((item) => item.content.id === note.id)
                        ?.consentAtCapture ?? "Not asked",
                    ).convert
                  }
                  onClick={() => startBinding(note, "create")}
                  variant="outline"
                >
                  Convert to new record and bind
                </Button>
                <Button
                  disabled={
                    readOnly ||
                    !!editing ||
                    !!bindingDraft ||
                    bindingPending ||
                    !researchSessionConsentGates(record.consent).convert ||
                    !researchSessionConsentGates(
                      record.content.find((item) => item.content.id === note.id)
                        ?.consentAtCapture ?? "Not asked",
                    ).convert
                  }
                  onClick={() => startBinding(note, "bind")}
                  variant="outline"
                >
                  Bind as evidence to existing record
                </Button>
              </div>
            ) : null}
            {note.kind === "Participant quote" ? (
              <blockquote className="text-sm whitespace-pre-wrap">
                {note.text}
              </blockquote>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{note.text}</p>
            )}
            {note.kind === "Participant quote" && note.speakerLabel ? (
              <p className="text-sm text-muted-foreground">
                Speaker label: {note.speakerLabel}
              </p>
            ) : null}
          </article>
        )}
      </VirtualList>
      {bindingDraft && targets.isError ? (
        <div>
          <p role="alert">Targets are unavailable. Try the action again.</p>
          <Button onClick={() => targets.refetch().catch(() => undefined)}>
            Retry
          </Button>
          <Button onClick={() => setBindingDraft(undefined)} variant="outline">
            Cancel
          </Button>
        </div>
      ) : null}
      {bindingPending ? <p role="status">Loading targets…</p> : null}
      {bound ? <p role="status">Evidence bound.</p> : null}
      {bindingDraft && bindingActions && targets.data && !targets.isError ? (
        <ResearchNoteBindingEditor
          confirmState={bindingWrite}
          mode={bindingDraft.mode}
          note={bindingDraft.note}
          onCancel={() => setBindingDraft(undefined)}
          onConfirm={confirmBinding}
          onPreview={bindingActions.preview}
          previewState={bindingPreview}
          record={bindingDraft.record}
          targets={targets.data}
        />
      ) : null}
      {bindingActions ? (
        <ResearchSessionEvidence actions={bindingActions} record={record} />
      ) : null}
      {editing ? (
        <ResearchSessionNoteEditor
          consent={record.consent}
          key={editing.note?.id ?? "new"}
          note={editing.note}
          onCancel={() => setEditing(null)}
          onSave={save}
          saveError={noteWrite?.error}
          savePending={noteWrite?.isPending}
        />
      ) : null}
    </section>
  );
}

function ResearchSessionEvidence({
  record,
  actions,
}: {
  record: ResearchSessionRecord;
  actions: ResearchBindingActions;
}) {
  const query = useQuery({
    queryKey: [
      "research-session-evidence",
      record.projectId,
      record.id,
      record.revision,
    ],
    queryFn: () => actions.list(record),
  });
  return (
    <>
      {query.isError ? (
        <p role="alert">
          Evidence is unavailable. Reopen this Research Session to retry.
        </p>
      ) : null}
      <VirtualList
        as="div"
        estimateSize={130}
        gap={12}
        getKey={virtualRowId}
        rows={query.isError ? [] : (query.data ?? [])}
      >
        {(binding, rowProps) => (
          <article
            aria-label="Version-pinned evidence"
            className="space-y-2 rounded-md border p-3"
            {...rowProps}
          >
            <p className="font-medium">Version-pinned evidence</p>
            <p className="text-sm">
              {binding.target.brokenReason ??
                `${binding.target.type}: ${binding.target.label}`}
            </p>
            <p className="text-sm text-muted-foreground">
              Bound at{" "}
              <time dateTime={binding.createdAt}>{binding.createdAt}</time>
            </p>
            <ResearchEvidenceTargetAction
              actions={actions}
              binding={binding}
              record={record}
            />
            <p className="text-sm">
              Research Session revision {binding.pin.source.revision} · range{" "}
              {binding.pin.start}–{binding.pin.end}
            </p>
            {record.revision > binding.pin.source.revision ? (
              <p className="text-sm text-muted-foreground">
                Newer version exists
              </p>
            ) : null}
            <blockquote className="border-l-4 pl-3 text-sm whitespace-pre-wrap">
              {binding.pin.excerpt}
            </blockquote>
            {binding.origin ? (
              <p className="text-sm">Origin: {record.title}</p>
            ) : null}
          </article>
        )}
      </VirtualList>
    </>
  );
}

function ResearchEvidenceTargetAction({
  binding,
  record,
  actions,
}: {
  binding: ResearchEvidenceBinding;
  record: ResearchSessionRecord;
  actions: ResearchBindingActions;
}) {
  const { target } = binding;
  if (!(target.canOpenSourceRecord && target.projectId)) {
    return null;
  }
  if (target.type === "Feedback") {
    const read = actions.feedback;
    return read ? (
      <ResearchBindingFeedbackView
        bindingId={binding.id}
        read={() => read(record, binding.id)}
        revision={record.revision}
        sessionId={record.id}
      />
    ) : null;
  }
  const hash =
    target.type === "Work" || target.type === "Feature"
      ? workRecordHash(target.recordId)
      : projectSourceRecordHash(target.type, target.recordId);
  return (
    <AppLink
      className="inline-block rounded-sm py-1 text-sm underline underline-offset-2 focus-visible:outline-2"
      href={`/projects/${encodeURIComponent(target.projectId)}#${hash}`}
    >
      Open source record
    </AppLink>
  );
}
