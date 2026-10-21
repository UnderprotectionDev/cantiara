// biome-ignore-all lint/performance/noJsxPropsBind: The retry handler binds to the query.
import type { TestSummaryScopeInput } from "@cantiara/api/test-review-summary";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { TestSummaryView } from "../views/test-summary-view";

/**
 * Data wiring of the neutral Test Summary. It only reads
 * `projectTestSummary`; no mutation is reachable from here.
 */
export default function TestSummarySurface({
  projectId,
  scope,
}: {
  projectId: string;
  scope: TestSummaryScopeInput;
}) {
  const summary = useQuery(
    orpc.projectTestSummary.queryOptions({ input: { projectId, scope } }),
  );
  if (summary.isPending) {
    return <p role="status">Loading Test Summary…</p>;
  }
  if (!summary.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Test Summary is unavailable.</p>
        <Button onClick={() => summary.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  return <TestSummaryView projectId={projectId} summary={summary.data} />;
}
