import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import PersonalReminderControl from "@/features/personal-reminders/ui/components/personal-reminder-control";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  ProjectRisksView,
  type RiskDraft,
  type RiskRecord,
} from "./project-risks-view";

export default function ProjectRisksSurface({
  projectId,
  selectedId,
}: {
  projectId: string;
  selectedId?: string;
}) {
  const options = orpc.projectRisks.queryOptions({ input: { projectId } });
  const records = useQuery(options);
  const queryClient = useQueryClient();
  const [savedMessage, setSavedMessage] = useState<string>();
  const pendingWrite = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  function commandIdentity(payload: unknown, record?: RiskRecord) {
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
  async function refresh(message: string) {
    pendingWrite.current = null;
    setSavedMessage(message);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectSourceRecord.key(),
      }),
      queryClient.invalidateQueries({ queryKey: orpc.tableRecords.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.searchRecords.key() }),
    ]);
  }
  async function write(command: () => Promise<unknown>) {
    try {
      await runOnlineOnlyWrite(command);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "CONFLICT"
      ) {
        await queryClient.invalidateQueries({ queryKey: options.queryKey });
      }
      throw error;
    }
  }
  async function save(draft: RiskDraft, record?: RiskRecord) {
    const fields = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      impact: draft.impact.trim() || null,
      probability: draft.probability.trim() || null,
      response: draft.response.trim() || null,
      sourceType: "Risk" as const,
      projectId,
    };
    const { id, key } = commandIdentity(
      { operation: "save", ...fields, rationale: draft.rationale },
      record,
    );
    await write(() =>
      record
        ? client.updateProjectSourceRecord({
            ...fields,
            rationale: draft.rationale.trim() || null,
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
    await refresh("Risk saved.");
  }
  async function transition(draft: RiskDraft, record?: RiskRecord) {
    if (!record) {
      throw new Error("Risk is unavailable.");
    }
    const fields = {
      projectId,
      sourceId: record.id,
      sourceType: "Risk" as const,
      life: draft.life,
      rationale: draft.rationale.trim() || null,
    };
    const { key } = commandIdentity(
      { operation: "transition", ...fields },
      record,
    );
    await write(() =>
      client.transitionProjectSourceRecord({
        ...fields,
        baseRevision: record.revision,
        clientIdempotencyKey: key,
      }),
    );
    await refresh("Risk status saved.");
  }
  function startEditing() {
    pendingWrite.current = null;
    setSavedMessage(undefined);
  }
  function retry() {
    records.refetch().catch(() => undefined);
  }
  if (records.isPending) {
    return <p role="status">Loading Risks…</p>;
  }
  if (records.isError || !records.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Risks are unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  const selected = records.data.records.find(
    (record) => record.id === selectedId,
  );
  return (
    <div className="space-y-5">
      <ProjectRisksView
        onSave={save}
        onStartEditing={startEditing}
        onTransition={transition}
        projectId={projectId}
        readOnly={records.data.readOnly}
        records={records.data.records}
        savedMessage={savedMessage}
        selectedId={selectedId}
      />
      {selected && !records.data.readOnly ? (
        <PersonalReminderControl
          compact
          sourceRecordId={selected.id}
          sourceRecordType="Risk"
          sourceTitle={selected.title}
        />
      ) : null}
    </div>
  );
}
