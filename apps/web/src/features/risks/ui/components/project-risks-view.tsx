// biome-ignore-all lint/performance/noJsxPropsBind: Risk controls bind to the current record and form field.

import { Button } from "@cantiara/ui/components/button";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useEffect } from "react";
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

interface ProjectRisksViewProps {
  onSave: (draft: RiskDraft, record?: RiskRecord) => Promise<unknown>;
  onStartEditing?: () => void;
  onTransition: (draft: RiskDraft, record?: RiskRecord) => Promise<unknown>;
  projectId: string;
  readOnly?: boolean;
  records: RiskRecord[];
  savedMessage?: string;
  saveError?: unknown;
  savePending?: boolean;
  selectedId?: string;
}

export function ProjectRisksView(props: ProjectRisksViewProps) {
  return (
    <ProjectRisksViewSession
      key={JSON.stringify([props.projectId, props.selectedId, props.readOnly])}
      {...props}
    />
  );
}

function ProjectRisksViewSession({
  records,
  projectId,
  selectedId,
  readOnly = false,
  onSave,
  onTransition,
  onStartEditing,
  savedMessage,
  saveError,
  savePending,
}: ProjectRisksViewProps) {
  const session = useCreateStore<{ mode: "create" | "edit" | "status" } | null>(
    null,
  );
  const active = useSelector(session, (value) => value);
  const editingMode = active?.mode;
  const selected = records.find((record) => record.id === selectedId);
  const editing: RiskEditing | undefined = (() => {
    if (savedMessage) {
      return;
    }
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
      session.setState(() => null);
    }
  }, [editingMode, readOnly, selected, session]);
  function start(mode: "create" | "edit" | "status") {
    onStartEditing?.();
    session.setState(() => ({ mode }));
  }
  async function save(draft: RiskDraft, record?: RiskRecord) {
    if (!active || session.get() !== active) {
      return;
    }
    await (editing?.mode === "status" ? onTransition : onSave)(draft, record);
    session.setState((current) => (current === active ? null : current));
  }
  return (
    <section aria-label="Risks" className="space-y-5">
      <header className="surface-header flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Risks</h2>
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
          onCancel={() => session.setState(() => null)}
          onSave={save}
          record={editing.record}
          saveError={saveError}
          savePending={savePending}
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
                className="min-w-0 font-medium break-words underline underline-offset-4"
                href={riskHref(projectId, record.id)}
              >
                {record.title}
              </AppLink>
              <span className="shrink-0 text-sm text-muted-foreground">
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
          <h3 className="text-xl font-semibold break-words">
            {selected.title}
          </h3>
          <p>{selected.life}</p>
          <dl className="space-y-4">
            {FIELDS.filter(({ name }) => name !== "title").map(
              ({ name, label }) => (
                <div key={name}>
                  <dt className="text-sm font-medium">{label}</dt>
                  <dd className="break-words whitespace-pre-wrap text-muted-foreground">
                    {selected[name] || "—"}
                  </dd>
                </div>
              ),
            )}
          </dl>
          {selected.life === "Accepted" ? (
            <p className="text-sm text-muted-foreground">
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
