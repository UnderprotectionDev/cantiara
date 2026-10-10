// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected Research Session and TanStack Form fields.
import {
  RESEARCH_SESSION_CONSENT_OPTIONS,
  RESEARCH_SESSION_STATUS_OPTIONS,
  type ResearchSessionFields,
  type ResearchSessionRecord,
  researchSessionConsentGates,
  researchSessionFieldsSchema,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useId, useState } from "react";
import {
  researchSessionTimeInput,
  researchSessionTimestamp,
} from "../lib/research-session-time";

type Save = (
  fields: ResearchSessionFields,
  record?: ResearchSessionRecord,
) => Promise<unknown>;
const textFields = [
  { name: "title", label: "Title", required: true },
  { name: "purpose", label: "Purpose", required: true },
  { name: "questionGuide", label: "Question guide", required: false },
  { name: "channel", label: "Channel", required: false },
  { name: "facilitator", label: "Facilitator", required: false },
  { name: "scopeNote", label: "Scope note", required: false },
  { name: "consentNote", label: "Consent note", required: false },
] as const;

export function ResearchSessionEditor({
  record,
  timeZone,
  onSave,
  onCancel,
}: {
  record?: ResearchSessionRecord;
  timeZone: string;
  onSave: Save;
  onCancel: () => void;
}) {
  const prefix = useId();
  const [baseRecord] = useState(record);
  const [entryTimeZone] = useState(timeZone);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const form = useForm({
    defaultValues: {
      title: record?.title ?? "",
      purpose: record?.purpose ?? "",
      questionGuide: record?.questionGuide ?? "",
      channel: record?.channel ?? "",
      facilitator: record?.facilitator ?? "",
      scopeNote: record?.scopeNote ?? "",
      status: record?.status ?? "Planned",
      consent: record?.consent ?? "Not asked",
      consentNote: record?.consentNote ?? "",
      scheduledAt: record?.scheduledAt
        ? researchSessionTimeInput(record.scheduledAt, entryTimeZone)
        : "",
      durationMinutes: record?.durationMinutes?.toString() ?? "",
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      let scheduledAt: string | null = null;
      try {
        scheduledAt = researchSessionTimestamp(
          value.scheduledAt,
          entryTimeZone,
          baseRecord?.scheduledAt,
        );
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Enter a valid Time.",
        );
        return;
      }
      const parsed = researchSessionFieldsSchema.safeParse({
        ...value,
        scheduledAt,
        durationMinutes: value.durationMinutes
          ? Number(value.durationMinutes)
          : null,
        participantContactId: baseRecord?.participantContactId ?? null,
      });
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ??
            "Check the Research Session fields.",
        );
        return;
      }
      try {
        await onSave(parsed.data, baseRecord);
      } catch (cause) {
        const changed =
          cause instanceof Error &&
          "code" in cause &&
          cause.code === "CONFLICT";
        setConflict(changed);
        setError(
          changed
            ? "Research Session changed. Cancel and reopen before saving. Your text is kept here."
            : "Research Session could not be saved. Retry or reload to check for changes. Your text is kept here.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  const submitLabel = error && !conflict ? "Retry" : "Save";
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">Research Session</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <fieldset className="space-y-4" disabled={pending}>
            {textFields.map(({ name, label, required }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`${prefix}-${name}`}>
                      {label}
                      {required ? "" : " (optional)"}
                    </label>
                    {name === "title" ? (
                      <Input
                        id={`${prefix}-${name}`}
                        maxLength={255}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        id={`${prefix}-${name}`}
                        maxLength={20_000}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    )}
                  </div>
                )}
              </form.Field>
            ))}
            <form.Field name="status">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor={`${prefix}-status`}>Status</label>
                  <NativeSelect
                    id={`${prefix}-status`}
                    onChange={(event) => {
                      const value = RESEARCH_SESSION_STATUS_OPTIONS.find(
                        (option) => option === event.target.value,
                      );
                      if (value) {
                        field.handleChange(value);
                      }
                    }}
                    value={field.state.value}
                  >
                    {RESEARCH_SESSION_STATUS_OPTIONS.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {value}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              )}
            </form.Field>
            <form.Field name="consent">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor={`${prefix}-consent`}>Consent</label>
                  <NativeSelect
                    aria-describedby={`${prefix}-consent-help`}
                    id={`${prefix}-consent`}
                    onChange={(event) => {
                      const value = RESEARCH_SESSION_CONSENT_OPTIONS.find(
                        (option) => option === event.target.value,
                      );
                      if (value) {
                        field.handleChange(value);
                      }
                    }}
                    value={field.state.value}
                  >
                    {RESEARCH_SESSION_CONSENT_OPTIONS.map((value) => (
                      <NativeSelectOption key={value} value={value}>
                        {value}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <p id={`${prefix}-consent-help`} role="status">
                    {researchSessionConsentGates(field.state.value).quote
                      ? "Consent permits protected content. Convert still requires a preview."
                      : "Participant quotes, identifying personal notes, file attachments, sharing and publishing are closed."}
                  </p>
                  <p className="text-muted-foreground">
                    Consent is context, not a legal compliance judgment. You
                    remain responsible for your obligations.
                  </p>
                </div>
              )}
            </form.Field>
            <form.Field name="scheduledAt">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor={`${prefix}-scheduled`}>Time (optional)</label>
                  <Input
                    aria-describedby={`${prefix}-time-help`}
                    id={`${prefix}-scheduled`}
                    onChange={(event) => field.handleChange(event.target.value)}
                    type="datetime-local"
                    value={field.state.value}
                  />
                  <p
                    className="text-muted-foreground"
                    id={`${prefix}-time-help`}
                  >
                    Time uses your account time zone: {entryTimeZone}.
                  </p>
                </div>
              )}
            </form.Field>
            <form.Field name="durationMinutes">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor={`${prefix}-duration`}>
                    Duration (minutes, optional)
                  </label>
                  <Input
                    id={`${prefix}-duration`}
                    max={1440}
                    min={1}
                    onChange={(event) => field.handleChange(event.target.value)}
                    step={1}
                    type="number"
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <div className="flex gap-2">
              <Button disabled={pending || conflict} type="submit">
                {pending ? "Saving…" : <span>{submitLabel}</span>}
              </Button>
              <Button
                disabled={pending}
                onClick={onCancel}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </fieldset>
        )}
      </form.Subscribe>
    </form>
  );
}

