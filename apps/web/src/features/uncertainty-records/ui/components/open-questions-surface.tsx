// biome-ignore-all lint/performance/noJsxPropsBind: Actions bind the selected question and editing mode.

import type { DocumentEvidenceSelection } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import {
  VirtualList,
  virtualRowId,
} from "@cantiara/ui/components/virtual-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useLayoutEffect, useRef } from "react";
import { AppLink } from "@/components/app-link";
import { projectSourceRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { client, orpc } from "@/utils/orpc";
import {
  type OpenQuestionDraft,
  OpenQuestionEditor,
  type OpenQuestionRecord,
} from "../forms/open-question-editor-form";
import { OpenQuestionDetail } from "../views/open-question-view";

interface OpenQuestionsSurfaceProps {
  projectId: string;
  readOnly?: boolean;
  selectedId?: string;
}

export default function OpenQuestionsSurface(props: OpenQuestionsSurfaceProps) {
  return (
    <OpenQuestionsSession
      {...props}
      key={JSON.stringify([props.projectId, props.selectedId, props.readOnly])}
    />
  );
}

function OpenQuestionsSession({
  projectId,
  selectedId,
  readOnly = false,
}: OpenQuestionsSurfaceProps) {
  const createProjectSourceRecordMutation = useMutation(
    orpc.createProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (request) => client.createProjectSourceRecord(request),
      onSuccess: (_, input) =>
        refresh(input.projectId, input.id, input.clientIdempotencyKey),
    }),
  );
  const transitionProjectSourceRecordMutation = useMutation(
    orpc.transitionProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.transitionProjectSourceRecord(input),
      onSuccess: (_, input) =>
        refresh(input.projectId, input.sourceId, input.clientIdempotencyKey),
    }),
  );
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
  const editingSession = useCreateStore(
    undefined as "create" | "answer" | undefined,
    ({ setState }) => ({
      setEditing: (next: "create" | "answer" | undefined) =>
        setState(() => next),
    }),
  );
  const editing = useSelector(editingSession);
  const { setEditing } = editingSession.actions;
  const saved =
    createProjectSourceRecordMutation.isSuccess ||
    transitionProjectSourceRecordMutation.isSuccess;
  const pendingWrite = useRef<{
    fingerprint: string;
    key: string;
    id: string;
  } | null>(null);
  const selected = records.data?.records.find(
    (item): item is OpenQuestionRecord =>
      item.sourceType === "Open Question" && item.id === selectedId,
  );
  const locked = readOnly || records.data?.readOnly === true;
  useLayoutEffect(() => {
    if (locked || (editing === "answer" && !selected)) {
      pendingWrite.current = null;
      setEditing(undefined);
    }
  }, [editing, locked, selected, setEditing]);
  function commandIdentity(payload: unknown, record?: OpenQuestionRecord) {
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
  async function refresh(
    affectedProjectId: string,
    sourceId: string,
    commandKey: string,
  ) {
    if (pendingWrite.current?.key === commandKey) {
      pendingWrite.current = null;
      setEditing(undefined);
    }
    const source = { sourceId, sourceType: "Open Question" as const };
    await Promise.all(
      [
        orpc.openQuestions.key({ input: { projectId: affectedProjectId } }),
        orpc.openQuestionContext.key({ input: source }),
        orpc.projectSourceRecord.key({ input: source }),
        orpc.projectSourceRecords.key({
          input: { projectId: affectedProjectId },
        }),
        orpc.searchRecords.key(),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  }
  async function save(draft: OpenQuestionDraft, record?: OpenQuestionRecord) {
    const { id, key } = commandIdentity(draft, record);
    await (record
      ? transitionProjectSourceRecordMutation.mutateAsync({
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
      : createProjectSourceRecordMutation.mutateAsync({
          baseRevision: 0,
          clientIdempotencyKey: key,
          projectId,
          id,
          sourceType: "Open Question",
          title: draft.title.trim(),
          question: draft.question.trim(),
          context: draft.context.trim() || null,
        }));
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
    const { key } = commandIdentity(payload, selected);
    await transitionProjectSourceRecordMutation.mutateAsync({
      ...payload,
      baseRevision: selected.revision,
      clientIdempotencyKey: key,
    });
  }
  function start(mode: "create" | "answer") {
    pendingWrite.current = null;
    createProjectSourceRecordMutation.reset();
    transitionProjectSourceRecordMutation.reset();
    setEditing(mode);
  }
  function cancel() {
    setEditing(undefined);
    pendingWrite.current = null;
  }
  if (!records.data) {
    return records.isError ? (
      <p role="alert">Open Questions are unavailable. Reload to retry.</p>
    ) : (
      <p role="status">Loading Open Questions…</p>
    );
  }
  const transition = transitionProjectSourceRecordMutation.variables;
  const closingSelected =
    transition?.sourceType === "Open Question" &&
    transition.life === "No longer applicable" &&
    transition.sourceId === selectedId;
  const questions = records.data.records;
  return (
    <section aria-label="Open Question" className="space-y-5">
      <header className="surface-header flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Open Question</h2>
        {locked ? null : (
          <Button disabled={Boolean(editing)} onClick={() => start("create")}>
            Create
          </Button>
        )}
      </header>
      {records.isError ? (
        <p role="alert">
          Open Questions could not be refreshed. Your draft is safe.
        </p>
      ) : null}
      {saved ? <p role="status">Open Question saved.</p> : null}
      {questions.length ? (
        <VirtualList
          className="space-y-2"
          estimateSize={85}
          gap={8}
          getKey={virtualRowId}
          rows={questions}
          scrollToKey={selectedId}
        >
          {(item, rowProps) => (
            <li {...rowProps}>
              <AppLink
                className="underline"
                href={`/projects/${encodeURIComponent(projectId)}#${projectSourceRecordHash("Open Question", item.id)}`}
              >
                {item.title}
              </AppLink>
              <span className="ml-3 text-muted-foreground">{item.life}</span>
            </li>
          )}
        </VirtualList>
      ) : (
        <p>No Open Questions yet.</p>
      )}
      {selectedId ? (
        <QuestionSelection
          closeFailed={
            closingSelected && transitionProjectSourceRecordMutation.isError
          }
          closePending={
            closingSelected && transitionProjectSourceRecordMutation.isPending
          }
          details={context.data}
          failed={context.isError}
          loading={context.isPending}
          onAnswer={() => start("answer")}
          onClose={close}
          readOnly={locked || Boolean(editing)}
          record={selected}
        />
      ) : null}
      <OpenQuestionEditing
        cancel={cancel}
        editing={editing}
        locked={locked}
        projectId={projectId}
        save={save}
        selected={selected}
        writeError={
          editing === "create"
            ? createProjectSourceRecordMutation.error
            : transitionProjectSourceRecordMutation.error
        }
      />
    </section>
  );
}

function QuestionSelection({
  closeFailed,
  closePending,
  record,
  loading,
  failed,
  details,
  readOnly,
  onAnswer,
  onClose,
}: {
  closeFailed: boolean;
  closePending: boolean;
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
      closeFailed={closeFailed}
      closePending={closePending}
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
  writeError,
}: {
  projectId: string;
  record?: OpenQuestionRecord;
  onSave: (
    draft: OpenQuestionDraft,
    record?: OpenQuestionRecord,
  ) => Promise<unknown>;
  onCancel: () => void;
  writeError?: unknown;
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
        writeError={writeError}
      />
    </>
  );
}

function OpenQuestionEditing({
  editing,
  locked,
  selected,
  cancel,
  save,
  projectId,
  writeError,
}: {
  editing: "create" | "answer" | undefined;
  locked: boolean;
  selected: OpenQuestionRecord | undefined;
  cancel: () => void;
  save: (
    draft: OpenQuestionDraft,
    record?: OpenQuestionRecord,
  ) => Promise<void>;
  projectId: string;
  writeError: unknown;
}) {
  return !locked && (editing === "create" || (editing && selected)) ? (
    <QuestionEditorSurface
      key={editing}
      onCancel={cancel}
      onSave={save}
      projectId={projectId}
      record={editing === "answer" ? selected : undefined}
      writeError={writeError}
    />
  ) : null;
}
