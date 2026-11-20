import type {
  FeedbackRecord,
  FeedbackStatus,
  FeedbackWorkPlan,
  FeedbackWorkType,
} from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import type { FeedbackDraft } from "../forms/create-feedback-form";
import type { SaveEvidence } from "../forms/evidence-quality-form";
import { FeedbackView } from "../views/feedback-view";

export default function FeedbackSurface({ projectId }: { projectId: string }) {
  const createFeedbackMutation = useMutation(
    orpc.createFeedback.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createFeedback(input),
      onSuccess: () => refresh(),
    }),
  );
  const setFeedbackIdentityMutation = useMutation(
    orpc.setFeedbackIdentity.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setFeedbackIdentity(input),
    }),
  );
  const setFeedbackEvidenceMutation = useMutation(
    orpc.setFeedbackEvidence.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setFeedbackEvidence(input),
    }),
  );
  const convertFeedbackToWorkMutation = useMutation(
    orpc.convertFeedbackToWork.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.convertFeedbackToWork(input),
    }),
  );
  const setFeedbackStatusMutation = useMutation(
    orpc.setFeedbackStatus.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setFeedbackStatus(input),
    }),
  );
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
    await createFeedbackMutation.mutateAsync({ ...draft, projectId });
  }
  async function setIdentity(
    record: FeedbackRecord,
    identity: { companyId: string | null; contactId: string | null },
  ) {
    try {
      await setFeedbackIdentityMutation.mutateAsync({
        ...identity,
        expectedRevision: record.revision,
        feedbackId: record.id,
        projectId,
      });
    } finally {
      await refresh();
    }
  }
  function saveEvidence(record: FeedbackRecord): SaveEvidence {
    return async (origin, command) => {
      try {
        await setFeedbackEvidenceMutation.mutateAsync({
          ...command,
          feedbackId: record.id,
          projectId,
          workId: origin.workId,
        });
      } finally {
        await refresh();
      }
    };
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
        return await convertFeedbackToWorkMutation.mutateAsync({
          baseRevision: 0,
          clientIdempotencyKey: identity.key,
          feedbackId: record.id,
          id: identity.id,
          plan,
          projectId,
          workId: identity.workId,
        });
      } finally {
        // A converted Feedback creates a Work, which can join Smart Collections.
        await Promise.all([
          refresh(),
          ...invalidateSmartCollectionMembership(queryClient),
        ]);
      }
    };
  }
  async function setStatus(record: FeedbackRecord, status: FeedbackStatus) {
    try {
      await setFeedbackStatusMutation.mutateAsync({
        expectedRevision: record.revision,
        feedbackId: record.id,
        projectId,
        status,
      });
    } finally {
      await refresh();
    }
  }
  function retry() {
    records.refetch().catch(() => undefined);
  }
  if (records.status === "pending") {
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
      onSaveEvidence={saveEvidence}
      onSetIdentity={setIdentity}
      onSetStatus={setStatus}
      readOnly={records.data.readOnly}
      records={records.data.records}
    />
  );
}
