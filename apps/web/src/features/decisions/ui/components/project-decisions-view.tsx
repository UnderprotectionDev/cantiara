// biome-ignore-all lint/performance/noJsxPropsBind: Decision controls bind to their current record and form field.

import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { DecisionSupersessionGraph } from "@cantiara/api/decision-supersession";
import type { ProjectSourceRecord } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { type ReactNode, useState } from "react";
import { AppLink } from "@/components/app-link";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { DecisionEditor } from "../forms/decision-editor-form";
import { DecisionChainView, decisionHref } from "./decision-chain-view";

export type DecisionRecord = Extract<
  ProjectSourceRecord,
  { sourceType: "Decision" }
>;
export interface DecisionDraft {
  decision: string;
  rationale: string;
  title: string;
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
  renderEvidenceFlow,
}: {
  accountFormattingPreferences?: AccountPreferences;
  decisions: DecisionRecord[];
  renderEvidenceFlow?: (recordId: string) => ReactNode;
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
      {editing && !readOnly ? (
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
              <AppLink
                className="min-w-0 break-words font-medium underline underline-offset-4"
                href={decisionHref(projectId, record.id)}
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
          renderEvidenceFlow={renderEvidenceFlow}
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
  renderEvidenceFlow,
}: {
  renderEvidenceFlow?: (recordId: string) => ReactNode;
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
      {renderEvidenceFlow?.(record.id)}
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
