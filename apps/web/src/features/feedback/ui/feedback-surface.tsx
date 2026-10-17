import type { FeedbackRecord, FeedbackStatus } from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { type FeedbackDraft, FeedbackView } from "./feedback-view";

export default function FeedbackSurface({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const options = orpc.projectFeedback.queryOptions({ input: { projectId } });
  const records = useQuery(options);
  const attachments = useQuery(
    orpc.fileAttachments.queryOptions({
      input: { scope: { kind: "project", projectId } },
    }),
  );
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
  }
  async function create(draft: FeedbackDraft) {
    await runOnlineOnlyWrite(() =>
      client.createFeedback({ ...draft, projectId }),
    );
    await refresh();
  }
  async function setStatus(record: FeedbackRecord, status: FeedbackStatus) {
    try {
      await runOnlineOnlyWrite(() =>
        client.setFeedbackStatus({
          expectedRevision: record.revision,
          feedbackId: record.id,
          projectId,
          status,
        }),
      );
    } finally {
      await refresh();
    }
  }
  function retry() {
    records.refetch().catch(() => undefined);
  }
  if (records.isPending) {
    return <p role="status">Loading Feedback…</p>;
  }
  if (!records.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Feedback is unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  return (
    <FeedbackView
      attachmentOptions={(attachments.data ?? [])
        .filter(({ lifecycleStatus }) => lifecycleStatus === "Active")
        .map(({ id, name }) => ({ id, name }))}
      onCreate={create}
      onSetStatus={setStatus}
      readOnly={records.data.readOnly}
      records={records.data.records}
    />
  );
}
