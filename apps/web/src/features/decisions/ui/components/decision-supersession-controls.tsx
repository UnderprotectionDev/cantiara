// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind the current Decision selection and preview.
import type {
  DecisionSupersessionPreview,
  DecisionSupersessionSelection,
} from "@cantiara/api/decision-supersession";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  DecisionSupersessionPreviewView,
  SupersessionRelationSummary,
  SupersessionSelectionForm,
} from "./decision-supersession-view";

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
  const [selection, setSelection] = useState<DecisionSupersessionSelection>();
  const [prepared, setPrepared] = useState<{
    preview: DecisionSupersessionPreview;
    key: string;
  }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState(false);
  function cancel() {
    setSelection(undefined);
    setPrepared(undefined);
    setError(undefined);
    setConflict(false);
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
  async function preview(input: DecisionSupersessionSelection) {
    const result = await client.previewDecisionSupersession(input);
    setPrepared({ preview: result, key: crypto.randomUUID() });
    setError(undefined);
  }
  async function confirm() {
    // biome-ignore lint/suspicious/noUnnecessaryConditions: React state remains optional before the preview is prepared.
    if (!prepared) {
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await runOnlineOnlyWrite(() =>
        client.commitDecisionSupersession({
          ...prepared.preview.command,
          clientIdempotencyKey: prepared.key,
        }),
      );
      cancel();
      await queryClient.invalidateQueries();
    } catch (cause) {
      const stale =
        typeof cause === "object" &&
        // biome-ignore lint/suspicious/noUnnecessaryConditions: Caught network failures may contain a null value.
        cause !== null &&
        "code" in cause &&
        cause.code === "CONFLICT";
      setConflict(stale);
      setError(
        stale
          ? "Decisions changed. Cancel and preview again before confirming."
          : "Supersession could not be saved. Retry to check the same request.",
      );
    } finally {
      setPending(false);
    }
  }
  if (graph.isPending) {
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
      {error ? <p role="alert">{error}</p> : null}
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
      {selection && !readOnly && !graph.data.readOnly && prepared ? (
        <DecisionSupersessionPreviewView
          conflict={conflict}
          onCancel={cancel}
          onConfirm={confirm}
          pending={pending}
          preview={prepared.preview}
        />
      ) : null}
      {selection && !readOnly && !graph.data.readOnly && !prepared ? (
        <SupersessionSelectionForm
          onCancel={cancel}
          onPreview={preview}
          records={decisionRecords}
          selection={selection}
        />
      ) : null}
    </section>
  );
}
