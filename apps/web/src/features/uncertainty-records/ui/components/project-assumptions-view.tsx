// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the current record and form field.

import type { Document } from "@cantiara/api/documents";
import { ASSUMPTION_LIFE_OPTIONS } from "@cantiara/api/project-source-records";
import type {
  AssumptionRecord,
  AssumptionsContext,
} from "@cantiara/api/uncertainty-records";
import { Button } from "@cantiara/ui/components/button";
import { type ReactNode, useState } from "react";
import { AppLink } from "@/components/app-link";
import { projectSourceRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import {
  type AssumptionDraft,
  AssumptionEditor,
  type AssumptionLife,
  type Save,
} from "../forms/assumption-editor-form";

interface AssumptionEditing {
  kind: "create" | "edit" | "transition";
  life?: AssumptionLife;
  record?: AssumptionRecord;
}
function AssumptionEditingPanel({
  editing,
  documents,
  documentsPending,
  onCancel,
  onSave,
}: {
  editing: AssumptionEditing;
  documents?: Document[];
  documentsPending: boolean;
  onCancel: () => void;
  onSave: Save;
}) {
  const needsEvidenceSnapshot =
    editing.kind === "transition" &&
    (editing.life === "Confirmed" || editing.life === "Refuted");
  if (needsEvidenceSnapshot && documentsPending) {
    return (
      <div className="space-y-3">
        <p role="status">Loading Documents…</p>
        <Button onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    );
  }
  return (
    <AssumptionEditor
      documents={documents}
      key={`${editing.kind}:${editing.record?.id ?? "new"}:${editing.life ?? ""}`}
      life={editing.life}
      onCancel={onCancel}
      onSave={onSave}
      record={editing.record}
    />
  );
}

export function ProjectAssumptionsView({
  context,
  projectId,
  selectedId,
  documents,
  documentsPending = false,
  onSave,
  onTransition,
  onStartEditing,
  renderEvidenceFlow,
  savedMessage,
}: {
  context: AssumptionsContext;
  renderEvidenceFlow?: (recordId: string) => ReactNode;
  projectId: string;
  selectedId?: string;
  documents?: Document[];
  documentsPending?: boolean;
  onSave: Save;
  onTransition: (
    life: AssumptionLife,
    draft: AssumptionDraft,
    record: AssumptionRecord,
  ) => Promise<unknown>;
  onStartEditing?: () => void;
  savedMessage?: string;
}) {
  const [editing, setEditing] = useState<AssumptionEditing | undefined>(
    undefined,
  );
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
        <AssumptionEditingPanel
          documents={documents}
          documentsPending={documentsPending}
          editing={editing}
          onCancel={() => setEditing(undefined)}
          onSave={save}
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
              <AppLink
                className="min-w-0 break-words font-medium underline underline-offset-4"
                href={`/projects/${encodeURIComponent(projectId)}#${projectSourceRecordHash("Assumption", record.id)}`}
              >
                {record.title}
              </AppLink>
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
          {renderEvidenceFlow?.(selected.id)}
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
