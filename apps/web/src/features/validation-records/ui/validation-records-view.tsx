// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the selected record and form field.
import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { projectSourceRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

export type ValidationRecord = Extract<
  ProjectSourceRecord,
  { sourceType: "Validation Record" }
>;
export type ValidationDraft = Pick<
  ValidationRecord,
  "title" | "method" | "result" | "context"
>;
type ValidationContextRecord = Extract<
  ProjectSourceRecord,
  { sourceType: ValidationRecord["context"][number]["sourceType"] }
>;
export function isValidationContextRecord(
  record: ProjectSourceRecord,
): record is ValidationContextRecord {
  return (
    record.sourceType === "Assumption" ||
    record.sourceType === "Open Question" ||
    record.sourceType === "Decision"
  );
}
type Save = (
  draft: ValidationDraft,
  record?: ValidationRecord,
) => Promise<unknown>;
type Transition = (
  record: ValidationRecord,
  status: ValidationRecord["status"],
) => Promise<unknown>;
const fields = [
  { name: "title", label: "Title", maxLength: 255 },
  { name: "method", label: "Method", maxLength: 100_000 },
  { name: "result", label: "Result", maxLength: 100_000 },
] as const;

export function ValidationRecordEditor({
  record,
  counterparts,
  onSave,
  onCancel,
}: {
  record?: ValidationRecord;
  counterparts: ProjectSourceRecord[];
  onSave: Save;
  onCancel: () => void;
}) {
  const [baseRecord] = useState(record);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const form = useForm({
    defaultValues: {
      title: record?.title ?? "",
      method: record?.method ?? "",
      result: record?.result ?? "",
      context: record?.context ?? [],
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      if (!(value.title.trim() && value.method.trim())) {
        setError("Enter a Title and Method before saving.");
        return;
      }
      try {
        await onSave(
          { ...value, result: value.result.trim() || null },
          baseRecord,
        );
      } catch (cause) {
        const changed =
          typeof cause === "object" &&
          cause !== null &&
          "code" in cause &&
          cause.code === "CONFLICT";
        setConflict(changed);
        setError(
          changed
            ? "Validation Record or Related context changed. Cancel and reopen before saving. Your text is kept here."
            : "Validation Record could not be saved. Retry or reload to check for changes. Your text is kept here.",
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
      <h3 className="font-medium">Validation Record</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {fields.map(({ name, label, maxLength }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`validation-${name}`}>
                      {label}
                      {name === "result" ? " (optional)" : ""}
                    </label>
                    {name === "title" ? (
                      <Input
                        autoFocus
                        disabled={pending}
                        id={`validation-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={pending}
                        id={`validation-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={name === "method"}
                        value={field.state.value}
                      />
                    )}
                  </div>
                )}
              </form.Field>
            ))}
            <form.Field name="context">
              {(field) => (
                <fieldset className="space-y-2" disabled={pending}>
                  <legend className="font-medium text-sm">Related</legend>
                  {counterparts
                    .filter(isValidationContextRecord)
                    .map((source) => (
                      <label
                        className="flex min-h-11 items-center gap-3 text-sm"
                        key={`${source.sourceType}:${source.id}`}
                      >
                        <input
                          checked={field.state.value.some(
                            (link) =>
                              link.sourceType === source.sourceType &&
                              link.sourceId === source.id,
                          )}
                          onChange={(event) => {
                            field.handleChange(
                              event.target.checked
                                ? [
                                    ...field.state.value,
                                    {
                                      sourceType: source.sourceType,
                                      sourceId: source.id,
                                    },
                                  ]
                                : field.state.value.filter(
                                    (link) =>
                                      !(
                                        link.sourceType === source.sourceType &&
                                        link.sourceId === source.id
                                      ),
                                  ),
                            );
                          }}
                          type="checkbox"
                        />
                        <span>
                          {source.sourceType}: {source.title}
                        </span>
                      </label>
                    ))}
                  {counterparts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No context records available.
                    </p>
                  ) : null}
                </fieldset>
              )}
            </form.Field>
            <p className="text-muted-foreground text-sm">
              Saving a Result keeps related Assumption, Open Question and
              Decision life unchanged.
            </p>
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
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

export function ValidationRecordsView({
  records,
  counterparts,
  readOnly,
  selectedId,
  onSave,
  onTransition,
  onStartEditing,
}: {
  records: ValidationRecord[];
  counterparts: ProjectSourceRecord[];
  readOnly: boolean;
  selectedId?: string;
  onSave: Save;
  onTransition: Transition;
  onStartEditing?: () => void;
}) {
  const [editing, setEditing] = useState<{ record?: ValidationRecord } | null>(
    null,
  );
  const [status, setStatus] = useState<ValidationRecord["status"]>(
    records.find((record) => record.id === selectedId)?.status ?? "Active",
  );
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  async function save(draft: ValidationDraft, record?: ValidationRecord) {
    await onSave(draft, record);
    setEditing(null);
    setMessage("Validation Record saved.");
  }
  async function transition(
    record: ValidationRecord,
    next: ValidationRecord["status"],
  ) {
    setError(undefined);
    setBusy(true);
    try {
      await onTransition(record, next);
      setMessage("Validation Record saved.");
    } catch {
      setError(
        "Validation Record could not be changed. Reload to check for changes.",
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = records.filter(
    (record) =>
      record.status === status && (!selectedId || record.id === selectedId),
  );
  return (
    <section aria-label="Validation Record" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-2xl tracking-tight">
          Validation Record
        </h2>
        {readOnly ? null : (
          <Button
            disabled={busy || Boolean(editing)}
            onClick={() => {
              onStartEditing?.();
              setEditing({});
              setMessage(undefined);
            }}
          >
            Create
          </Button>
        )}
      </header>
      <div className="grid max-w-xs gap-2 text-sm">
        <label htmlFor="validation-status">Status</label>
        <NativeSelect
          id="validation-status"
          onChange={(event) => {
            const next = event.target.value;
            if (next === "Active" || next === "Archived" || next === "Trash") {
              setStatus(next);
            }
          }}
          value={status}
        >
          <NativeSelectOption value="Active">Active</NativeSelectOption>
          <NativeSelectOption value="Archived">Archived</NativeSelectOption>
          <NativeSelectOption value="Trash">Trash</NativeSelectOption>
        </NativeSelect>
      </div>
      {readOnly ? (
        <p className="text-muted-foreground text-sm">
          This Project is archived and read-only.
        </p>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      {editing && !readOnly ? (
        <ValidationRecordEditor
          counterparts={counterparts}
          onCancel={() => setEditing(null)}
          onSave={save}
          record={editing.record}
        />
      ) : null}
      {visible.length === 0 ? (
        <p className="text-muted-foreground">
          No Validation Records in this view.
        </p>
      ) : null}
      {visible.map((record) => (
        <article
          className="space-y-4 rounded-lg border border-border/70 bg-card/35 p-5"
          key={record.id}
        >
          <h3 className="font-medium">
            <a
              className="underline"
              href={`#${projectSourceRecordHash("Validation Record", record.id)}`}
            >
              {record.title}
            </a>
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="font-medium text-sm">Method</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground text-sm">
                {record.method}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-sm">Result</dt>
              <dd className="whitespace-pre-wrap text-muted-foreground text-sm">
                {record.result || "—"}
              </dd>
            </div>
          </dl>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Related</h4>
            {record.context.map((link) => {
              const source = counterparts.find(
                (candidate) =>
                  candidate.sourceType === link.sourceType &&
                  candidate.id === link.sourceId,
              );
              return source && "title" in source ? (
                <a
                  className="block text-sm underline"
                  href={`#${projectSourceRecordHash(link.sourceType, link.sourceId)}`}
                  key={`${link.sourceType}:${link.sourceId}`}
                >
                  {link.sourceType}: {source.title}
                </a>
              ) : (
                <p
                  className="text-muted-foreground text-sm"
                  key={`${link.sourceType}:${link.sourceId}`}
                >
                  Record unavailable
                </p>
              );
            })}
            {record.context.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No context linked.
              </p>
            ) : null}
          </div>
          {readOnly ? null : (
            <div className="flex flex-wrap gap-2">
              {record.status === "Active" ? (
                <>
                  <Button
                    disabled={busy || Boolean(editing)}
                    onClick={() => {
                      onStartEditing?.();
                      setEditing({ record });
                      setMessage(undefined);
                    }}
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={busy || Boolean(editing)}
                    onClick={() => transition(record, "Archived")}
                    variant="outline"
                  >
                    Archive
                  </Button>
                </>
              ) : (
                <Button
                  disabled={busy || Boolean(editing)}
                  onClick={() => transition(record, "Active")}
                  variant="outline"
                >
                  Restore
                </Button>
              )}
              {record.status === "Trash" ? null : (
                <Button
                  disabled={busy || Boolean(editing)}
                  onClick={() => transition(record, "Trash")}
                  variant="outline"
                >
                  Move to Trash
                </Button>
              )}
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
