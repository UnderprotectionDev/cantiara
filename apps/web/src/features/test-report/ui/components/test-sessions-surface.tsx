// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "@/utils/orpc";
import { maskedReviewMessage, toManualInput } from "../../lib/test-report-form";
import { TestSessionsView } from "../views/test-sessions-view";

/** The Tests area's Test Session list; it runs no test and opens no review. */
export default function TestSessionsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const acceptTestReportMutation = useMutation(
    orpc.acceptTestReport.mutationOptions({
      mutationFn: (input) => client.acceptTestReport(input),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectTestSessions.queryOptions({
    input: { projectId },
  });
  const sessions = useQuery(options);
  // Accepted Test Sessions are reviewed and summarized in the same area.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
      queryClient.invalidateQueries({ queryKey: orpc.projectTestReview.key() }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectTestSummary.key(),
      }),
    ]);
  if (sessions.status === "pending") {
    return <p role="status">Loading Test Sessions…</p>;
  }
  if (!sessions.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Test Sessions are unavailable.</p>
        <Button onClick={() => sessions.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <TestSessionsView
      onImport={async (file) => {
        const result = await acceptTestReportMutation.mutateAsync({
          content: file.content,
          format: file.format,
          ingress: "File import",
          projectId,
        });
        const review = maskedReviewMessage(result);
        if (review) {
          throw new Error(review);
        }
        await refresh();
      }}
      onRecord={async (values) => {
        const result = await acceptTestReportMutation.mutateAsync(
          toManualInput(projectId, values),
        );
        const review = maskedReviewMessage(result);
        if (review) {
          throw new Error(review);
        }
        await refresh();
      }}
      readOnly={sessions.data.readOnly}
      sessions={sessions.data.sessions}
    />
  );
}
