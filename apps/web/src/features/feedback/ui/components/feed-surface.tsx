import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";
import { type FeedQuery, FeedView } from "../views/feed-view";

/** Read-only Feed of the Project's Feedback and long-body Source records. */
export default function FeedSurface({ projectId }: { projectId: string }) {
  const filters = useSearch({
    from: "/_auth/projects/$projectId/",
    select: (search) => search.feed,
  });
  const query = { ...filters, sort: filters?.sort ?? "Newest first" };
  const navigate = useNavigate();
  function setQuery(next: FeedQuery) {
    navigate({
      hash: true,
      search: (current) => ({
        ...current,
        feed:
          next.sourceType || next.status || next.sort !== "Newest first"
            ? next
            : undefined,
      }),
      to: ".",
    }).catch(() => undefined);
  }
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
  if (feed.status === "pending") {
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
