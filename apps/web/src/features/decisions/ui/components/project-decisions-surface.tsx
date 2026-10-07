import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import FavoriteControl from "@/features/favorites/ui/components/favorite-control";
import PersonalReminderControl from "@/features/personal-reminders/ui/components/personal-reminder-control";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  type DecisionDraft,
  type DecisionRecord,
  ProjectDecisionsView,
} from "./project-decisions-view";

export default function ProjectDecisionsSurface({
  projectId,
  selectedId,
  readOnly = false,
  accountFormattingPreferences,
}: {
  projectId: string;
  selectedId?: string;
  readOnly?: boolean;
  accountFormattingPreferences?: AccountPreferences;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectDecisions.queryOptions({ input: { projectId } });
  const records = useQuery(options);
  const [savedMessage, setSavedMessage] = useState<string>();
  const pendingWrite = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  function commandIdentity(payload: unknown, record?: DecisionRecord) {
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
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
  }
  async function save(draft: DecisionDraft, record?: DecisionRecord) {
    const fields = {
      title: draft.title.trim(),
      decision: draft.decision.trim(),
      rationale: draft.rationale.trim() || null,
      sourceType: "Decision" as const,
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
    await refresh("Decision saved.");
  }
  async function withdraw(draft: DecisionDraft, record?: DecisionRecord) {
    if (!record) {
      throw new Error("Decision is unavailable.");
    }
    const fields = {
      life: "Withdrawn" as const,
      rationale: draft.rationale.trim() || null,
      sourceType: "Decision" as const,
      projectId,
      sourceId: record.id,
    };
    const { key } = commandIdentity(
      { operation: "withdraw", ...fields },
      record,
    );
    await runOnlineOnlyWrite(() =>
      client.transitionProjectSourceRecord({
        ...fields,
        baseRevision: record.revision,
        clientIdempotencyKey: key,
      }),
    );
    await refresh("Decision withdrawn.");
  }
  function startEditing() {
    pendingWrite.current = null;
    setSavedMessage(undefined);
  }
  function retry() {
    records.refetch().catch(() => undefined);
  }
  if (records.isPending) {
    return <p role="status">Loading Decisions…</p>;
  }
  if (records.isError || !records.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Decisions are unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  const decisions = records.data.records.filter(
    (record): record is DecisionRecord => record.sourceType === "Decision",
  );
  const selected = decisions.find((record) => record.id === selectedId);
  return (
    <div className="space-y-5">
      <ProjectDecisionsView
        accountFormattingPreferences={accountFormattingPreferences}
        decisions={decisions}
        onSave={save}
        onStartEditing={startEditing}
        onWithdraw={withdraw}
        projectId={projectId}
        readOnly={readOnly || records.data.readOnly}
        savedMessage={savedMessage}
        selectedId={selectedId}
      />
      {selected ? (
        <FavoriteControl
          sourceRecordId={selected.id}
          sourceRecordType="Decision"
        />
      ) : null}
      {selected && !(readOnly || records.data.readOnly) ? (
        <PersonalReminderControl
          compact
          sourceRecordId={selected.id}
          sourceRecordType="Decision"
          sourceTitle={selected.title}
        />
      ) : null}
    </div>
  );
}
