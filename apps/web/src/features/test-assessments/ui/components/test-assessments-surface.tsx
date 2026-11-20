// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import type { TestAssessmentContextKind } from "@cantiara/api/test-assessments";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { client, orpc } from "@/utils/orpc";
import { toRecordInput } from "../../lib/test-assessment-form";
import { TestAssessmentsView } from "../views/test-assessments-view";

/** The Tests area's Recent Test Assessments list; it scores and gates nothing. */
export default function TestAssessmentsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const recordTestAssessmentMutation = useMutation(
    orpc.recordTestAssessment.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.recordTestAssessment(input),
      onSuccess: (_, { projectId: affectedProject }) =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.projectTestAssessments.key({
              input: { projectId: affectedProject },
            }),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.projectTestSummary.key({
              input: { projectId: affectedProject },
            }),
          }),
        ]),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectTestAssessments.queryOptions({
    input: { projectId },
  });
  const assessments = useQuery(options);
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  const loadContextTargets = useCallback(
    (kind: TestAssessmentContextKind) =>
      client.testAssessmentContextTargets({ kind, projectId }),
    [projectId],
  );
  if (assessments.status === "pending") {
    return <p role="status">Loading Test Assessments…</p>;
  }
  if (!assessments.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Test Assessments are unavailable.</p>
        <Button onClick={() => assessments.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <TestAssessmentsView
      assessments={assessments.data.assessments}
      loadContextTargets={loadContextTargets}
      onRecord={async (values) => {
        const input = toRecordInput(projectId, values);
        if (!input) {
          throw new Error("Choose a context and a decision.");
        }
        await recordTestAssessmentMutation.mutateAsync(input);
      }}
      preferences={preferences.data}
    />
  );
}
