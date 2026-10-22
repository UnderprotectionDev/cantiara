// biome-ignore-all lint/performance/noJsxPropsBind: Note controls bind to the current session draft.

import type {
  ResearchBindingTargets,
  ResearchEvidenceBinding,
} from "@cantiara/api/research-session-bindings";
import {
  type ResearchSessionNoteInput,
  type ResearchSessionRecord,
  researchSessionConsentGates,
  researchSessionNoteInputSchema,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { ResearchBindingFeedbackView } from "@/features/feedback/ui/components/research-binding-feedback";
import {
  projectSourceRecordHash,
  workRecordHash,
} from "@/features/project-shell/lib/project-shell-navigation";
import {
  type ResearchBindingActions,
  ResearchNoteBindingEditor,
} from "../forms/research-note-binding-form";
import {
  ResearchSessionNoteEditor,
  type SaveResearchNote,
} from "../forms/research-session-note-form";

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
}: {
  record: ResearchSessionRecord;
  readOnly: boolean;
  onSave: SaveResearchNote;
  onStartEditing: () => void;
  bindingActions?: ResearchBindingActions;
}) {
  const [editing, setEditing] = useState<{
    record: ResearchSessionRecord;
    note?: ResearchSessionNoteInput;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const [bindingDraft, setBindingDraft] = useState<
    | {
        record: ResearchSessionRecord;
        note: ResearchSessionNoteInput;
        mode: "create" | "bind";
        targets: ResearchBindingTargets;
      }
    | undefined
  >(undefined);
  const [bindingPending, setBindingPending] = useState(false);
  const [bindingError, setBindingError] = useState<string>();
  const [bound, setBound] = useState(false);
  async function startBinding(
    note: ResearchSessionNoteInput,
    mode: "create" | "bind",
  ) {
    if (!bindingActions || bindingPending) {
      return;
    }
    setBindingPending(true);
    setBindingError(undefined);
    setBound(false);
    try {
      const targets = await bindingActions.targets(record);
      setBindingDraft({ record, note, mode, targets });
    } catch {
      setBindingError("Targets are unavailable. Try the action again.");
    } finally {
      setBindingPending(false);
    }
  }
  async function confirmBinding(
    preview: Parameters<ResearchBindingActions["confirm"]>[1],
    key: string,
  ) {
    if (!(bindingActions && bindingDraft)) {
      throw new Error("Preview is unavailable.");
    }
    const binding = await bindingActions.confirm(
      bindingDraft.record,
      preview,
      key,
    );
    setBindingDraft(undefined);
    setBound(true);
    return binding;
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
    setSaved(true);
  }
  function start(note?: ResearchSessionNoteInput) {
    onStartEditing();
    setEditing({ record, note });
    setSaved(false);
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
      {notes.map((note) => (
        <article
          aria-label={note.kind}
          className={`space-y-2 rounded-md border p-4 ${noteStyles[note.kind]}`}
          key={note.id}
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
            <blockquote className="whitespace-pre-wrap text-sm">
              {note.text}
            </blockquote>
          ) : (
            <p className="whitespace-pre-wrap text-sm">{note.text}</p>
          )}
          {note.kind === "Participant quote" && note.speakerLabel ? (
            <p className="text-muted-foreground text-sm">
              Speaker label: {note.speakerLabel}
            </p>
          ) : null}
        </article>
      ))}
      {bindingError ? <p role="alert">{bindingError}</p> : null}
      {bindingPending ? <p role="status">Loading targets…</p> : null}
      {bound ? <p role="status">Evidence bound.</p> : null}
      {bindingDraft && bindingActions ? (
        <ResearchNoteBindingEditor
          mode={bindingDraft.mode}
          note={bindingDraft.note}
          onCancel={() => setBindingDraft(undefined)}
          onConfirm={confirmBinding}
          onPreview={bindingActions.preview}
          record={bindingDraft.record}
          targets={bindingDraft.targets}
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
      {(query.isError ? [] : (query.data ?? [])).map((binding) => (
        <article
          aria-label="Version-pinned evidence"
          className="space-y-2 rounded-md border p-3"
          key={binding.id}
        >
          <p className="font-medium">Version-pinned evidence</p>
          <p className="text-sm">
            {binding.target.brokenReason ??
              `${binding.target.type}: ${binding.target.label}`}
          </p>
          <p className="text-muted-foreground text-sm">
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
            <p className="text-muted-foreground text-sm">
              Newer version exists
            </p>
          ) : null}
          <blockquote className="whitespace-pre-wrap border-l-4 pl-3 text-sm">
            {binding.pin.excerpt}
          </blockquote>
          {binding.origin ? (
            <p className="text-sm">Origin: {record.title}</p>
          ) : null}
        </article>
      ))}
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
