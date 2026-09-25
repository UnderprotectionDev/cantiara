import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
import { workRecordHref } from "@/features/project-shell/lib/project-shell-navigation";
import { getWorkStatusLabel } from "@/features/work-lifecycle/ui/forms/work-status-form";
import { KanbanCardSummary } from "./kanban-board";
import { KanbanWorkDetails, KanbanWorkSummary } from "./kanban-work-summary";

export default function KanbanList({
  focusThreshold,
  projectId,
  workStatusLabels,
  works,
}: {
  focusThreshold: number | null;
  projectId: string;
  workStatusLabels: readonly WorkStatusLabel[];
  works: readonly WorkProfile[];
}) {
  return (
    <section aria-label="List" className="space-y-3">
      <header className="flex items-end justify-between gap-3">
        <h3 className="font-semibold text-xl tracking-tight">List</h3>
        <KanbanWorkSummary focusThreshold={focusThreshold} works={works} />
      </header>
      <ul aria-label="List Work" className="divide-y rounded-md border">
        {works.map((work) => (
          <li key={work.id}>
            <article className="grid gap-3 bg-card px-3 py-3 md:grid-cols-[minmax(15rem,2fr)_minmax(8rem,1fr)_minmax(12rem,1.5fr)_auto] md:items-center">
              <div className="min-w-0">
                <a
                  className="font-medium text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  href={workRecordHref(projectId, work.id)}
                >
                  <span className="text-muted-foreground">{work.key}</span>{" "}
                  {work.title}
                </a>
                <p className="mt-1 text-muted-foreground text-xs">
                  {work.type}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {getWorkStatusLabel(work.status, workStatusLabels)}
                </Badge>
                {work.closureResult ? (
                  <Badge variant="secondary">{work.closureResult}</Badge>
                ) : null}
              </div>
              <KanbanWorkDetails work={work} />
              <KanbanCardSummary work={work} />
              <a
                className="min-h-11 py-3 text-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                href={workRecordHref(projectId, work.id)}
              >
                Open source record
              </a>
            </article>
          </li>
        ))}
      </ul>
      {works.length === 0 ? (
        <p className="py-5 text-center text-muted-foreground text-sm">
          No Work in this view.
        </p>
      ) : null}
    </section>
  );
}
