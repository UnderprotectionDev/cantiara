// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.

import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commandVariables } from "@/lib/command-variables";
import { fetchFresh } from "@/lib/fetch-fresh";
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

function reviewCommand<T extends object>(
  input: T,
  observer: {
    isError: boolean;
    variables?: T & { clientIdempotencyKey?: string };
  },
) {
  const { variables } = observer;
  return commandVariables(
    input,
    observer.isError && variables?.clientIdempotencyKey
      ? { ...variables, clientIdempotencyKey: variables.clientIdempotencyKey }
      : undefined,
  );
}

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
      await commitReviewBulkMutation.mutateAsync(
        reviewCommand<Parameters<typeof client.commitReviewBulk>[0]>(
          {
            previewFingerprint: preview.fingerprint,
            projectId,
            sessionId,
            sessionTestIds,
          },
          commitReviewBulkMutation,
        ),
      );
    },
    previewBulk: (sessionId, sessionTestIds) =>
      fetchFresh(queryClient, {
        ...orpc.previewReviewBulk.queryOptions({
          input: { projectId, sessionId, sessionTestIds },
        }),
        gcTime: 0,
      }),
    // The close preview names the remaining Session Tests and carries no
    // token the close needs, so it is a plain read.
    previewClose: (sessionId) =>
      fetchFresh(queryClient, {
        ...orpc.previewReviewClose.queryOptions({
          input: { projectId, sessionId },
        }),
        gcTime: 0,
      }),
    recordEvent: async (sessionId, draft) => {
      const target = {
        projectId,
        reason: draft.reason,
        sessionId,
        sessionTestId: draft.sessionTestId,
      };
      if (draft.kind === "Correction") {
        await recordReviewCorrectionMutation.mutateAsync(
          reviewCommand<Parameters<typeof client.recordReviewCorrection>[0]>(
            {
              ...target,
              correctedResult: draft.correctedResult,
              note: draft.note,
            },
            recordReviewCorrectionMutation,
          ),
        );
      } else if (draft.kind === "Withdrawal") {
        await recordReviewWithdrawalMutation.mutateAsync(
          reviewCommand<Parameters<typeof client.recordReviewWithdrawal>[0]>(
            target,
            recordReviewWithdrawalMutation,
          ),
        );
      } else {
        await recordReviewRedactionMutation.mutateAsync(
          reviewCommand<Parameters<typeof client.recordReviewRedaction>[0]>(
            { ...target, eventId: draft.eventId },
            recordReviewRedactionMutation,
          ),
        );
      }
    },
    setItem: async (sessionId, sessionTestId, state) => {
      await setReviewItemStateMutation.mutateAsync(
        reviewCommand<Parameters<typeof client.setReviewItemState>[0]>(
          {
            projectId,
            sessionId,
            sessionTestId,
            state,
          },
          setReviewItemStateMutation,
        ),
      );
    },
    setSession: async (sessionId, state, reason) => {
      await setReviewSessionStateMutation.mutateAsync(
        reviewCommand<Parameters<typeof client.setReviewSessionState>[0]>(
          {
            projectId,
            reason,
            sessionId,
            state,
          },
          setReviewSessionStateMutation,
        ),
      );
    },
  };
  const signalActions: TestReviewSignalActions = {
    bindState: bindReviewResultMutation,
    bindResult: async (scenarioId, scenarioVersion, sessionTestId) => {
      await bindReviewResultMutation.mutateAsync(
        reviewCommand<Parameters<typeof client.bindReviewResult>[0]>(
          {
            projectId,
            scenarioId,
            scenarioVersion,
            sessionTestId,
          },
          bindReviewResultMutation,
        ),
      );
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
      fetchFresh(queryClient, {
        ...orpc.previewReviewFollowUp.queryOptions({
          input: { projectId, sessionTestIds, target },
        }),
        gcTime: 0,
      }),
    supersede: async (newerId, olderId) => {
      await supersedeReviewResultMutation.mutateAsync(
        reviewCommand<Parameters<typeof client.supersedeReviewResult>[0]>(
          {
            newerSessionTestId: newerId,
            olderSessionTestId: olderId,
            projectId,
          },
          supersedeReviewResultMutation,
        ),
      );
    },
  };
  const sessionWrites = [
    recordReviewRedactionMutation,
    recordReviewWithdrawalMutation,
    recordReviewCorrectionMutation,
    commitReviewBulkMutation,
    setReviewItemStateMutation,
    setReviewSessionStateMutation,
  ];
  const writeForSession = (sessionId: string) =>
    sessionWrites
      .filter(({ variables }) => variables?.sessionId === sessionId)
      .sort((left, right) => right.submittedAt - left.submittedAt)[0];
  return (
    <TestReviewView
      actions={actions}
      events={review.data.events}
      preferences={preferences.data}
      readOnly={review.data.readOnly}
      resultEvents={review.data.resultEvents}
      sessions={review.data.sessions}
      signals={{ actions: signalActions, data: review.data }}
      writeForSession={writeForSession}
    />
  );
}
