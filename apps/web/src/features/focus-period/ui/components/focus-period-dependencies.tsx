// biome-ignore-all lint/performance/noJsxPropsBind: Record windows bind identity to the row model for this surface.
import type { WorkDependenciesProjection } from "@cantiara/api/relations";
import { VirtualList } from "@cantiara/ui/components/virtual-list";
import { Link } from "@tanstack/react-router";
import { workRecordHash } from "@/features/project-shell/lib/project-shell-navigation";

export function FocusPeriodDependencies({
  dependencies,
}: {
  dependencies: WorkDependenciesProjection;
}) {
  return (
    <section aria-label="Dependencies">
      <details className="space-y-3">
        <summary className="cursor-pointer rounded-md font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          Dependencies
        </summary>
        {dependencies.edges.length ? (
          <VirtualList
            className="space-y-2"
            estimateSize={70}
            gap={8}
            getKey={(edge) => edge.relationId}
            rows={dependencies.edges}
          >
            {(edge, rowProps) => {
              const inCycle = dependencies.cycles.some((cycle) =>
                cycle.edges.some(
                  ({ relationId }) => relationId === edge.relationId,
                ),
              );
              return (
                <li className="rounded-md border px-3 py-2" {...rowProps}>
                  {edge.blocker.projectId ? (
                    <Link
                      aria-label={`Open source record: ${edge.blocker.key} ${edge.blocker.title}`}
                      hash={workRecordHash(edge.blocker.recordId)}
                      params={{ projectId: edge.blocker.projectId }}
                      to="/projects/$projectId"
                    >
                      {edge.blocker.title} · {edge.blocker.key}
                    </Link>
                  ) : null}
                  {" blocks "}
                  {edge.blocked.projectId ? (
                    <Link
                      aria-label={`Open source record: ${edge.blocked.key} ${edge.blocked.title}`}
                      hash={workRecordHash(edge.blocked.recordId)}
                      params={{ projectId: edge.blocked.projectId }}
                      to="/projects/$projectId"
                    >
                      {edge.blocked.title} · {edge.blocked.key}
                    </Link>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    {edge.status}
                    {inCycle ? " · Part of a dependency cycle" : ""}
                  </p>
                </li>
              );
            }}
          </VirtualList>
        ) : (
          <p className="text-sm text-muted-foreground">
            No dependencies in this Focus Period.
          </p>
        )}
      </details>
    </section>
  );
}
