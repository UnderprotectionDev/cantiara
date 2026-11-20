// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import { followUpWorkId } from "../../lib/test-review-panel";
import {
  type TestReviewActions,
  TestReviewView,
} from "../views/test-review-view";
import type { TestReviewSignalActions } from "./test-review-signals";

/** The Tests area's Test Review section; it gates and archives nothing. */
export default function TestReviewSurface({
  projectId,
}: {
  projectId: string;
}) {
  const recordReviewRedactionMutation = useMutation(
    orpc.recordReviewRedaction.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.recordReviewRedaction(input),
      onSuccess: () => refresh(),
    }),
  );
  const recordReviewWithdrawalMutation = useMutation(
    orpc.recordReviewWithdrawal.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.recordReviewWithdrawal(input),
      onSuccess: () => refresh(),
    }),
  );
  const recordReviewCorrectionMutation = useMutation(
    orpc.recordReviewCorrection.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.recordReviewCorrection(input),
      onSuccess: () => refresh(),
    }),
  );
  const commitReviewBulkMutation = useMutation(
    orpc.commitReviewBulk.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.commitReviewBulk(input),
      onSuccess: () => refresh(),
    }),
  );
  const setReviewItemStateMutation = useMutation(
    orpc.setReviewItemState.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setReviewItemState(input),
      onSuccess: () => refresh(),
    }),
  );
  const setReviewSessionStateMutation = useMutation(
    orpc.setReviewSessionState.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setReviewSessionState(input),
      onSuccess: () => refresh(),
    }),
  );
  const bindReviewResultMutation = useMutation(
    orpc.bindReviewResult.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.bindReviewResult(input),
      onSuccess: () => refresh(),
    }),
  );
  const commitReviewFollowUpMutation = useMutation(
    orpc.commitReviewFollowUp.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.commitReviewFollowUp(input),
      onSuccess: async (_, input) => {
        await Promise.all([
          refresh(input.projectId),
          ...(input.target.mode === "new"
            ? [
                queryClient.invalidateQueries({
                  queryKey: orpc.projectWorks.key({
                    input: { projectId: input.projectId },
                  }),
                }),
                ...invalidateSmartCollectionMembership(queryClient),
              ]
            : []),
        ]);
      },
    }),
  );
  const supersedeReviewResultMutation = useMutation(
    orpc.supersedeReviewResult.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.supersedeReviewResult(input),
      onSuccess: () => refresh(),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectTestReview.queryOptions({ input: { projectId } });
  const review = useQuery(options);
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  // The Test Summary reads this area's records, so it is read again with them.
  const refresh = (affectedProjectId = projectId) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.projectTestReview.key({
          input: { projectId: affectedProjectId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectTestSummary.key({
          input: { projectId: affectedProjectId },
        }),
      }),
    ]);
  if (review.status === "pending") {
    return <p role="status">Loading Test Review…</p>;
  }
  if (!review.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Test Review is unavailable.</p>
        <Button onClick={() => review.refetch().catch(() => undefined)}>
          Retry
        </Button>
      </div>
    );
  }
  const actions: TestReviewActions = {
    commitBulk: async (sessionId, sessionTestIds, preview) => {
      await commitReviewBulkMutation.mutateAsync({
        previewFingerprint: preview.fingerprint,
        projectId,
        sessionId,
        sessionTestIds,
      });
    },
    previewBulk: (sessionId, sessionTestIds) =>
      client.previewReviewBulk({ projectId, sessionId, sessionTestIds }),
    // The close preview names the remaining Session Tests and carries no
    // token the close needs, so it is a plain read.
    previewClose: (sessionId) =>
      queryClient.query({
        ...orpc.previewReviewClose.queryOptions({
          input: { projectId, sessionId },
        }),
        gcTime: 0,
        staleTime: 0,
      }),
    recordEvent: async (sessionId, draft) => {
      const target = {
        projectId,
        reason: draft.reason,
        sessionId,
        sessionTestId: draft.sessionTestId,
      };
      if (draft.kind === "Correction") {
        await recordReviewCorrectionMutation.mutateAsync({
          ...target,
          correctedResult: draft.correctedResult,
          note: draft.note,
        });
      } else if (draft.kind === "Withdrawal") {
        await recordReviewWithdrawalMutation.mutateAsync(target);
      } else {
        await recordReviewRedactionMutation.mutateAsync({
          ...target,
          eventId: draft.eventId,
        });
      }
    },
    setItem: async (sessionId, sessionTestId, state) => {
      await setReviewItemStateMutation.mutateAsync({
        projectId,
        sessionId,
        sessionTestId,
        state,
      });
    },
    setSession: async (sessionId, state, reason) => {
      await setReviewSessionStateMutation.mutateAsync({
        projectId,
        reason,
        sessionId,
        state,
      });
    },
  };
  const signalActions: TestReviewSignalActions = {
    bindState: bindReviewResultMutation,
    bindResult: async (scenarioId, scenarioVersion, sessionTestId) => {
      await bindReviewResultMutation.mutateAsync({
        projectId,
        scenarioId,
        scenarioVersion,
        sessionTestId,
      });
    },
    commitFollowUp: async (sessionTestIds, target, preview) => {
      await commitReviewFollowUpMutation.mutateAsync({
        previewFingerprint: preview.fingerprint,
        projectId,
        sessionTestIds,
        target,
        // Derived from the preview, so a retried commit reuses the same
        // Work identity and the server-side idempotency key.
        workId: followUpWorkId(preview.fingerprint),
      });
    },
    followUpState: commitReviewFollowUpMutation,
    previewFollowUp: (sessionTestIds, target) =>
      client.previewReviewFollowUp({ projectId, sessionTestIds, target }),
    supersede: async (newerId, olderId) => {
      await supersedeReviewResultMutation.mutateAsync({
        newerSessionTestId: newerId,
        olderSessionTestId: olderId,
        projectId,
      });
    },
  };
  return (
    <TestReviewView
      actions={actions}
      events={review.data.events}
      preferences={preferences.data}
      readOnly={review.data.readOnly}
      resultEvents={review.data.resultEvents}
      sessions={review.data.sessions}
      signals={{ actions: signalActions, data: review.data }}
    />
  );
}
