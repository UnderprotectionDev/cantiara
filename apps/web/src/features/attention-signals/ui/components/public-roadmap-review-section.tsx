import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import PublicRoadmapReviewSurface from "./public-roadmap-review-surface";

/** One optional interval control per active Project; no default, no signal without it. */
export default function PublicRoadmapReviewSection() {
  const projects = useQuery(orpc.projects.queryOptions());
  const active = (projects.data ?? []).filter(
    (item) => item.status === "Active" || item.status === "Pending",
  );
  if (active.length === 0) {
    return null;
  }
  return (
    <section
      aria-labelledby="public-roadmap-review-heading"
      className="grid gap-2"
    >
      <h2 className="font-medium" id="public-roadmap-review-heading">
        Public Roadmap review
      </h2>
      {active.map((item) => (
        <div className="grid gap-1" key={item.id}>
          <h3 className="text-sm">{item.name}</h3>
          <PublicRoadmapReviewSurface projectId={item.id} />
        </div>
      ))}
    </section>
  );
}
