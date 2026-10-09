// biome-ignore-all lint/performance/noJsxPropsBind: Risk controls bind to the current record and form field.
import {
  type ProjectSourceRecord,
  RISK_LIFE_OPTIONS,
} from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { projectSourceRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

export type RiskRecord = Extract<ProjectSourceRecord, { sourceType: "Risk" }>;
export interface RiskDraft {
  description: string;
  impact: string;
  life: RiskRecord["life"];
  probability: string;
  rationale: string;
  response: string;
  title: string;
}
const FIELDS = [
  { name: "title", label: "Title" },
  { name: "description", label: "Description" },
  { name: "impact", label: "Impact" },
  { name: "probability", label: "Probability" },
  { name: "response", label: "Response/mitigation" },
  { name: "rationale", label: "Rationale" },
] as const;
export function riskHref(projectId: string, sourceId?: string) {
  return `/projects/${encodeURIComponent(projectId)}#${sourceId ? projectSourceRecordHash("Risk", sourceId) : "risks"}`;
}

export function RiskEditor({
  record,
  changingStatus = false,
  onSave,
  onCancel,
}: {
  record?: RiskRecord;
  changingStatus?: boolean;
  onSave: (draft: RiskDraft, record?: RiskRecord) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [baseRecord] = useState(record);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const form = useForm({
    defaultValues: {
      title: baseRecord?.title ?? "",
      description: baseRecord?.description ?? "",
      impact: baseRecord?.impact ?? "",
      probability: baseRecord?.probability ?? "",
      response: baseRecord?.response ?? "",
      rationale: baseRecord?.rationale ?? "",
      life: baseRecord?.life ?? "Open",
    } satisfies RiskDraft,
    onSubmit: async ({ value }) => {
      setError(undefined);
      if (!(changingStatus || value.title.trim())) {
        setError("Enter a Title before saving.");
        return;
      }
      if (value.life === "Accepted" && !value.rationale.trim()) {
        setError("Enter a Rationale before accepting a Risk.");
        return;
      }
      if (changingStatus && value.life === baseRecord?.life) {
        setError("Choose a different Status.");
        return;
      }
      try {
        await onSave(value, baseRecord);
      } catch (saveError) {
        const changed =
          typeof saveError === "object" &&
          saveError !== null &&
          "code" in saveError &&
          saveError.code === "CONFLICT";
        setConflict(changed);
        setError(
          changed
            ? "Risk changed. Cancel and reopen before saving again. Your text is kept here."
            : "Risk could not be saved. Retry, or reload to check for changes. Your text is kept here.",
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
      <h3 className="font-medium">{changingStatus ? "Status" : "Risk"}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {changingStatus ? (
              <form.Field name="life">
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor="risk-life">Status</label>
                    <select
                      className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                      disabled={pending}
                      id="risk-life"
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        const life = RISK_LIFE_OPTIONS.find(
                          (option) => option === event.target.value,
                        );
                        if (life) {
                          field.handleChange(life);
                        }
                      }}
                      value={field.state.value}
                    >
                      {RISK_LIFE_OPTIONS.map((life) => (
                        <option key={life} value={life}>
                          {life}
                        </option>
                      ))}
                    </select>
                    <p className="text-muted-foreground">
                      A known Risk remains recorded when accepted.
                    </p>
                  </div>
                )}
              </form.Field>
            ) : null}
            {FIELDS.filter(({ name }) =>
              changingStatus
                ? name === "rationale"
                : name !== "rationale" || Boolean(baseRecord),
            ).map(({ name, label }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`risk-${name}`}>{label}</label>
                    {name === "title" ? (
                      <Input
                        disabled={pending}
                        id={`risk-${name}`}
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
                        disabled={pending}
                        id={`risk-${name}`}
                        maxLength={100_000}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      />
                    )}
                  </div>
                )}
              </form.Field>
            ))}
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

export function ProjectRisksView({
  records,
  projectId,
  selectedId,
  readOnly = false,
  onSave,
  onTransition,
  onStartEditing,
  savedMessage,
}: {
  records: RiskRecord[];
  projectId: string;
  selectedId?: string;
  readOnly?: boolean;
  onSave: (draft: RiskDraft, record?: RiskRecord) => Promise<unknown>;
  onTransition: (draft: RiskDraft, record?: RiskRecord) => Promise<unknown>;
  onStartEditing?: () => void;
  savedMessage?: string;
}) {
  const [editing, setEditing] = useState<
    | {
        mode: "create" | "edit" | "status";
        record?: RiskRecord;
      }
    | undefined
  >(undefined);
  const selected = records.find((record) => record.id === selectedId);
  function start(mode: "create" | "edit" | "status") {
    onStartEditing?.();
    setEditing({ mode, record: mode === "create" ? undefined : selected });
  }
  async function save(draft: RiskDraft, record?: RiskRecord) {
    await (editing?.mode === "status" ? onTransition : onSave)(draft, record);
    setEditing(undefined);
  }
  return (
    <section aria-label="Risks" className="space-y-5">
      <header className="surface-header flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-2xl tracking-tight">Risks</h2>
        {readOnly ? null : (
          <Button disabled={Boolean(editing)} onClick={() => start("create")}>
            Create
          </Button>
        )}
      </header>
      {savedMessage ? <p role="status">{savedMessage}</p> : null}
      {editing && !readOnly ? (
        <RiskEditor
          changingStatus={editing.mode === "status"}
          key={editing.mode}
          onCancel={() => setEditing(undefined)}
          onSave={save}
          record={editing.record}
        />
      ) : null}
      {records.length ? (
        <ul className="divide-y rounded-lg border border-border/70">
          {records.map((record) => (
            <li
              className="flex items-center justify-between gap-4 p-4"
              key={record.id}
            >
              <a
                className="min-w-0 break-words font-medium underline underline-offset-4"
                href={riskHref(projectId, record.id)}
              >
                {record.title}
              </a>
              <span className="shrink-0 text-muted-foreground text-sm">
                {record.life}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No Risks yet.</p>
      )}
      {selectedId && !selected ? (
        <p role="alert">Risk is unavailable.</p>
      ) : null}
      {selected ? (
        <article
          aria-label="Risk"
          className="space-y-4 rounded-lg border border-border/70 p-5"
        >
          <h3 className="break-words font-semibold text-xl">
            {selected.title}
          </h3>
          <p>{selected.life}</p>
          <dl className="space-y-4">
            {FIELDS.filter(({ name }) => name !== "title").map(
              ({ name, label }) => (
                <div key={name}>
                  <dt className="font-medium text-sm">{label}</dt>
                  <dd className="whitespace-pre-wrap break-words text-muted-foreground">
                    {selected[name] || "—"}
                  </dd>
                </div>
              ),
            )}
          </dl>
          {selected.life === "Accepted" ? (
            <p className="text-muted-foreground text-sm">
              A known Risk remains recorded when accepted.
            </p>
          ) : null}
          {readOnly ? null : (
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={Boolean(editing)}
                onClick={() => start("edit")}
                variant="outline"
              >
                Edit
              </Button>
              <Button
                disabled={Boolean(editing)}
                onClick={() => start("status")}
                variant="outline"
              >
                Status
              </Button>
            </div>
          )}
        </article>
      ) : null}
    </section>
  );
}
