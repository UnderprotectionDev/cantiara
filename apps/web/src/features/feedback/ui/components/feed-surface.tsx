import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { type FeedQuery, FeedView } from "../views/feed-view";

/** Read-only Feed of the Project's Feedback and long-body Source records. */
export default function FeedSurface({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState<FeedQuery>({ sort: "Newest first" });
  const feed = useQuery(
    orpc.feedbackFeed.queryOptions({
      input: {
        conditions: query.status ? { status: query.status } : {},
        projectId,
        sort: query.sort,
        sourceType: query.sourceType,
      },
    }),
  );
  function retry() {
    feed.refetch().catch(() => undefined);
  }
  if (feed.isPending) {
    return <p role="status">Loading Feed…</p>;
  }
  if (!feed.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Feed is unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  return (
    <FeedView onChangeQuery={setQuery} query={query} rows={feed.data.rows} />
  );
}
