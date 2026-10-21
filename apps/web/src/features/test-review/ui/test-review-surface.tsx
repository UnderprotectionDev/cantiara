// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Project.
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import type { TestReviewSignalActions } from "./test-review-signals";
import { type TestReviewActions, TestReviewView } from "./test-review-view";

/** The Tests area's Test Review section; it gates and archives nothing. */
export default function TestReviewSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectTestReview.queryOptions({ input: { projectId } });
  const review = useQuery(options);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });
  if (review.isPending) {
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
      await runOnlineOnlyWrite(() =>
        client.commitReviewBulk({
          previewFingerprint: preview.fingerprint,
          projectId,
          sessionId,
          sessionTestIds,
        }),
      );
      await refresh();
    },
    previewBulk: (sessionId, sessionTestIds) =>
      client.previewReviewBulk({ projectId, sessionId, sessionTestIds }),
    previewClose: (sessionId) =>
      client.previewReviewClose({ projectId, sessionId }),
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
      await runOnlineOnlyWrite(() =>
        client.setReviewItemState({
          projectId,
          sessionId,
          sessionTestId,
          state,
        }),
      );
      await refresh();
    },
    setSession: async (sessionId, state, reason) => {
      await runOnlineOnlyWrite(() =>
        client.setReviewSessionState({
          projectId,
          reason,
          sessionId,
          state,
        }),
      );
      await refresh();
    },
  };
  const signalActions: TestReviewSignalActions = {
    bindResult: async (scenarioId, scenarioVersion, sessionTestId) => {
      await runOnlineOnlyWrite(() =>
        client.bindReviewResult({
          projectId,
          scenarioId,
          scenarioVersion,
          sessionTestId,
        }),
      );
      await refresh();
    },
    commitFollowUp: async (sessionTestIds, target, preview) => {
      await runOnlineOnlyWrite(() =>
        client.commitReviewFollowUp({
          previewFingerprint: preview.fingerprint,
          projectId,
          sessionTestIds,
          target,
          workId: crypto.randomUUID(),
        }),
      );
      await refresh();
    },
    previewFollowUp: (sessionTestIds, target) =>
      client.previewReviewFollowUp({ projectId, sessionTestIds, target }),
    supersede: async (newerId, olderId) => {
      await runOnlineOnlyWrite(() =>
        client.supersedeReviewResult({
          newerSessionTestId: newerId,
          olderSessionTestId: olderId,
          projectId,
        }),
      );
      await refresh();
    },
  };
  return (
    <TestReviewView
      actions={actions}
      events={review.data.events}
      readOnly={review.data.readOnly}
      resultEvents={review.data.resultEvents}
      sessions={review.data.sessions}
      signals={{ actions: signalActions, data: review.data }}
    />
  );
}
