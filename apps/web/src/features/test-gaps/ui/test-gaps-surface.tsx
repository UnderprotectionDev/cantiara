// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import type { TestGapRelationTargetType } from "@cantiara/api/test-gaps";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { toRelationInputs } from "../lib/test-gap-form";
import { TestGapsView } from "./test-gaps-view";

/** The Tests area's Test Gap list; it files, plans and closes nothing by itself. */
export default function TestGapsSurface({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const options = orpc.projectTestGaps.queryOptions({ input: { projectId } });
  const gaps = useQuery(options);
  const cases = useQuery(
    orpc.projectPlannedTestCases.queryOptions({ input: { projectId } }),
  );
  const handoffs = useQuery(
    orpc.projectTestHandoffs.queryOptions({ input: { projectId } }),
  );
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });
  const loadTargets = useCallback(
    (targetType: TestGapRelationTargetType) =>
      client.testGapRelationTargets({ projectId, targetType }),
    [projectId],
  );
  if (gaps.isPending || cases.isPending || handoffs.isPending) {
    return <p role="status">Loading Test Gaps…</p>;
  }
  if (!(gaps.data && cases.data && handoffs.data)) {
    return (
      <div className="space-y-3">
        <p role="alert">Test Gaps are unavailable.</p>
        <Button
          onClick={() => {
            gaps.refetch().catch(() => undefined);
            cases.refetch().catch(() => undefined);
            handoffs.refetch().catch(() => undefined);
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
      loadTargets={loadTargets}
      onCreate={async (values) => {
        await runOnlineOnlyWrite(() =>
          client.createTestGap({
            projectId,
            rationale: values.rationale,
            relations: toRelationInputs(values.relations),
            title: values.title,
          }),
        );
        await refresh();
      }}
      onPlanCase={async (gap, ref) => {
        try {
          await runOnlineOnlyWrite(() =>
            client.bindTestGapCase({ ...ref, gapId: gap.id, projectId }),
          );
        } finally {
          await refresh();
        }
      }}
      onPlanHandoff={async (gap, handoffId) => {
        try {
          await runOnlineOnlyWrite(() =>
            client.bindTestGapHandoff({ gapId: gap.id, handoffId, projectId }),
          );
        } finally {
          await refresh();
        }
      }}
      onUnplanCase={async (gap, ref) => {
        try {
          await runOnlineOnlyWrite(() =>
            client.unbindTestGapCase({ ...ref, gapId: gap.id, projectId }),
          );
        } finally {
          await refresh();
        }
      }}
      onUnplanHandoff={async (gap, handoffId) => {
        try {
          await runOnlineOnlyWrite(() =>
            client.unbindTestGapHandoff({
              gapId: gap.id,
              handoffId,
              projectId,
            }),
          );
        } finally {
          await refresh();
        }
      }}
      readOnly={gaps.data.readOnly}
    />
  );
}
