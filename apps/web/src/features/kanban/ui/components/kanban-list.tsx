import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
import { VirtualList } from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import { getWorkStatusLabel } from "@/components/work-status-form";
import { OpenSourceRecordButton } from "@/features/record-discovery/ui/components/context-record-preview";
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
        <h3 className="text-xl font-semibold tracking-tight">List</h3>
        <KanbanWorkSummary focusThreshold={focusThreshold} works={works} />
      </header>
      <VirtualList
        aria-label="List Work"
        className="divide-y rounded-md border"
        estimateSize={108}
        gap={8}
        getKey={virtualRowId}
        rows={works}
      >
        {(work, rowProps) => (
          <li {...rowProps}>
            <article className="grid gap-3 bg-card px-3 py-3 md:grid-cols-[minmax(15rem,2fr)_minmax(8rem,1fr)_minmax(12rem,1.5fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground">{work.key}</span>{" "}
                  {work.title}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
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
              <OpenSourceRecordButton
                className="min-h-11 py-3 text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                target={{
                  kind: "work",
                  label: `${work.key} · ${work.title}`,
                  projectId,
                  workId: work.id,
                }}
              />
            </article>
          </li>
        )}
      </VirtualList>
      {works.length === 0 ? (
        <p className="py-5 text-center text-sm text-muted-foreground">
          No Work in this view.
        </p>
      ) : null}
    </section>
  );
}
