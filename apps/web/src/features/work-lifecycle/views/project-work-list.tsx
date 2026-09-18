import { Badge } from "@cantiara/ui/components/badge";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/utils/orpc";

export default function ProjectWorkList({ projectId }: { projectId: string }) {
  const query = useQuery(
    orpc.projectWorks.queryOptions({
      input: { projectId },
    }),
  );

  if (query.isPending) {
    return <p className="mt-2 text-muted-foreground text-sm">Loading Work…</p>;
  }

  if (query.isError) {
    return (
      <p className="mt-2 text-destructive text-sm" role="alert">
        Work is unavailable. Try loading this page again.
      </p>
    );
  }

  if (query.data.length === 0) {
    return (
      <p className="mt-2 text-muted-foreground text-sm/relaxed">
        No sample content was created.
      </p>
    );
  }

  return (
    <ul aria-label="Work list" className="mt-4 space-y-2">
      {query.data.map((work) => (
        <li
          className="flex flex-wrap items-center justify-between gap-3 border bg-background px-3 py-3"
          key={work.id}
        >
          <div className="min-w-0">
            <p className="font-medium text-sm">
              <span className="text-muted-foreground">{work.key}</span>{" "}
              {work.title}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="outline">{work.type}</Badge>
            <Badge variant="secondary">{work.status}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