export function ResearchSessionsView({
  records,
  timeZone,
  readOnly,
  onSave,
  onStartEditing,
}: {
  records: ResearchSessionRecord[];
  timeZone: string;
  readOnly: boolean;
  onSave: Save;
  onStartEditing: () => void;
}) {
  const [editing, setEditing] = useState<ResearchSessionRecord | "new" | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  async function save(
    fields: ResearchSessionFields,
    record?: ResearchSessionRecord,
  ) {
    await onSave(fields, record);
    setEditing(null);
    setSaved(true);
  }
  return (
    <section aria-label="Research Sessions" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-lg">Research Sessions</h2>
        <Button
          disabled={readOnly || editing !== null}
          onClick={() => {
            onStartEditing();
            setEditing("new");
            setSaved(false);
          }}
        >
          Create Research Session
        </Button>
      </div>
      {saved ? <p role="status">Research Session saved.</p> : null}
      {readOnly ? (
        <p>This Project is archived. Research Sessions are read-only.</p>
      ) : null}
      {editing ? (
        <ResearchSessionEditor
          key={editing === "new" ? "new" : editing.id}
          onCancel={() => setEditing(null)}
          onSave={save}
          record={editing === "new" ? undefined : editing}
          timeZone={timeZone}
        />
      ) : null}
      {records.length ? (
        <ul className="space-y-3">
          {records.map((record) => (
            <li
              className="rounded-lg border border-border/70 p-4"
              key={record.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium">{record.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {record.status} · Consent: {record.consent}
                  </p>
                </div>
                <Button
                  disabled={readOnly || editing !== null}
                  onClick={() => {
                    onStartEditing();
                    setEditing(record);
                    setSaved(false);
                  }}
                  variant="outline"
                >
                  Edit
                </Button>
              </div>
              <p className="whitespace-pre-wrap text-sm">{record.purpose}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No Research Sessions yet.</p>
      )}
    </section>
  );
}
