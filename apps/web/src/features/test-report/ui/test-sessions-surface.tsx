// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { toManualInput } from "../lib/test-report-form";
import { TestSessionsView } from "./test-sessions-view";

/** The Tests area's Test Session list; it runs no test and opens no review. */
export default function TestSessionsSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectTestSessions.queryOptions({
    input: { projectId },
  });
  const sessions = useQuery(options);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });
  if (sessions.isPending) {
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
        await runOnlineOnlyWrite(() =>
          client.acceptTestReport({
            content: file.content,
            format: file.format,
            ingress: "File import",
            projectId,
          }),
        );
        await refresh();
      }}
      onRecord={async (values) => {
        await runOnlineOnlyWrite(() =>
          client.acceptTestReport(toManualInput(projectId, values)),
        );
        await refresh();
      }}
      readOnly={sessions.data.readOnly}
      sessions={sessions.data.sessions}
    />
  );
}
