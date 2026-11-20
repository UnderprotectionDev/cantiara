import type { AssumptionRecord } from "@cantiara/api/uncertainty-records";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import EvidenceFlowPanel from "@/features/evidence/ui/components/evidence-flow-panel";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import type { AssumptionDraft } from "../forms/assumption-editor-form";
import { ProjectAssumptionsView } from "./project-assumptions-panel";

export default function ProjectAssumptionsSurface({
  projectId,
  selectedId,
}: {
  projectId: string;
  selectedId?: string;
}) {
  const updateProjectSourceRecordMutation = useMutation(
    orpc.updateProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (request) => client.updateProjectSourceRecord(request),
      onSuccess: (_, { sourceId, clientIdempotencyKey }) =>
        refresh(sourceId, clientIdempotencyKey),
    }),
  );
  const createProjectSourceRecordMutation = useMutation(
    orpc.createProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (request) => client.createProjectSourceRecord(request),
      onSuccess: ({ id }, { clientIdempotencyKey }) =>
        refresh(id, clientIdempotencyKey),
    }),
  );
  const transitionProjectSourceRecordMutation = useMutation(
    orpc.transitionProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.transitionProjectSourceRecord(input),
      onSuccess: (_, { sourceId, clientIdempotencyKey }) =>
        refresh(sourceId, clientIdempotencyKey),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectAssumptions.queryOptions({
    input: { projectId },
  });
  const records = useQuery(options);
  const documents = useQuery({
    ...orpc.documents.queryOptions({ input: { projectId } }),
    enabled: records.data?.readOnly === false,
  });
  const saved = [
    createProjectSourceRecordMutation,
    updateProjectSourceRecordMutation,
    transitionProjectSourceRecordMutation,
  ].some((mutation) => mutation.isSuccess);
  const pendingWrite = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  function commandIdentity(payload: unknown, record?: AssumptionRecord) {
    const fingerprint = JSON.stringify({
      payload,
      id: record?.id,
      revision: record?.revision,
    });
    if (pendingWrite.current?.fingerprint !== fingerprint) {
      pendingWrite.current = {
        fingerprint,
        id: record?.id ?? pendingWrite.current?.id ?? crypto.randomUUID(),
        key: crypto.randomUUID(),
      };
    }
    return pendingWrite.current;
  }
  async function refresh(sourceId: string, commandKey: string) {
    if (pendingWrite.current?.key === commandKey) {
      pendingWrite.current = null;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecords.queryOptions({
          input: { projectId },
        }).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecord.queryOptions({
          input: { sourceId, sourceType: "Assumption" },
        }).queryKey,
      }),
      ...invalidateSmartCollectionMembership(queryClient),
    ]);
  }
  async function save(draft: AssumptionDraft, record?: AssumptionRecord) {
    const fields = {
      title: draft.title.trim(),
      statement: draft.statement.trim(),
      rationale: draft.rationale.trim() || null,
      sourceType: "Assumption" as const,
      projectId,
    };
    const { id, key } = commandIdentity(
      { operation: "save", ...fields },
      record,
    );
    await (record
      ? updateProjectSourceRecordMutation.mutateAsync({
          ...fields,
          sourceId: id,
          baseRevision: record.revision,
          clientIdempotencyKey: key,
        })
      : createProjectSourceRecordMutation.mutateAsync({
          ...fields,
          id,
          baseRevision: 0,
          clientIdempotencyKey: key,
        }));
  }
  async function transition(
    life: AssumptionRecord["life"],
    draft: AssumptionDraft,
    record: AssumptionRecord,
  ) {
    const fields = {
      projectId,
      sourceId: record.id,
      sourceType: "Assumption" as const,
      life,
      ...(life === "Confirmed" || life === "Refuted"
        ? {
            rationale: draft.rationale.trim() || null,
            ...(draft.documentEvidence
              ? { documentEvidence: draft.documentEvidence }
              : {}),
          }
        : {}),
    };
    const { key } = commandIdentity(
      { operation: "transition", ...fields },
      record,
    );
    await transitionProjectSourceRecordMutation.mutateAsync({
      ...fields,
      baseRevision: record.revision,
      clientIdempotencyKey: key,
    });
  }
  function startEditing() {
    pendingWrite.current = null;
    createProjectSourceRecordMutation.reset();
    updateProjectSourceRecordMutation.reset();
    transitionProjectSourceRecordMutation.reset();
  }
  function retry() {
    records.refetch().catch(() => undefined);
  }
  if (records.status === "pending") {
    return <p role="status">Loading Assumptions…</p>;
  }
  if (records.isError || !records.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Assumptions are unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  function renderEvidenceFlow(recordId: string) {
    return (
      <EvidenceFlowPanel
        projectId={projectId}
        recordId={recordId}
        type="Assumption"
      />
    );
  }
  return (
    <div className="space-y-5">
      {documents.isError && !records.data.readOnly ? (
        <p role="alert">
          Evidence choices are unavailable. You can save a Rationale or continue
          without new evidence.
        </p>
      ) : null}
      <ProjectAssumptionsView
        context={records.data}
        documents={documents.data ?? []}
        documentsPending={documents.isPending}
        onSave={save}
        onStartEditing={startEditing}
        onTransition={transition}
        projectId={projectId}
        renderEvidenceFlow={renderEvidenceFlow}
        savedMessage={saved ? "Assumption saved." : undefined}
        selectedId={selectedId}
      />
    </div>
  );
}
