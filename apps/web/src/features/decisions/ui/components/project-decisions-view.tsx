// biome-ignore-all lint/performance/noJsxPropsBind: Decision controls bind to their current record and form field.
import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { DecisionSupersessionGraph } from "@cantiara/api/decision-supersession";
import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { DecisionChainView } from "./decision-chain-view";

export type DecisionRecord = Extract<
  ProjectSourceRecord,
  { sourceType: "Decision" }
>;
export interface DecisionDraft {
  decision: string;
  rationale: string;
  title: string;
}
const FIELDS = [
  { name: "title", label: "Title", maxLength: 255, required: true },
  {
    name: "decision",
    label: "Decision text",
    maxLength: 20_000,
    required: true,
  },
  { name: "rationale", label: "Rationale", maxLength: 20_000, required: false },
] as const;

export function DecisionEditor({
  record,
  withdrawing = false,
  onSave,
  onCancel,
}: {
  record?: DecisionRecord;
  withdrawing?: boolean;
  onSave: (draft: DecisionDraft, record?: DecisionRecord) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [baseRecord] = useState(record);
  const form = useForm({
    defaultValues: {
      title: baseRecord?.title ?? "",
      decision: baseRecord?.decision ?? "",
      rationale: withdrawing ? "" : (baseRecord?.rationale ?? ""),
    },
    onSubmit: async ({ value }) => {
      setError(undefined);
      if (!(withdrawing || (value.title.trim() && value.decision.trim()))) {
        setError("Enter a Title and Decision text before saving.");
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
            ? "Decision changed. Cancel and reopen before saving again. Your text is kept here."
            : "Decision could not be saved. Retry, or reload to check for changes. Your text is kept here.",
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
      <h3 className="font-medium">{withdrawing ? "Withdraw" : "Decision"}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            {FIELDS.filter(
              ({ name }) => !withdrawing || name === "rationale",
            ).map(({ name, label, required, maxLength }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="grid gap-2 text-sm">
                    <label htmlFor={`decision-${name}`}>
                      {label}
                      {required ? "" : " (optional)"}
                    </label>
                    {name === "title" ? (
                      <Input
                        disabled={pending}
                        id={`decision-${name}`}
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
                        id={`decision-${name}`}
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
            <div className="flex flex-wrap gap-2">
              <Button disabled={pending || conflict} type="submit">
                {pending ? "Saving…" : null}
                {!pending && withdrawing ? "Withdraw" : null}
                {pending || withdrawing ? null : "Save"}
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

export function ProjectDecisionsView({
  decisions,
  graph,
  projectId,
  selectedId,
  readOnly = false,
  onSave,
  onWithdraw,
  onStartEditing,
  savedMessage,
  accountFormattingPreferences = DEFAULT_ACCOUNT_PREFERENCES,
}: {
  accountFormattingPreferences?: AccountPreferences;
  decisions: DecisionRecord[];
  graph?: DecisionSupersessionGraph;
  projectId: string;
  selectedId?: string;
  readOnly?: boolean;
  onSave: (draft: DecisionDraft, record?: DecisionRecord) => Promise<unknown>;
  onWithdraw: (
    draft: DecisionDraft,
    record?: DecisionRecord,
  ) => Promise<unknown>;
  onStartEditing?: () => void;
  savedMessage?: string;
}) {
  const [editing, setEditing] = useState<
    "create" | "edit" | "withdraw" | undefined
  >(undefined);
  const selected = decisions.find((record) => record.id === selectedId);
  function start(mode: "create" | "edit" | "withdraw") {
    onStartEditing?.();
    setEditing(mode);
  }
  async function save(draft: DecisionDraft, record?: DecisionRecord) {
    await onSave(draft, record);
    setEditing(undefined);
  }
  async function withdraw(draft: DecisionDraft, record?: DecisionRecord) {
    await onWithdraw(draft, record);
    setEditing(undefined);
  }
  return (
    <section aria-label="Decisions" className="space-y-5">
      <header className="surface-header flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-2xl tracking-tight">Decisions</h2>
        {readOnly ? null : (
          <Button disabled={Boolean(editing)} onClick={() => start("create")}>
            Create
          </Button>
        )}
      </header>
      {savedMessage ? <p role="status">{savedMessage}</p> : null}
      {editing &&
      !readOnly &&
      (editing === "create" || selected?.life !== "Superseded") ? (
        <DecisionEditor
          key={editing}
          onCancel={() => setEditing(undefined)}
          onSave={editing === "withdraw" ? withdraw : save}
          record={editing === "create" ? undefined : selected}
          withdrawing={editing === "withdraw"}
        />
      ) : null}
      {decisions.length === 0 ? (
        <p className="text-muted-foreground">No Decisions yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border border-border/70">
          {decisions.map((record) => (
            <li
              className="flex items-center justify-between gap-4 p-4"
              key={record.id}
            >
              <a
                className="min-w-0 break-words font-medium underline underline-offset-4"
                href={`/projects/${encodeURIComponent(projectId)}#source-decision-${encodeURIComponent(record.id)}`}
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
        <p role="alert">Decision is unavailable.</p>
      ) : null}
      {selected ? (
        <DecisionDetail
          accountFormattingPreferences={accountFormattingPreferences}
          editing={Boolean(editing)}
          graph={graph}
          onEdit={() => start("edit")}
          onWithdraw={() => start("withdraw")}
          projectId={projectId}
          readOnly={readOnly}
          record={selected}
        />
      ) : null}
    </section>
  );
}

function DecisionDetail({
  record,
  accountFormattingPreferences,
  readOnly,
  editing,
  onEdit,
  onWithdraw,
  graph,
  projectId,
}: {
  graph?: DecisionSupersessionGraph;
  projectId: string;
  record: DecisionRecord;
  accountFormattingPreferences: AccountPreferences;
  readOnly: boolean;
  editing: boolean;
  onEdit: () => void;
  onWithdraw: () => void;
}) {
  return (
    <article
      aria-label="Decision"
      className="space-y-4 rounded-lg border border-border/70 p-5"
    >
      <h3 className="font-semibold text-xl">{record.title}</h3>
      <p>{record.life}</p>
      {graph ? (
        <DecisionChainView
          graph={graph}
          preferences={accountFormattingPreferences}
          projectId={projectId}
          selectedId={record.id}
        />
      ) : null}
      <dl className="space-y-4">
        <div>
          <dt className="font-medium text-sm">Decision text</dt>
          <dd className="whitespace-pre-wrap break-words text-muted-foreground">
            {record.decision}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-sm">Rationale</dt>
          <dd className="whitespace-pre-wrap break-words text-muted-foreground">
            {record.rationale || "—"}
          </dd>
        </div>
      </dl>
      {record.life === "Withdrawn" ? (
        <section aria-label="Withdrawn" className="space-y-2 border-t pt-4">
          <h4 className="font-medium">Withdrawn</h4>
          {record.withdrawnAt ? (
            <time dateTime={record.withdrawnAt}>
              {formatAccountDateTime(
                record.withdrawnAt,
                accountFormattingPreferences,
              )}
            </time>
          ) : null}
          <p className="whitespace-pre-wrap break-words text-muted-foreground">
            {record.withdrawalRationale || "—"}
          </p>
        </section>
      ) : null}
      {readOnly || editing || record.life === "Superseded" ? null : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onEdit()} variant="outline">
            Edit
          </Button>
          {record.life === "Valid" ? (
            <Button onClick={() => onWithdraw()} variant="outline">
              Withdraw
            </Button>
          ) : null}
        </div>
      )}
    </article>
  );
}
