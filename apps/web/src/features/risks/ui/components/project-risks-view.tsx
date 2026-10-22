// biome-ignore-all lint/performance/noJsxPropsBind: Risk controls bind to the current record and form field.

import { Button } from "@cantiara/ui/components/button";
import { useEffect, useState } from "react";
import { AppLink } from "@/components/app-link";
import { projectSourceRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import type { RiskRecord } from "../../lib/risk-form";
import { FIELDS, type RiskDraft, RiskEditor } from "../forms/risk-form";

type RiskEditing =
  | { mode: "create"; record: undefined }
  | { mode: "edit" | "status"; record: RiskRecord };
export function riskHref(projectId: string, sourceId?: string) {
  return `/projects/${encodeURIComponent(projectId)}#${sourceId ? projectSourceRecordHash("Risk", sourceId) : "risks"}`;
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
  const [editingMode, setEditingMode] = useState<
    "create" | "edit" | "status" | undefined
  >(undefined);
  const selected = records.find((record) => record.id === selectedId);
  const editing: RiskEditing | undefined = (() => {
    if (editingMode === "create") {
      return { mode: editingMode, record: undefined };
    }
    if (editingMode && selected) {
      return { mode: editingMode, record: selected };
    }
  })();
  useEffect(() => {
    if (
      readOnly ||
      (editingMode !== "create" && editingMode !== undefined && !selected)
    ) {
      setEditingMode(undefined);
    }
  }, [editingMode, readOnly, selected]);
  function start(mode: "create" | "edit" | "status") {
    onStartEditing?.();
    setEditingMode(mode);
  }
  async function save(draft: RiskDraft, record?: RiskRecord) {
    await (editing?.mode === "status" ? onTransition : onSave)(draft, record);
    setEditingMode(undefined);
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
          key={
            editing.mode === "create"
              ? "create"
              : `${editing.mode}:${editing.record.id}`
          }
          onCancel={() => setEditingMode(undefined)}
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
              <AppLink
                className="min-w-0 break-words font-medium underline underline-offset-4"
                href={riskHref(projectId, record.id)}
              >
                {record.title}
              </AppLink>
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
