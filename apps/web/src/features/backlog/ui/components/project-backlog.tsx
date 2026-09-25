import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";
import { orpc } from "@/utils/orpc";

export default function ProjectBacklog({ projectId }: { projectId: string }) {
  const query = useQuery(
    orpc.projectBacklog.queryOptions({ input: { projectId } }),
  );

  if (query.isPending) {
    return (
      <p className="mt-5 text-muted-foreground text-sm" role="status">
        Loading Backlog…
      </p>
    );
  }

  if (query.isError) {
    return (
      <p className="mt-5 text-destructive text-sm" role="alert">
        Backlog is unavailable. Try loading this page again.
      </p>
    );
  }

  if (query.data.length === 0) {
    return (
      <p className="mt-5 border-border/70 border-y py-5 text-muted-foreground text-sm">
        No active Work to consider.
      </p>
    );
  }

  return (
    <ol aria-label="Backlog" className="mt-5 space-y-2">
      {query.data.map((work) => (
        <li
          className="rounded-lg border border-border/70 bg-card/35 transition-colors hover:bg-card/70 motion-reduce:transition-none"
          key={work.id}
        >
          <Link
            className="flex min-h-12 min-w-0 items-center gap-4 rounded-lg px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            hash={workRecordHash(work.id)}
            params={{ projectId }}
            to="/projects/$projectId"
          >
            <span className="shrink-0 font-mono text-muted-foreground text-xs">
              {work.key}
            </span>
            <span className="min-w-0 truncate font-medium text-sm">
              {work.title}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
