// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import type {
  TestGapRecord,
  TestGapRelationTargetType,
} from "@cantiara/api/test-gaps";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { client, orpc } from "@/utils/orpc";
import { toRelationInputs } from "../../lib/test-gap-form";
import { TestGapsView } from "../views/test-gaps-view";

/** The state the founder saw when closing; only a planning state can be closed. */
function planningState(gap: TestGapRecord): "Open" | "Planned" {
  return gap.state === "Planned" ? "Planned" : "Open";
}

/** The Tests area's Test Gap list; it files, plans and closes nothing by itself. */
export default function TestGapsSurface({ projectId }: { projectId: string }) {
  const closeTestGapMutation = useMutation(
    orpc.closeTestGap.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.closeTestGap(input),
      onSettled: () => refresh(),
    }),
  );
  const createTestGapMutation = useMutation(
    orpc.createTestGap.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createTestGap(input),
      onSuccess: () => refresh(),
    }),
  );
  const bindTestGapCaseMutation = useMutation(
    orpc.bindTestGapCase.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.bindTestGapCase(input),
      onSettled: () => refresh(),
    }),
  );
  const bindTestGapHandoffMutation = useMutation(
    orpc.bindTestGapHandoff.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.bindTestGapHandoff(input),
      onSettled: () => refresh(),
    }),
  );
  const unbindTestGapCaseMutation = useMutation(
    orpc.unbindTestGapCase.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.unbindTestGapCase(input),
      onSettled: () => refresh(),
    }),
  );
  const unbindTestGapHandoffMutation = useMutation(
    orpc.unbindTestGapHandoff.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.unbindTestGapHandoff(input),
      onSettled: () => refresh(),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectTestGaps.queryOptions({ input: { projectId } });
  const gaps = useQuery(options);
  const cases = useQuery(
    orpc.projectPlannedTestCases.queryOptions({ input: { projectId } }),
  );
  const handoffs = useQuery(
    orpc.projectTestHandoffs.queryOptions({ input: { projectId } }),
  );
  const sessionTests = useQuery(
    orpc.projectSessionTests.queryOptions({ input: { projectId } }),
  );
  const loadDecisions = useCallback(
    () => client.testGapDecisionTargets({ projectId }),
    [projectId],
  );
  // The Test Summary reads this area's records, so it is read again with them.
  const refreshSummary = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.projectTestSummary.key({ input: { projectId } }),
    });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
      refreshSummary(),
    ]);
  const loadTargets = useCallback(
    (targetType: TestGapRelationTargetType) =>
      client.testGapRelationTargets({ projectId, targetType }),
    [projectId],
  );
  if (
    gaps.status === "pending" ||
    cases.isPending ||
    handoffs.isPending ||
    sessionTests.isPending
  ) {
    return <p role="status">Loading Test Gaps…</p>;
  }
  if (!(gaps.data && cases.data && handoffs.data && sessionTests.data)) {
    return (
      <div className="space-y-3">
        <p role="alert">Test Gaps are unavailable.</p>
        <Button
          onClick={() => {
            gaps.refetch().catch(() => undefined);
            cases.refetch().catch(() => undefined);
            handoffs.refetch().catch(() => undefined);
            sessionTests.refetch().catch(() => undefined);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }
  return (
    <TestGapsView
      cases={cases.data.cases}
      gaps={gaps.data.gaps}
      handoffs={handoffs.data.handoffs}
      loadDecisions={loadDecisions}
      loadTargets={loadTargets}
      onClose={async (gap, values) => {
        await closeTestGapMutation.mutateAsync(
          values.outcome === "Met by result"
            ? {
                expectedState: planningState(gap),
                gapId: gap.id,
                outcome: "Met by result",
                projectId,
                rationale: values.rationale,
                sessionTestIds: values.sessionTestIds,
              }
            : {
                decisionId: values.decisionId || null,
                expectedState: planningState(gap),
                gapId: gap.id,
                outcome: "Not needed",
                projectId,
                rationale: values.rationale,
              },
        );
      }}
      onCreate={async (values) => {
        await createTestGapMutation.mutateAsync({
          projectId,
          rationale: values.rationale,
          relations: toRelationInputs(values.relations),
          title: values.title,
        });
      }}
      onPlanCase={async (gap, ref) => {
        await bindTestGapCaseMutation.mutateAsync({
          ...ref,
          gapId: gap.id,
          projectId,
        });
      }}
      onPlanHandoff={async (gap, handoffId) => {
        await bindTestGapHandoffMutation.mutateAsync({
          gapId: gap.id,
          handoffId,
          projectId,
        });
      }}
      onUnplanCase={async (gap, ref) => {
        await unbindTestGapCaseMutation.mutateAsync({
          ...ref,
          gapId: gap.id,
          projectId,
        });
      }}
      onUnplanHandoff={async (gap, handoffId) => {
        await unbindTestGapHandoffMutation.mutateAsync({
          gapId: gap.id,
          handoffId,
          projectId,
        });
      }}
      readOnly={gaps.data.readOnly}
      sessionTests={sessionTests.data.sessionTests}
    />
  );
}
