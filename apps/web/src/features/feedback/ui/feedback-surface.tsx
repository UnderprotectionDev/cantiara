import type {
  FeedbackRecord,
  FeedbackStatus,
  FeedbackWorkPlan,
  FeedbackWorkType,
} from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { type FeedbackDraft, FeedbackView } from "./feedback-view";

export default function FeedbackSurface({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const options = orpc.projectFeedback.queryOptions({ input: { projectId } });
  const records = useQuery(options);
  const contacts = useQuery(orpc.contacts.queryOptions());
  const companies = useQuery(orpc.companies.queryOptions());
  const attachments = useQuery(
    orpc.fileAttachments.queryOptions({
      input: { scope: { kind: "project", projectId } },
    }),
  );
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
    await queryClient.invalidateQueries({
      queryKey: orpc.feedbackFeed.key(),
    });
  }
  async function create(draft: FeedbackDraft) {
    await runOnlineOnlyWrite(() =>
      client.createFeedback({ ...draft, projectId }),
    );
    await refresh();
  }
  async function setIdentity(
    record: FeedbackRecord,
    identity: { companyId: string | null; contactId: string | null },
  ) {
    try {
      await runOnlineOnlyWrite(() =>
        client.setFeedbackIdentity({
          ...identity,
          expectedRevision: record.revision,
          feedbackId: record.id,
          projectId,
        }),
      );
    } finally {
      await refresh();
    }
  }
  function previewConvert(record: FeedbackRecord) {
    return (workType: FeedbackWorkType) =>
      client.previewFeedbackWork({
        feedbackId: record.id,
        projectId,
        workType,
      });
  }
  function confirmConvert(record: FeedbackRecord) {
    return async (
      plan: FeedbackWorkPlan,
      identity: { id: string; key: string; workId: string },
    ) => {
      try {
        return await runOnlineOnlyWrite(() =>
          client.convertFeedbackToWork({
            baseRevision: 0,
            clientIdempotencyKey: identity.key,
            feedbackId: record.id,
            id: identity.id,
            plan,
            projectId,
            workId: identity.workId,
          }),
        );
      } finally {
        await refresh();
      }
    };
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
      companyOptions={(companies.data ?? [])
        .filter(({ archivedAt }) => archivedAt === null)
        .map(({ id, name }) => ({ id, name }))}
      contactOptions={(contacts.data ?? [])
        .filter(({ archivedAt }) => archivedAt === null)
        .map(({ displayName, emails, id }) => ({
          id,
          name: displayName ?? emails[0] ?? "Unnamed Contact",
        }))}
      onConfirmConvert={confirmConvert}
      onCreate={create}
      onPreviewConvert={previewConvert}
      onSetIdentity={setIdentity}
      onSetStatus={setStatus}
      readOnly={records.data.readOnly}
      records={records.data.records}
    />
  );
}
