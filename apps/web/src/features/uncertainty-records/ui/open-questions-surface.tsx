// biome-ignore-all lint/performance/noJsxPropsBind: Actions bind the selected question and editing mode.
import type { DocumentEvidenceSelection } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { projectSourceRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  OpenQuestionDetail,
  type OpenQuestionDraft,
  OpenQuestionEditor,
  type OpenQuestionRecord,
} from "./open-question-view";

export default function OpenQuestionsSurface({
  projectId,
  selectedId,
  readOnly = false,
}: {
  projectId: string;
  selectedId?: string;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const records = useQuery(
    orpc.openQuestions.queryOptions({ input: { projectId } }),
  );
  const context = useQuery({
    ...orpc.openQuestionContext.queryOptions({
      input: { sourceId: selectedId ?? "none", sourceType: "Open Question" },
    }),
    enabled: Boolean(selectedId),
  });
  const [editing, setEditing] = useState<"create" | "answer" | undefined>(
    undefined,
  );
  const [saved, setSaved] = useState<string>();
  const pendingWrite = useRef<{
    fingerprint: string;
    key: string;
    id: string;
  } | null>(null);
  const selected = records.data?.records.find(
    (item): item is OpenQuestionRecord =>
      item.sourceType === "Open Question" && item.id === selectedId,
  );
  function identity(payload: unknown, record?: OpenQuestionRecord) {
    const fingerprint = JSON.stringify({
      payload,
      id: record?.id,
      revision: record?.revision,
    });
    if (pendingWrite.current?.fingerprint !== fingerprint) {
      pendingWrite.current = {
        fingerprint,
        key: crypto.randomUUID(),
        id: record?.id ?? pendingWrite.current?.id ?? crypto.randomUUID(),
      };
    }
    return pendingWrite.current;
  }
  async function refresh() {
    pendingWrite.current = null;
    setEditing(undefined);
    setSaved("Open Question saved.");
    await queryClient.invalidateQueries();
  }
  async function save(draft: OpenQuestionDraft, record?: OpenQuestionRecord) {
    const { id, key } = identity(draft, record);
    await runOnlineOnlyWrite(() =>
      record
        ? client.transitionProjectSourceRecord({
            baseRevision: record.revision,
            clientIdempotencyKey: key,
            projectId,
            sourceId: id,
            sourceType: "Open Question",
            life: "Answered",
            answer: draft.answer.trim(),
            rationale: draft.rationale.trim() || null,
            ...(draft.documentEvidence
              ? { documentEvidence: draft.documentEvidence }
              : {}),
          })
        : client.createProjectSourceRecord({
            baseRevision: 0,
            clientIdempotencyKey: key,
            projectId,
            id,
            sourceType: "Open Question",
            title: draft.title.trim(),
            question: draft.question.trim(),
            context: draft.context.trim() || null,
          }),
    );
    await refresh();
  }
  async function close() {
    if (!selected) {
      throw new Error("Open Question is unavailable.");
    }
    const payload = {
      sourceId: selected.id,
      sourceType: "Open Question" as const,
      projectId,
      life: "No longer applicable" as const,
    };
    const { key } = identity(payload, selected);
    await runOnlineOnlyWrite(() =>
      client.transitionProjectSourceRecord({
        ...payload,
        baseRevision: selected.revision,
        clientIdempotencyKey: key,
      }),
    );
    await refresh();
  }
  function start(mode: "create" | "answer") {
    pendingWrite.current = null;
    setSaved(undefined);
    setEditing(mode);
  }
  function cancel() {
    setEditing(undefined);
    pendingWrite.current = null;
  }
  if (records.isPending) {
    return <p role="status">Loading Open Questions…</p>;
  }
  if (records.isError || !records.data) {
    return <p role="alert">Open Questions are unavailable. Reload to retry.</p>;
  }
  const questions = records.data.records;
  const locked = readOnly || records.data.readOnly;
  return (
    <section aria-label="Open Question" className="space-y-5">
      <header className="surface-header flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-2xl">Open Question</h2>
        {locked ? null : (
          <Button disabled={Boolean(editing)} onClick={() => start("create")}>
            Create
          </Button>
        )}
      </header>
      {saved ? <p role="status">{saved}</p> : null}
      {questions.length ? (
        <ul className="space-y-2">
          {questions.map((item) => (
            <li key={item.id}>
              <a
                className="underline"
                href={`/projects/${encodeURIComponent(projectId)}#${projectSourceRecordHash("Open Question", item.id)}`}
              >
                {item.title}
              </a>
              <span className="ml-3 text-muted-foreground">{item.life}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No Open Questions yet.</p>
      )}
      {selectedId ? (
        <QuestionSelection
          details={context.data}
          failed={context.isError}
          loading={context.isPending}
          onAnswer={() => start("answer")}
          onClose={close}
          readOnly={locked || Boolean(editing)}
          record={selected}
        />
      ) : null}
      {editing !== undefined && !locked ? (
        <QuestionEditorSurface
          key={`${editing}:${selected?.id ?? "new"}`}
          onCancel={cancel}
          onSave={save}
          projectId={projectId}
          record={editing === "answer" ? selected : undefined}
        />
      ) : null}
    </section>
  );
}

function QuestionSelection({
  record,
  loading,
  failed,
  details,
  readOnly,
  onAnswer,
  onClose,
}: {
  record?: OpenQuestionRecord;
  loading: boolean;
  failed: boolean;
  details?: { evidence: DocumentEvidenceSelection[]; readOnly: boolean } | null;
  readOnly: boolean;
  onAnswer: () => void;
  onClose: () => Promise<unknown>;
}) {
  if (!record) {
    return <p role="alert">Open Question is unavailable.</p>;
  }
  if (loading) {
    return <p role="status">Loading evidence…</p>;
  }
  if (failed || !details) {
    return <p role="alert">Evidence is unavailable. Reload to retry.</p>;
  }
  return (
    <OpenQuestionDetail
      evidence={details.evidence}
      key={record.id}
      onAnswer={onAnswer}
      onClose={onClose}
      readOnly={readOnly || details.readOnly}
      record={record}
    />
  );
}

function QuestionEditorSurface({
  projectId,
  record,
  onSave,
  onCancel,
}: {
  projectId: string;
  record?: OpenQuestionRecord;
  onSave: (
    draft: OpenQuestionDraft,
    record?: OpenQuestionRecord,
  ) => Promise<unknown>;
  onCancel: () => void;
}) {
  const documents = useQuery({
    ...orpc.documents.queryOptions({ input: { projectId } }),
    enabled: Boolean(record),
  });
  if (record && documents.isPending) {
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
    <>
      {record && documents.isError ? (
        <p role="alert">
          Documents are unavailable. You can save without new evidence.
        </p>
      ) : null}
      <OpenQuestionEditor
        documents={documents.isError ? [] : (documents.data ?? [])}
        onCancel={onCancel}
        onSave={onSave}
        record={record}
      />
    </>
  );
}
