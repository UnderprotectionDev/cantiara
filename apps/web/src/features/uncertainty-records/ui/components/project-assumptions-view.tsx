// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the current record and form field.
import type {
  Document,
  DocumentEvidenceSelection,
} from "@cantiara/api/documents";
import { ASSUMPTION_LIFE_OPTIONS } from "@cantiara/api/project-source-records";
import type {
  AssumptionRecord,
  AssumptionsContext,
} from "@cantiara/api/uncertainty-records";
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

export interface AssumptionDraft {
  documentEvidence?: DocumentEvidenceSelection;
  rationale: string;
  statement: string;
  title: string;
}
type AssumptionLife = AssumptionRecord["life"];
type Save = (
  draft: AssumptionDraft,
  record?: AssumptionRecord,
) => Promise<unknown>;
const FIELDS = [
  { name: "title", label: "Title", required: true, maxLength: 255 },
  { name: "statement", label: "Statement", required: true, maxLength: 100_000 },
  {
    name: "rationale",
    label: "Rationale",
    required: false,
    maxLength: 100_000,
  },
] as const;

export function AssumptionEditor({
  record,
  life,
  documents = [],
  onSave,
  onCancel,
}: {
  record?: AssumptionRecord;
  life?: AssumptionLife;
  documents?: Document[];
  onSave: Save;
  onCancel: () => void;
}) {
  const [baseRecord] = useState(record);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const outcome = life === "Confirmed" || life === "Refuted";
  const evidenceDocuments = documents.filter(
    (doc) => doc.body.length > 0 && doc.body.length <= 100_000,
  );
  const form = useForm({
    defaultValues: {
      title: baseRecord?.title ?? "",
      statement: baseRecord?.statement ?? "",
      rationale: life ? "" : (baseRecord?.rationale ?? ""),
      documentId: "",
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      if (!(life || (value.title.trim() && value.statement.trim()))) {
        setError("Enter a Title and Statement before saving.");
        return;
      }
      const selected = evidenceDocuments.find(
        (doc) => doc.id === value.documentId,
      );
      if (outcome && value.documentId && !selected) {
        setError("Evidence is unavailable. Choose it again before saving.");
        return;
      }
      try {
        await onSave(
          {
            title: value.title,
            statement: value.statement,
            rationale: value.rationale,
            ...(outcome && selected
              ? {
                  documentEvidence: {
                    documentId: selected.id,
                    documentRevision: selected.revision,
                    selectionStart: 0,
                    selectionEnd: selected.body.length,
                    selectedText: selected.body,
                  },
                }
              : {}),
          },
          baseRecord,
        );
      } catch (saveError) {
        const changed =
          typeof saveError === "object" &&
          saveError !== null &&
          "code" in saveError &&
          saveError.code === "CONFLICT";
        setConflict(changed);
        setError(
          changed
            ? "Assumption or Evidence changed. Cancel and reopen before saving again. Your text is kept here."
            : "Assumption could not be saved. Retry, or reload to check for changes. Your text is kept here.",
        );
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{life ?? "Assumption"}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {FIELDS.filter(
              ({ name }) => !life || (outcome && name === "rationale"),
            ).map(({ name, label, required, maxLength }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`assumption-${name}`}>
                      {label}
                      {required ? "" : " (optional)"}
                    </label>
                    {name === "title" ? (
                      <Input
                        disabled={pending}
                        id={`assumption-${name}`}
                        maxLength={maxLength}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required={required}
                        value={field.state.value}
                      />
                    ) : (
                      <Textarea
                        disabled={pending}
                        id={`assumption-${name}`}
                        maxLength={maxLength}
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
            {outcome ? (
              <form.Field name="documentId">
                {(field) => {
                  const selected = evidenceDocuments.find(
                    (doc) => doc.id === field.state.value,
                  );
                  return (
                    <div className="grid gap-2 text-sm">
                      <label htmlFor="assumption-evidence">
                        Evidence (optional)
                      </label>
                      <NativeSelect
                        disabled={pending}
                        id="assumption-evidence"
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      >
                        <NativeSelectOption value="">
                          No new evidence
                        </NativeSelectOption>
                        {evidenceDocuments.map((doc) => (
                          <NativeSelectOption key={doc.id} value={doc.id}>
                            {doc.title} — Version {doc.revision}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <p className="text-muted-foreground">
                        The selected Document text is pinned to this version.
                        Evidence is optional.
                      </p>
                      {selected ? (
                        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border p-3">
                          {selected.body}
                        </pre>
                      ) : null}
                    </div>
                  );
                }}
              </form.Field>
            ) : null}
            {life === "No longer applicable" ? (
              <p>Existing Statement, Rationale and Evidence are kept.</p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || conflict} type="submit">
                {pending ? "Saving…" : "Save"}
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

export function ProjectAssumptionsView({
  context,
  projectId,
  selectedId,
  documents,
  onSave,
  onTransition,
  onStartEditing,
  savedMessage,
}: {
  context: AssumptionsContext;
  projectId: string;
  selectedId?: string;
  documents?: Document[];
  onSave: Save;
  onTransition: (
    life: AssumptionLife,
    draft: AssumptionDraft,
    record: AssumptionRecord,
  ) => Promise<unknown>;
  onStartEditing?: () => void;
  savedMessage?: string;
}) {
  const [editing, setEditing] = useState<
    | {
        kind: "create" | "edit" | "transition";
        record?: AssumptionRecord;
        life?: AssumptionLife;
      }
    | undefined
  >();
  const selected = context.records.find((record) => record.id === selectedId);
  const evidence = context.evidence.filter(
    (entry) => entry.assumptionId === selectedId,
  );
  function start(
    kind: "create" | "edit" | "transition",
    record?: AssumptionRecord,
    life?: AssumptionLife,
  ) {
    onStartEditing?.();
    setEditing({ kind, record, life });
  }
  async function save(draft: AssumptionDraft, record?: AssumptionRecord) {
    if (editing?.life && record) {
      await onTransition(editing.life, draft, record);
    } else {
      await onSave(draft, record);
    }
    setEditing(undefined);
  }
  return (
    <section aria-label="Assumption" className="space-y-5">
      <header className="surface-header flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-2xl tracking-tight">Assumption</h2>
        {context.readOnly ? null : (
          <Button disabled={Boolean(editing)} onClick={() => start("create")}>
            Create
          </Button>
        )}
      </header>
      {savedMessage ? <p role="status">{savedMessage}</p> : null}
      {editing && !context.readOnly ? (
        <AssumptionEditor
          documents={documents}
          key={`${editing.kind}:${editing.record?.id ?? "new"}:${editing.life ?? ""}`}
          life={editing.life}
          onCancel={() => setEditing(undefined)}
          onSave={save}
          record={editing.record}
        />
      ) : null}
      {context.records.length === 0 ? (
        <p className="text-muted-foreground">No Assumptions yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border border-border/70">
          {context.records.map((record) => (
            <li
              className="flex items-center justify-between gap-4 p-4"
              key={record.id}
            >
              <a
                className="min-w-0 break-words font-medium underline underline-offset-4"
                href={`/projects/${encodeURIComponent(projectId)}#${projectSourceRecordHash("Assumption", record.id)}`}
              >
                {record.title}
              </a>
              <span className="shrink-0 text-muted-foreground text-sm">
                {record.life}
              </span>
            </li>
          ))}
        </ul>
      )}
      {selectedId && !selected ? (
        <p role="alert">Assumption is unavailable.</p>
      ) : null}
      {selected ? (
        <article
          aria-label="Assumption"
          className="space-y-4 rounded-lg border border-border/70 p-5"
        >
          <h3 className="break-words font-semibold text-xl">
            {selected.title}
          </h3>
          <p>{selected.life}</p>
          <dl className="space-y-4">
            <div>
              <dt className="font-medium text-sm">Statement</dt>
              <dd className="whitespace-pre-wrap break-words text-muted-foreground">
                {selected.statement}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-sm">Rationale</dt>
              <dd className="whitespace-pre-wrap break-words text-muted-foreground">
                {selected.rationale || "—"}
              </dd>
            </div>
          </dl>
          <section aria-label="Evidence" className="space-y-3 border-t pt-4">
            <h4 className="font-medium">Evidence</h4>
            {evidence.length ? (
              <ul className="space-y-3">
                {evidence.map((entry) => (
                  <li key={entry.id}>
                    <p>
                      {entry.title} · Version {entry.revision}
                    </p>
                    {entry.excerpt ? (
                      <blockquote className="whitespace-pre-wrap break-words text-muted-foreground">
                        {entry.excerpt}
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No evidence linked.</p>
            )}
          </section>
          {context.readOnly || editing ? null : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => start("edit", selected)} variant="outline">
                Edit
              </Button>
              {ASSUMPTION_LIFE_OPTIONS.filter(
                (life) => life !== selected.life,
              ).map((life) => (
                <Button
                  key={life}
                  onClick={() => start("transition", selected, life)}
                  variant="outline"
                >
                  {life}
                </Button>
              ))}
            </div>
          )}
        </article>
      ) : null}
    </section>
  );
}
