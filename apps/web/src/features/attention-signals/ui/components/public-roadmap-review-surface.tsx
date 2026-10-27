import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import PublicRoadmapReviewForm from "../forms/public-roadmap-review-form";

export default function PublicRoadmapReviewSurface({
  projectId,
}: {
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectPublicRoadmapReviewInterval.queryOptions({
    input: { projectId },
  });
  const interval = useQuery(options);
  const save = useMutation({
    mutationFn: (days: number | null) =>
      runOnlineOnlyWrite(() =>
        client.setPublicRoadmapReviewInterval({ days, projectId }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: options.queryKey }),
  });
  if (!interval.data) {
    return null;
  }
  return (
    <section
      aria-label="Public Roadmap review"
      className="grid gap-1 rounded-md border p-3"
    >
      <PublicRoadmapReviewForm
        days={interval.data.days}
        disabled={save.isPending}
        key={interval.data.days ?? "none"}
        onSave={save.mutateAsync}
      />
      <p className="text-muted-foreground text-xs">
        Optional. Without an interval no review signal is created. A signal only
        suggests a review; it changes no status, label or snapshot.
      </p>
    </section>
  );
}
