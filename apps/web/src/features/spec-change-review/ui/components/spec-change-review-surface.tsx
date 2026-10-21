// biome-ignore-all lint/performance/noJsxPropsBind: Retry binds to the queue query.
import { Button } from "@cantiara/ui/components/button";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import { client, orpc } from "@/utils/orpc";
import { SpecChangeReviewView } from "../views/spec-change-review-view";
import type { MarkCandidate } from "./spec-change-review-candidates";
import type {
  ConfirmFollowUp,
  PreviewFollowUp,
} from "./spec-change-review-follow-up-dialog";

export default function SpecChangeReviewSurface({
  projectId,
}: {
  projectId: string;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const queryClient = useQueryClient();
  const queue = useQuery(
    orpc.projectSpecChangeReviews.queryOptions({ input: { projectId } }),
  );
  const detailOptions = orpc.specChangeReview.queryOptions({
    input: selectedId ? { reviewId: selectedId } : skipToken,
  });
  const detail = useQuery(detailOptions);
  const mark = useMutation({
    mutationFn: ({
      args: [candidate, state, note],
      reviewId,
    }: {
      args: Parameters<MarkCandidate>;
      reviewId: string;
    }) =>
      client.markSpecChangeReviewCandidate({
        baseRevision: candidate.review.revision,
        candidate: candidate.identity,
        clientIdempotencyKey: crypto.randomUUID(),
        note,
        reviewId,
        state,
      }),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: detailOptions.queryKey }),
  });
  const previewFollowUp: PreviewFollowUp = (candidate, workType) =>
    detail.data
      ? client.previewSpecChangeReviewFollowUp({
          candidate: candidate.identity,
          reviewId: detail.data.review.id,
          workType,
        })
      : Promise.reject(new Error("No review is open."));
  const confirmFollowUp: ConfirmFollowUp = async (
    candidate,
    preview,
    identity,
  ) => {
    if (!detail.data) {
      throw new Error("No review is open.");
    }
    try {
      return await client.createSpecChangeReviewFollowUp({
        baseRevision: 0,
        candidate: candidate.identity,
        clientIdempotencyKey: identity.key,
        previewFingerprint: preview.fingerprint,
        reviewId: detail.data.review.id,
        workId: identity.workId,
        workType: preview.plan.work.type,
      });
    } finally {
      await queryClient.invalidateQueries({ queryKey: detailOptions.queryKey });
    }
  };
  if (queue.isPending) {
    return <p role="status">Loading Spec Change Review…</p>;
  }
  if (!queue.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Spec Change Review is unavailable.</p>
        <Button
          onClick={() => {
            queue.refetch().catch(() => undefined);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }
  let markStatus = "";
  if (mark.isPending) {
    markStatus = "Saving review status…";
  } else if (mark.isError) {
    markStatus = "The review status could not be saved. Reload and try again.";
  } else if (mark.isSuccess) {
    markStatus = `Marked ${mark.data.state}.`;
  }
  return (
    <div className="space-y-3">
      <SpecChangeReviewView
        detail={detail.data}
        markStatus={markStatus}
        onConfirmFollowUp={confirmFollowUp}
        onMark={(...args) =>
          detail.data
            ? mark.mutate({ args, reviewId: detail.data.review.id })
            : undefined
        }
        onPreviewFollowUp={previewFollowUp}
        onSelect={setSelectedId}
        reviews={queue.data}
        selectedId={selectedId}
      />
      {detail.isError ? (
        <p role="alert">This Spec Change Review could not be opened.</p>
      ) : null}
    </div>
  );
}
