// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind the current Decision selection and preview.

import type { DecisionSupersessionSelection } from "@cantiara/api/decision-supersession";
import { Button } from "@cantiara/ui/components/button";
import { ORPCError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useRef } from "react";
import { client, orpc } from "@/utils/orpc";
import { SupersessionSelectionForm } from "../forms/supersession-selection-form";
import {
  DecisionSupersessionPreviewView,
  SupersessionRelationSummary,
} from "./decision-supersession-preview";

export default function DecisionSupersessionControls({
  projectId,
  selectedId,
  readOnly,
}: {
  projectId: string;
  selectedId: string;
  readOnly: boolean;
}) {
  const queryClient = useQueryClient();
  const graph = useQuery(
    orpc.decisionSupersessionGraph.queryOptions({ input: { projectId } }),
  );
  const selectionSession = useCreateStore(
    undefined as DecisionSupersessionSelection | undefined,
    ({ setState }) => ({
      setSelection: (next: DecisionSupersessionSelection | undefined) =>
        setState(() => next),
    }),
  );
  const selection = useSelector(selectionSession);
  const { setSelection } = selectionSession.actions;
  const previewKey = useRef<string | null>(null);
  const preview = useMutation(
    orpc.previewDecisionSupersession.mutationOptions({
      mutationFn: (input) => client.previewDecisionSupersession(input),
    }),
  );
  const commit = useMutation(
    orpc.commitDecisionSupersession.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.commitDecisionSupersession(input),
      onSuccess: async (_, input) => {
        if (previewKey.current === input.clientIdempotencyKey) {
          cancel();
        }
        const committedProjectId = input.projectId;
        await Promise.all(
          [
            orpc.decisionSupersessionGraph.queryKey({
              input: { projectId: committedProjectId },
            }),
            orpc.projectDecisions.queryKey({
              input: { projectId: committedProjectId },
            }),
            orpc.decisionSupersessionHistory.key(),
            orpc.projectSourceRecord.key(),
            orpc.searchRecords.key(),
          ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
      },
    }),
  );
  const conflict =
    commit.error instanceof ORPCError && commit.error.code === "CONFLICT";
  const failureMessage = conflict
    ? "Decisions changed. Cancel and preview again before confirming."
    : "Supersession could not be saved. Retry to check the same request.";
  const canReview = selection && !readOnly && !graph.data?.readOnly;
  function cancel() {
    setSelection(undefined);
    previewKey.current = null;
    preview.reset();
    commit.reset();
  }

  function start(
    operation: "supersede" | "remove",
    successorId: string,
    predecessorIds: string[],
  ) {
    cancel();
    setSelection({
      projectId,
      successorId,
      predecessorIds,
      operation,
      rationale: null,
    });
  }

  async function loadPreview(input: DecisionSupersessionSelection) {
    previewKey.current = crypto.randomUUID();
    await preview.mutateAsync(input).catch(() => undefined);
  }

  function confirm() {
    if (preview.isSuccess && previewKey.current) {
      commit.mutate({
        ...preview.data.command,
        clientIdempotencyKey: previewKey.current,
      });
    }
  }

  if (graph.status === "pending") {
    return <p role="status">Loading supersession…</p>;
  }
  if (!graph.data || graph.isError) {
    return <p role="alert">Supersession is unavailable.</p>;
  }
  const decisionRecords = graph.data.records;
  const selected = decisionRecords.find((record) => record.id === selectedId);
  const edges = graph.data.relations.filter(
    (edge) =>
      edge.predecessorId === selectedId || edge.successorId === selectedId,
  );
  return (
    <section aria-label="Supersession" className="space-y-4">
      {commit.isError ? <p role="alert">{failureMessage}</p> : null}
      {edges.map((edge) => (
        <div
          className="flex flex-wrap items-center gap-3"
          key={edge.predecessorId}
        >
          <p>
            <SupersessionRelationSummary
              records={decisionRecords}
              relation={edge}
            />
          </p>
          {readOnly || graph.data?.readOnly ? null : (
            <Button
              disabled={Boolean(selection)}
              onClick={() =>
                start("remove", edge.successorId, [edge.predecessorId])
              }
              variant="outline"
            >
              Remove supersession
            </Button>
          )}
        </div>
      ))}
      {!(readOnly || graph.data.readOnly) &&
      selected?.life === "Valid" &&
      !selection ? (
        <Button
          onClick={() => start("supersede", selectedId, [])}
          variant="outline"
        >
          Supersede another decision
        </Button>
      ) : null}
      {canReview && preview.data ? (
        <DecisionSupersessionPreviewView
          conflict={conflict}
          onCancel={cancel}
          onConfirm={confirm}
          pending={commit.isPending}
          preview={preview.data}
        />
      ) : null}
      {canReview && !preview.data && selection ? (
        <SupersessionSelectionForm
          onCancel={cancel}
          onPreview={loadPreview}
          previewFailed={preview.isError}
          records={decisionRecords}
          selection={selection}
        />
      ) : null}
    </section>
  );
}
