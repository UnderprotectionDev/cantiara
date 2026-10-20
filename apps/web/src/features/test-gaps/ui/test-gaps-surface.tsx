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
  const loadTargets = useCallback(
    (targetType: TestGapRelationTargetType) =>
      client.testGapRelationTargets({ projectId, targetType }),
    [projectId],
  );
  if (gaps.isPending) {
    return <p role="status">Loading Test Gaps…</p>;
  }
  if (!gaps.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Test Gaps are unavailable.</p>
        <Button onClick={() => gaps.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <TestGapsView
      gaps={gaps.data.gaps}
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
        await queryClient.invalidateQueries({ queryKey: options.queryKey });
      }}
      readOnly={gaps.data.readOnly}
    />
  );
}
