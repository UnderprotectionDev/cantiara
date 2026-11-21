// biome-ignore-all lint/performance/noJsxPropsBind: Retry binds to the queue query.

import { Button } from "@cantiara/ui/components/button";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";

import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import type {
  ConfirmFollowUp,
  PreviewFollowUp,
} from "../forms/spec-change-review-follow-up-form";
import { SpecChangeReviewView } from "../views/spec-change-review-view";
import type { MarkCandidate } from "./spec-change-review-candidates";

export default function SpecChangeReviewSurface({
  projectId,
}: {
  projectId: string;
}) {
  const selectedId = useSearch({
    from: "/_auth/projects/$projectId/",
    select: (search) => search.review,
  });
  const navigate = useNavigate();
  function setSelectedId(value: string) {
    navigate({
      hash: true,
      search: (current) => ({ ...current, review: value || undefined }),
      to: ".",
    }).catch(() => undefined);
  }
  const queryClient = useQueryClient();
  const queue = useQuery(
    orpc.projectSpecChangeReviews.queryOptions({ input: { projectId } }),
  );
  const detailOptions = orpc.specChangeReview.queryOptions({
    input: selectedId ? { reviewId: selectedId } : skipToken,
  });
  const detail = useQuery(detailOptions);
  const mark = usePreparedMutation(
    orpc.markSpecChangeReviewCandidate.mutationOptions({
      mutationFn: (input) => client.markSpecChangeReviewCandidate(input),
      onSuccess: (_, { reviewId }) =>
        queryClient.invalidateQueries({
          queryKey: orpc.specChangeReview.queryKey({ input: { reviewId } }),
        }),
    }),
    ({
      args: [candidate, state, note],
      reviewId,
    }: {
      args: Parameters<MarkCandidate>;
      reviewId: string;
    }) => ({
      baseRevision: candidate.review.revision,
      candidate: candidate.identity,
      note,
      reviewId,
      state,
    }),
  );
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
    const { reviewId } = preview.plan;
    const created = await client.createSpecChangeReviewFollowUp({
      baseRevision: 0,
      candidate: candidate.identity,
      clientIdempotencyKey: identity.key,
      previewFingerprint: preview.fingerprint,
      reviewId,
      workId: identity.workId,
      workType: preview.plan.work.type,
    });
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.projectWorks.queryKey({ input: { projectId } }),
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.specChangeReview.queryKey({ input: { reviewId } }),
      }),
      ...invalidateSmartCollectionMembership(queryClient),
    ]);
    return created;
  };
  if (queue.status === "pending") {
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
