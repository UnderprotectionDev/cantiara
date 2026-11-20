import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import FavoriteControl from "@/components/favorite-control";
import PersonalReminderControl from "@/components/personal-reminder-control";
import EvidenceFlowPanel from "@/features/evidence/ui/components/evidence-flow-panel";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import DecisionSupersessionControls from "./decision-supersession-controls";
import {
  type DecisionDraft,
  type DecisionRecord,
  ProjectDecisionsView,
} from "./project-decisions-panel";

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
  const updateProjectSourceRecordMutation = useMutation(
    orpc.updateProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (request) => client.updateProjectSourceRecord(request),
      onSuccess: (_, input) =>
        refresh(input.projectId, input.clientIdempotencyKey),
    }),
  );
  const createProjectSourceRecordMutation = useMutation(
    orpc.createProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (request) => client.createProjectSourceRecord(request),
      onSuccess: (_, input) =>
        refresh(input.projectId, input.clientIdempotencyKey),
    }),
  );
  const transitionProjectSourceRecordMutation = useMutation(
    orpc.transitionProjectSourceRecord.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.transitionProjectSourceRecord(input),
      onSuccess: (_, input) =>
        refresh(input.projectId, input.clientIdempotencyKey),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectDecisions.queryOptions({ input: { projectId } });
  const records = useQuery(options);
  const graph = useQuery({
    ...orpc.decisionSupersessionGraph.queryOptions({ input: { projectId } }),
    enabled: Boolean(selectedId),
  });
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
  async function refresh(committedProjectId: string, commandKey: string) {
    if (pendingWrite.current?.key === commandKey) {
      pendingWrite.current = null;
    }
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.projectDecisions.queryKey({
          input: { projectId: committedProjectId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.decisionSupersessionGraph.queryOptions({
          input: { projectId: committedProjectId },
        }).queryKey,
      }),
      ...invalidateSmartCollectionMembership(queryClient),
    ]);
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
  const saved =
    createProjectSourceRecordMutation.isSuccess ||
    updateProjectSourceRecordMutation.isSuccess;
  const saveMessage = saved ? "Decision saved." : undefined;
  const savedMessage = transitionProjectSourceRecordMutation.isSuccess
    ? "Decision withdrawn."
    : saveMessage;
  const decisions = records.data.records.filter(
    (record): record is DecisionRecord => record.sourceType === "Decision",
  );
  const selected = decisions.find((record) => record.id === selectedId);
  function renderEvidenceFlow(recordId: string) {
    return (
      <EvidenceFlowPanel
        projectId={projectId}
        recordId={recordId}
        type="Decision"
      />
    );
  }
  return (
    <div className="space-y-5">
      <ProjectDecisionsView
        accountFormattingPreferences={accountFormattingPreferences}
        decisions={decisions}
        graph={graph.isError ? undefined : (graph.data ?? undefined)}
        onSave={save}
        onStartEditing={startEditing}
        onWithdraw={withdraw}
        projectId={projectId}
        readOnly={readOnly || Boolean(records.data?.readOnly)}
        renderEvidenceFlow={renderEvidenceFlow}
        savedMessage={savedMessage}
        selectedId={selectedId}
        writeError={
          transitionProjectSourceRecordMutation.error ??
          updateProjectSourceRecordMutation.error ??
          createProjectSourceRecordMutation.error
        }
      />
      <SelectedDecisionActions
        graph={graph}
        projectId={projectId}
        readOnly={readOnly}
        records={records}
        selected={selected}
      />{" "}
    </div>
  );
}

function SelectedDecisionActions({
  selected,
  graph,
  projectId,
  readOnly,
  records,
}: {
  selected: DecisionRecord | undefined;
  graph: import("@tanstack/react-query").UseQueryResult<
    Awaited<ReturnType<typeof client.decisionSupersessionGraph>>,
    Error
  >;
  projectId: string;
  readOnly: boolean;
  records: import("@tanstack/react-query").UseQueryResult<
    Awaited<ReturnType<typeof client.projectDecisions>>,
    Error
  >;
}) {
  return (
    <>
      {" "}
      {selected && graph.isPending ? (
        <p role="status">Loading Decision chain…</p>
      ) : null}
      {selected && (graph.isError || !(graph.isPending || graph.data)) ? (
        <p role="alert">Decision chain is unavailable.</p>
      ) : null}
      {selected ? (
        <DecisionSupersessionControls
          projectId={projectId}
          readOnly={readOnly || Boolean(records.data?.readOnly)}
          selectedId={selected.id}
        />
      ) : null}
      {selected ? (
        <FavoriteControl
          sourceRecordId={selected.id}
          sourceRecordType="Decision"
        />
      ) : null}
      {selected && !(readOnly || records.data?.readOnly) ? (
        <PersonalReminderControl
          compact
          sourceRecordId={selected.id}
          sourceRecordType="Decision"
          sourceTitle={selected.title}
        />
      ) : null}
    </>
  );
}
