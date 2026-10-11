// biome-ignore-all lint/performance/noJsxPropsBind: Note controls bind to the current session draft.

import type { ResearchBindingTargets } from "@cantiara/api/research-session-bindings";
import {
  RESEARCH_SESSION_NOTE_KIND_OPTIONS,
  type ResearchSessionConsent,
  type ResearchSessionNoteInput,
  type ResearchSessionRecord,
  researchSessionConsentGates,
  researchSessionNoteInputSchema,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import {
  type ResearchBindingActions,
  ResearchNoteBindingEditor,
} from "./research-note-binding";

export type SaveResearchNote = (
  note: ResearchSessionNoteInput,
  record: ResearchSessionRecord,
  create: boolean,
) => Promise<unknown>;
type NoteKind = ResearchSessionNoteInput["kind"];
const explanations: Record<NoteKind, string> = {
  "Participant quote":
    "The participant’s own words. Use an anonymous Speaker label; do not copy Contact details.",
  Observation:
    "Describe the behavior you observed, separately from what the participant said.",
  "Founder interpretation":
    "Your interpretation of the research, separately from participant words and observations.",
};
const noteStyles: Record<NoteKind, string> = {
  "Participant quote": "border-l-4 border-l-primary bg-muted/30",
  Observation: "border-l-4 border-l-border",
  "Founder interpretation": "border-dashed bg-muted/50",
};

export function ResearchSessionNoteEditor({
  note,
  consent,
  onSave,
  onCancel,
}: {
  note?: ResearchSessionNoteInput;
  consent: ResearchSessionConsent;
  onSave: (note: ResearchSessionNoteInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [noteId] = useState(() => note?.id ?? crypto.randomUUID());
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const submitLabel = error && !conflict ? "Retry" : "Save";
  const form = useForm({
    defaultValues: {
      kind: note?.kind ?? "",
      text: note?.text ?? "",
      speakerLabel:
        note?.kind === "Participant quote" ? (note.speakerLabel ?? "") : "",
      containsPersonalInformation:
        note && note.kind !== "Participant quote"
          ? note.containsPersonalInformation
          : true,
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      const parsed = researchSessionNoteInputSchema.safeParse({
        id: noteId,
        kind: value.kind,
        text: value.text,
        relationIds: note?.relationIds ?? [],
        ...(value.kind === "Participant quote"
          ? { speakerLabel: value.speakerLabel || null }
          : { containsPersonalInformation: value.containsPersonalInformation }),
      });
      if (!parsed.success) {
        setError("Choose note type and enter its text.");
        return;
      }
      try {
        await onSave(parsed.data);
      } catch (cause) {
        const changed =
          cause instanceof Error &&
          "code" in cause &&
          cause.code === "CONFLICT";
        setConflict(changed);
        setError(
          changed
            ? "Research Session changed. Cancel and reopen before saving. Your text is kept here."
            : "Note could not be saved. Retry or reload to check for changes. Your text is kept here.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label={note ? "Edit note" : "Add note"}
      className="space-y-3 rounded-lg border p-4"
      onSubmit={submit}
    >
      {error ? (
        <p
          className="text-destructive text-sm"
          id={`${prefix}-error`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <form.Subscribe
        selector={(state) => ({
          pending: state.isSubmitting,
          values: state.values,
        })}
      >
        {({ pending, values }) => {
          const kind = RESEARCH_SESSION_NOTE_KIND_OPTIONS.find(
            (option) => option === values.kind,
          );
          const allowed = researchSessionConsentGates(consent).quote;
          const blocked =
            !allowed &&
            (kind === "Participant quote" ||
              values.containsPersonalInformation);
          return (
            <fieldset className="space-y-3" disabled={pending}>
              <form.Field name="kind">
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`${prefix}-kind`}>Note type</label>
                    <NativeSelect
                      disabled={!!note}
                      id={`${prefix}-kind`}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      value={field.state.value}
                    >
                      <NativeSelectOption value="">
                        Choose note type
                      </NativeSelectOption>
                      {RESEARCH_SESSION_NOTE_KIND_OPTIONS.map((option) => (
                        <NativeSelectOption key={option} value={option}>
                          {option}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </form.Field>
              {kind ? (
                <>
                  <h4 className="font-medium">{kind}</h4>
                  <p
                    className="text-muted-foreground text-sm"
                    id={`${prefix}-help`}
                  >
                    {explanations[kind]}
                  </p>
                  <form.Field name="text">
                    {(field) => (
                      <div className="grid gap-2 text-sm">
                        <label htmlFor={`${prefix}-text`}>{kind}</label>
                        <Textarea
                          aria-describedby={`${prefix}-help${error ? ` ${prefix}-error` : ""}`}
                          disabled={!allowed && kind === "Participant quote"}
                          id={`${prefix}-text`}
                          maxLength={20_000}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          required
                          value={field.state.value}
                        />
                      </div>
                    )}
                  </form.Field>
                  {kind === "Participant quote" ? (
                    <form.Field name="speakerLabel">
                      {(field) => (
                        <div className="grid gap-2 text-sm">
                          <label htmlFor={`${prefix}-speaker`}>
                            Speaker label (optional)
                          </label>
                          <Input
                            disabled={!allowed}
                            id={`${prefix}-speaker`}
                            maxLength={20_000}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  ) : (
                    <form.Field name="containsPersonalInformation">
                      {(field) => (
                        <label
                          className="flex items-center gap-2 text-sm"
                          htmlFor={`${prefix}-personal`}
                        >
                          <input
                            checked={field.state.value}
                            id={`${prefix}-personal`}
                            onChange={(event) =>
                              field.handleChange(event.target.checked)
                            }
                            type="checkbox"
                          />
                          Contains personal information
                        </label>
                      )}
                    </form.Field>
                  )}
                  {blocked ? (
                    <p className="text-sm" role="status">
                      Consent does not permit participant words or personal
                      information. Only nonpersonal observations and
                      interpretations can be saved.
                    </p>
                  ) : null}
                </>
              ) : null}
              <div className="flex gap-2">
                <Button disabled={!kind || blocked || conflict} type="submit">
                  {pending ? "Saving…" : <span>{submitLabel}</span>}
                </Button>
                <Button onClick={onCancel} type="button" variant="outline">
                  Cancel
                </Button>
              </div>
            </fieldset>
          );
        }}
      </form.Subscribe>
    </form>
  );
}

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
      {(query.data ?? []).map((binding) => (
        <article
          aria-label="Version-pinned evidence"
          className="space-y-2 rounded-md border p-3"
          key={binding.id}
        >
          <p className="font-medium">Version-pinned evidence</p>
          <p className="text-sm">
            {binding.target.type}: {binding.target.label}
          </p>
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
