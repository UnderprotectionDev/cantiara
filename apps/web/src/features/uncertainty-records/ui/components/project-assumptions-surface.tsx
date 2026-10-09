import type { AssumptionRecord } from "@cantiara/api/uncertainty-records";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  type AssumptionDraft,
  ProjectAssumptionsView,
} from "./project-assumptions-view";

export default function ProjectAssumptionsSurface({
  projectId,
  selectedId,
}: {
  projectId: string;
  selectedId?: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectAssumptions.queryOptions({
    input: { projectId },
  });
  const records = useQuery(options);
  const documents = useQuery({
    ...orpc.documents.queryOptions({ input: { projectId } }),
    enabled: records.data?.readOnly === false,
  });
  const [savedMessage, setSavedMessage] = useState<string>();
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
  async function refresh(sourceId: string) {
    pendingWrite.current = null;
    setSavedMessage("Assumption saved.");
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
    await runOnlineOnlyWrite(() =>
      record
        ? client.updateProjectSourceRecord({
            ...fields,
            sourceId: id,
            baseRevision: record.revision,
            clientIdempotencyKey: key,
          })
        : client.createProjectSourceRecord({
            ...fields,
            id,
            baseRevision: 0,
            clientIdempotencyKey: key,
          }),
    );
    await refresh(id);
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
    await runOnlineOnlyWrite(() =>
      client.transitionProjectSourceRecord({
        ...fields,
        baseRevision: record.revision,
        clientIdempotencyKey: key,
      }),
    );
    await refresh(record.id);
  }
  function startEditing() {
    pendingWrite.current = null;
    setSavedMessage(undefined);
  }
  function retry() {
    records.refetch().catch(() => undefined);
  }
  if (records.isPending) {
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
        savedMessage={savedMessage}
        selectedId={selectedId}
      />
    </div>
  );
}
