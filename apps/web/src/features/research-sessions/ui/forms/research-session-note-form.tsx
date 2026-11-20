// biome-ignore-all lint/performance/noJsxPropsBind: Note controls bind to the current session draft.

import {
  RESEARCH_SESSION_NOTE_KIND_OPTIONS,
  type ResearchSessionConsent,
  type ResearchSessionNoteInput,
  type ResearchSessionRecord,
  researchSessionConsentGates,
  researchSessionNoteInputSchema,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type SubmitEvent, useId, useMemo, useState } from "react";
import { isResearchSessionConflict } from "../../lib/research-session-conflict";

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

export function ResearchSessionNoteEditor({
  note,
  consent,
  onSave,
  onCancel,
  saveError,
  savePending = false,
}: {
  note?: ResearchSessionNoteInput;
  consent: ResearchSessionConsent;
  onSave: (note: ResearchSessionNoteInput) => Promise<unknown>;
  onCancel: () => void;
  saveError?: unknown;
  savePending?: boolean;
}) {
  const prefix = useId();
  const initialNoteId = useMemo(
    () => note?.id ?? crypto.randomUUID(),
    [note?.id],
  );
  const [validationError, setValidationError] = useState<string>();
  const conflict = isResearchSessionConflict(saveError);
  let error = validationError;
  if (!error && saveError) {
    error = conflict
      ? "Research Session changed. Cancel and reopen before saving. Your text is kept here."
      : "Note could not be saved. Retry or reload to check for changes. Your text is kept here.";
  }
  const submitLabel = error && !conflict ? "Retry" : "Save";
  const form = useForm({
    defaultValues: {
      noteId: initialNoteId,
      kind: note?.kind ?? "",
      text: note?.text ?? "",
      speakerLabel:
        note?.kind === "Participant quote" ? (note.speakerLabel ?? "") : "",
      containsPersonalInformation:
        note && note.kind !== "Participant quote"
          ? note.containsPersonalInformation
          : true,
    },
    onSubmit: async ({ value: { noteId, ...value } }) => {
      setValidationError(undefined);
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
        setValidationError("Choose note type and enter its text.");
        return;
      }
      await onSave(parsed.data);
    },
  });
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
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
          className="text-sm text-destructive"
          id={`${prefix}-error`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <form.Subscribe
        selector={(state) => ({
          pending: state.isSubmitting || savePending,
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
                    className="text-sm text-muted-foreground"
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
                          <Checkbox
                            checked={field.state.value}
                            id={`${prefix}-personal`}
                            onCheckedChange={(checked) =>
                              field.handleChange(checked === true)
                            }
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
