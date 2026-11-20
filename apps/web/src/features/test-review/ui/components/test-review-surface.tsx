// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
  projectWorksQueryPrefix,
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
  const commitReviewBulkMutation = useMutation(
    orpc.commitReviewBulk.mutationOptions({
      mutationFn: (input) => client.commitReviewBulk(input),
      onSuccess: () => refresh(),
    }),
  );
  const setReviewItemStateMutation = useMutation(
    orpc.setReviewItemState.mutationOptions({
      mutationFn: (input) => client.setReviewItemState(input),
      onSuccess: () => refresh(),
    }),
  );
  const setReviewSessionStateMutation = useMutation(
    orpc.setReviewSessionState.mutationOptions({
      mutationFn: (input) => client.setReviewSessionState(input),
      onSuccess: () => refresh(),
    }),
  );
  const bindReviewResultMutation = useMutation(
    orpc.bindReviewResult.mutationOptions({
      mutationFn: (input) => client.bindReviewResult(input),
      onSuccess: () => refresh(),
    }),
  );
  const commitReviewFollowUpMutation = useMutation(
    orpc.commitReviewFollowUp.mutationOptions({
      mutationFn: (input) => client.commitReviewFollowUp(input),
    }),
  );
  const supersedeReviewResultMutation = useMutation(
    orpc.supersedeReviewResult.mutationOptions({
      mutationFn: (input) => client.supersedeReviewResult(input),
      onSuccess: () => refresh(),
    }),
  );
  const queryClient = useQueryClient();
  const options = orpc.projectTestReview.queryOptions({ input: { projectId } });
  const review = useQuery(options);
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  // The Test Summary reads this area's records, so it is read again with them.
  const refreshSummary = () =>
    queryClient.invalidateQueries({ queryKey: orpc.projectTestSummary.key() });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
      refreshSummary(),
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
      await runOnlineOnlyWrite(() => {
        if (draft.kind === "Correction") {
          return client.recordReviewCorrection({
            ...target,
            correctedResult: draft.correctedResult,
            note: draft.note,
          });
        }
        if (draft.kind === "Withdrawal") {
          return client.recordReviewWithdrawal(target);
        }
        return client.recordReviewRedaction({
          ...target,
          eventId: draft.eventId,
        });
      });
      await refresh();
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
      // The follow-up created Work, so Work lists and Smart Collection
      // membership read it again.
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({ queryKey: projectWorksQueryPrefix }),
        ...invalidateSmartCollectionMembership(queryClient),
      ]);
    },
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
