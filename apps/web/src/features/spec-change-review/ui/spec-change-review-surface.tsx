// biome-ignore-all lint/performance/noJsxPropsBind: Retry binds to the queue query.
import { Button } from "@cantiara/ui/components/button";
import { skipToken, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { orpc } from "@/utils/orpc";
import { SpecChangeReviewView } from "./spec-change-review-view";

export default function SpecChangeReviewSurface({
  projectId,
}: {
  projectId: string;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const queue = useQuery(
    orpc.projectSpecChangeReviews.queryOptions({ input: { projectId } }),
  );
  const detail = useQuery(
    orpc.specChangeReview.queryOptions({
      input: selectedId ? { reviewId: selectedId } : skipToken,
    }),
  );
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
  return (
    <div className="space-y-3">
      <SpecChangeReviewView
        detail={detail.data}
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
